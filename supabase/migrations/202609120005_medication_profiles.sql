-- Private account lists, explicit group consent, and revision-checked results.
-- Apply before deploying the account/group medication integration.
create or replace function private.valid_medication_list(entries text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(entries) <= 12 and (cardinality(entries) = 0 or array_ndims(entries) = 1)
    and not exists (select 1 from unnest(entries) as entry
      where entry is null or btrim(entry) = '' or char_length(entry) > 100);
$$;

create table public.user_medication_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  medications text[] not null default '{}',
  use_in_groups boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  constraint valid_medications check (private.valid_medication_list(medications))
);
alter table public.user_medication_profiles enable row level security;
revoke all on public.user_medication_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.user_medication_profiles to authenticated;
grant all on public.user_medication_profiles to service_role;
create policy "Owners manage their private medication list"
on public.user_medication_profiles for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.version_medication_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize profile changes with group computation without locking private rows
  -- for other members. The lock key contains only the account UUID.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id, old.user_id)::text, 712005));
  if tg_op = 'DELETE' then return old; end if;
  new.revision := gen_random_uuid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger medication_profile_revision before insert or update or delete
on public.user_medication_profiles for each row execute function private.version_medication_profile();

create or replace function private.invalidate_medication_results()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.group_recommendation_results where session_id in (
    select session_id from public.group_session_members
    where user_id = coalesce(new.user_id, old.user_id) and status = 'accepted'
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger medication_profile_invalidate after insert or update or delete
on public.user_medication_profiles for each row execute function private.invalidate_medication_results();

-- Membership writes and persistence share a session lock: a newly accepted
-- member cannot be omitted between the revision check and result insert.
create or replace function private.lock_medication_group_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.group_sessions
    where id = coalesce(new.session_id, old.session_id) for update;
  if tg_op = 'DELETE' or tg_op = 'INSERT' or new.status is distinct from old.status then
    delete from public.group_recommendation_results
      where session_id = coalesce(new.session_id, old.session_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger group_members_medication_revision before insert or update or delete
on public.group_session_members for each row execute function private.lock_medication_group_membership();

create or replace function public.persist_medication_group_recommendation(
  p_session_id uuid, p_algorithm_version text, p_input_hash text,
  p_result_snapshot jsonb, p_computed_by uuid, p_medication_versions jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_versions jsonb;
begin
  perform 1 from public.group_sessions where id = p_session_id
    and creator_id = p_computed_by and status <> 'closed' for update;
  if not found then
    raise exception 'only the creator may compute this session' using errcode = '42501';
  end if;
  for v_user_id in select user_id from public.group_session_members
    where session_id = p_session_id and status = 'accepted' order by user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 712005));
  end loop;
  select coalesce(jsonb_object_agg(m.user_id::text, coalesce(p.revision::text, 'none')), '{}'::jsonb)
    into v_versions from public.group_session_members m
    left join public.user_medication_profiles p on p.user_id = m.user_id
    where m.session_id = p_session_id and m.status = 'accepted';
  if p_medication_versions is distinct from v_versions then
    raise exception 'medication settings or membership changed; recompute' using errcode = '40001';
  end if;
  return public.persist_group_recommendation(p_session_id, p_algorithm_version,
    p_input_hash, p_result_snapshot, p_computed_by);
end;
$$;

revoke all on function private.valid_medication_list(text[]) from public;
grant execute on function private.valid_medication_list(text[]) to authenticated, service_role;
revoke all on function private.version_medication_profile() from public, anon, authenticated;
revoke all on function private.invalidate_medication_results() from public, anon, authenticated;
revoke all on function private.lock_medication_group_membership() from public, anon, authenticated;
revoke all on function public.persist_medication_group_recommendation(uuid,text,text,jsonb,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_medication_group_recommendation(uuid,text,text,jsonb,uuid,jsonb) to service_role;
