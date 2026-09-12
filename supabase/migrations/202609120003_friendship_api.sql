-- Task 5: privacy-preserving friendship lookup by email.
-- Email remains in auth.users and is never exposed through a public table.

create or replace function public.request_friendship_by_email(
  p_requester_id uuid,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized_email text := lower(btrim(coalesce(p_email, '')));
  v_addressee_id uuid;
  v_addressee_display_name text;
begin
  if p_requester_id is null or not exists (
    select 1 from public.users where id = p_requester_id
  ) then
    raise exception 'a valid requester is required' using errcode = '23503';
  end if;

  if char_length(v_normalized_email) < 3
    or char_length(v_normalized_email) > 320
    or v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'a valid email is required' using errcode = '22023';
  end if;

  select
    auth_user.id,
    coalesce(
      nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
      'TasteDNA user'
    )
  into v_addressee_id, v_addressee_display_name
  from auth.users as auth_user
  where lower(btrim(auth_user.email)) = v_normalized_email
  order by auth_user.created_at
  limit 1;

  if v_addressee_id is null then
    return 'not-found';
  end if;

  if v_addressee_id = p_requester_id then
    return 'self';
  end if;

  -- Backfill defensively for Auth users created before the public-user trigger.
  insert into public.users (id, display_name)
  values (v_addressee_id, v_addressee_display_name)
  on conflict (id) do update
  set display_name = coalesce(public.users.display_name, excluded.display_name);

  if exists (
    select 1
    from public.friendships
    where least(requester_id, addressee_id) = least(p_requester_id, v_addressee_id)
      and greatest(requester_id, addressee_id) = greatest(p_requester_id, v_addressee_id)
  ) then
    return 'existing';
  end if;

  begin
    insert into public.friendships (requester_id, addressee_id, status)
    values (p_requester_id, v_addressee_id, 'pending');
  exception
    when unique_violation then
      -- A concurrent or reversed request is deliberately indistinguishable.
      return 'existing';
  end;

  return 'created';
end;
$$;

revoke all on function public.request_friendship_by_email(uuid, text)
  from public, anon, authenticated;
grant execute on function public.request_friendship_by_email(uuid, text)
  to service_role;

