-- Task 6: atomic server-only group session creation, candidate replacement,
-- and versioned recommendation persistence. Browser clients continue using
-- authenticated routes and the Task 1 RLS policies.

create or replace function public.create_group_session(
  p_creator_id uuid,
  p_name text,
  p_scheduled_for timestamptz,
  p_invitee_ids uuid[],
  p_candidate_venue_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_invitee_ids uuid[] := coalesce(p_invitee_ids, '{}'::uuid[]);
  v_candidate_ids uuid[] := coalesce(p_candidate_venue_ids, '{}'::uuid[]);
  v_unique_count integer;
begin
  if p_creator_id is null or not exists (
    select 1 from public.users where id = p_creator_id
  ) then
    raise exception 'a valid creator is required' using errcode = '23503';
  end if;

  if p_name is not null and btrim(p_name) = '' then
    raise exception 'session name cannot be blank' using errcode = '22023';
  end if;

  if cardinality(v_candidate_ids) < 3 or cardinality(v_candidate_ids) > 5 then
    raise exception 'sessions require between three and five candidate venues'
      using errcode = '22023';
  end if;

  select count(distinct candidate_id)
  into v_unique_count
  from unnest(v_candidate_ids) as candidate_id;
  if v_unique_count <> cardinality(v_candidate_ids) then
    raise exception 'candidate venues must be unique' using errcode = '22023';
  end if;

  select count(distinct invitee_id)
  into v_unique_count
  from unnest(v_invitee_ids) as invitee_id;
  if v_unique_count <> cardinality(v_invitee_ids) then
    raise exception 'invitees must be unique' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_invitee_ids) as invitee_id
    where invitee_id = p_creator_id
      or not exists (
        select 1
        from public.friendships
        where least(requester_id, addressee_id) = least(p_creator_id, invitee_id)
          and greatest(requester_id, addressee_id) = greatest(p_creator_id, invitee_id)
          and status = 'accepted'
      )
  ) then
    raise exception 'invitees must be accepted friends' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(v_candidate_ids) as candidate_id
    where not exists (
      select 1 from public.venues
      where id = candidate_id and is_active
    )
  ) then
    raise exception 'candidate venues must be active' using errcode = '23503';
  end if;

  insert into public.group_sessions (creator_id, name, scheduled_for)
  values (p_creator_id, nullif(btrim(p_name), ''), p_scheduled_for)
  returning id into v_session_id;

  insert into public.group_session_members (
    session_id,
    user_id,
    invited_by,
    status
  )
  select v_session_id, invitee_id, p_creator_id, 'invited'
  from unnest(v_invitee_ids) as invitee_id;

  insert into public.group_session_candidates (session_id, venue_id, added_by)
  select v_session_id, candidate_id, p_creator_id
  from unnest(v_candidate_ids) with ordinality as candidates(candidate_id, position)
  order by position;

  return v_session_id;
end;
$$;

create or replace function public.replace_group_session_candidates(
  p_creator_id uuid,
  p_session_id uuid,
  p_candidate_venue_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_ids uuid[] := coalesce(p_candidate_venue_ids, '{}'::uuid[]);
  v_unique_count integer;
begin
  if not exists (
    select 1
    from public.group_sessions
    where id = p_session_id
      and creator_id = p_creator_id
      and status <> 'closed'
  ) then
    raise exception 'an editable creator session is required' using errcode = '42501';
  end if;

  if cardinality(v_candidate_ids) < 3 or cardinality(v_candidate_ids) > 5 then
    raise exception 'sessions require between three and five candidate venues'
      using errcode = '22023';
  end if;

  select count(distinct candidate_id)
  into v_unique_count
  from unnest(v_candidate_ids) as candidate_id;
  if v_unique_count <> cardinality(v_candidate_ids) then
    raise exception 'candidate venues must be unique' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_candidate_ids) as candidate_id
    where not exists (
      select 1 from public.venues
      where id = candidate_id and is_active
    )
  ) then
    raise exception 'candidate venues must be active' using errcode = '23503';
  end if;

  delete from public.group_session_candidates
  where session_id = p_session_id;

  insert into public.group_session_candidates (session_id, venue_id, added_by)
  select p_session_id, candidate_id, p_creator_id
  from unnest(v_candidate_ids) with ordinality as candidates(candidate_id, position)
  order by position;
end;
$$;

create or replace function public.persist_group_recommendation(
  p_session_id uuid,
  p_algorithm_version text,
  p_input_hash text,
  p_result_snapshot jsonb,
  p_computed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result_id uuid;
begin
  if not exists (
    select 1
    from public.group_sessions
    where id = p_session_id
      and creator_id = p_computed_by
      and status <> 'closed'
  ) then
    raise exception 'only the creator may compute this session' using errcode = '42501';
  end if;

  if btrim(coalesce(p_algorithm_version, '')) = ''
    or btrim(coalesce(p_input_hash, '')) = ''
    or p_result_snapshot is null
    or jsonb_typeof(p_result_snapshot) <> 'object'
    or p_result_snapshot ->> 'sessionId' is distinct from p_session_id::text then
    raise exception 'invalid recommendation snapshot' using errcode = '22023';
  end if;

  insert into public.group_recommendation_results (
    session_id,
    algorithm_version,
    input_hash,
    result_snapshot,
    computed_by
  ) values (
    p_session_id,
    p_algorithm_version,
    p_input_hash,
    p_result_snapshot,
    p_computed_by
  )
  on conflict (session_id, algorithm_version, input_hash) do nothing
  returning id into v_result_id;

  if v_result_id is null then
    select id
    into v_result_id
    from public.group_recommendation_results
    where session_id = p_session_id
      and algorithm_version = p_algorithm_version
      and input_hash = p_input_hash;
  end if;

  update public.group_sessions
  set status = 'decided'
  where id = p_session_id and status <> 'closed';

  return v_result_id;
end;
$$;

revoke all on function public.create_group_session(
  uuid, text, timestamptz, uuid[], uuid[]
) from public, anon, authenticated;
revoke all on function public.replace_group_session_candidates(
  uuid, uuid, uuid[]
) from public, anon, authenticated;
revoke all on function public.persist_group_recommendation(
  uuid, text, text, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.create_group_session(
  uuid, text, timestamptz, uuid[], uuid[]
) to service_role;
grant execute on function public.replace_group_session_candidates(
  uuid, uuid, uuid[]
) to service_role;
grant execute on function public.persist_group_recommendation(
  uuid, text, text, jsonb, uuid
) to service_role;
