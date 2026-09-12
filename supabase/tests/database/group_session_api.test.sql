begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function(
  'public',
  'create_group_session',
  array['uuid', 'text', 'timestamp with time zone', 'uuid[]', 'uuid[]'],
  'atomic group-session creation function exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_group_session(uuid,text,timestamp with time zone,uuid[],uuid[])',
    'EXECUTE'
  ),
  false,
  'browser clients cannot invoke the privileged creation transaction'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.persist_group_recommendation(uuid,text,text,jsonb,uuid)',
    'EXECUTE'
  ),
  false,
  'browser clients cannot persist recommendation snapshots directly'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('d1000000-0000-0000-0000-000000000001', 'session-creator@example.test', '{"display_name":"Creator"}'),
  ('d1000000-0000-0000-0000-000000000002', 'session-friend@example.test', '{"display_name":"Friend"}'),
  ('d1000000-0000-0000-0000-000000000003', 'session-outsider@example.test', '{"display_name":"Outsider"}');

insert into public.friendships (requester_id, addressee_id, status)
values (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002',
  'accepted'
);

insert into public.venues (id, external_id, source, name, latitude, longitude, is_active)
values
  ('d2000000-0000-0000-0000-000000000001', 'test:session-1', 'test', 'Session Venue 1', 40.4430, -79.9430, true),
  ('d2000000-0000-0000-0000-000000000002', 'test:session-2', 'test', 'Session Venue 2', 40.4431, -79.9431, true),
  ('d2000000-0000-0000-0000-000000000003', 'test:session-3', 'test', 'Session Venue 3', 40.4432, -79.9432, true),
  ('d2000000-0000-0000-0000-000000000004', 'test:session-4', 'test', 'Session Venue 4', 40.4433, -79.9433, true);

create temporary table task6_session_id (id uuid not null);

insert into task6_session_id (id)
select public.create_group_session(
  'd1000000-0000-0000-0000-000000000001',
  'Friday lunch',
  null,
  array['d1000000-0000-0000-0000-000000000002']::uuid[],
  array[
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000003'
  ]::uuid[]
);

select is(
  (
    select count(*)
    from public.group_session_members
    where session_id = (select id from task6_session_id)
  ),
  2::bigint,
  'creation atomically adds the accepted creator and invited friend'
);

select is(
  (
    select status
    from public.group_session_members
    where session_id = (select id from task6_session_id)
      and user_id = 'd1000000-0000-0000-0000-000000000001'
  ),
  'accepted',
  'the creator membership remains accepted'
);

select is(
  (
    select count(*)
    from public.group_session_candidates
    where session_id = (select id from task6_session_id)
  ),
  3::bigint,
  'creation atomically attaches the candidate set'
);

select throws_ok(
  $$
    select public.create_group_session(
      'd1000000-0000-0000-0000-000000000001',
      'Invalid invitation',
      null,
      array['d1000000-0000-0000-0000-000000000003']::uuid[],
      array[
        'd2000000-0000-0000-0000-000000000001',
        'd2000000-0000-0000-0000-000000000002',
        'd2000000-0000-0000-0000-000000000003'
      ]::uuid[]
    )
  $$,
  '42501',
  'invitees must be accepted friends',
  'a non-friend cannot be invited through the server transaction'
);

select lives_ok(
  $$
    select public.replace_group_session_candidates(
      'd1000000-0000-0000-0000-000000000001',
      (select id from task6_session_id),
      array[
        'd2000000-0000-0000-0000-000000000002',
        'd2000000-0000-0000-0000-000000000003',
        'd2000000-0000-0000-0000-000000000004'
      ]::uuid[]
    )
  $$,
  'the creator can atomically replace candidate venues'
);

select is(
  (
    select count(*)
    from public.group_session_candidates
    where session_id = (select id from task6_session_id)
      and venue_id = 'd2000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'candidate replacement removes the old set'
);

create temporary table task6_result_ids (id uuid not null);

insert into task6_result_ids (id)
select public.persist_group_recommendation(
  (select id from task6_session_id),
  'fair-group-v1.0.0',
  repeat('a', 64),
  jsonb_build_object(
    'sessionId', (select id from task6_session_id)::text,
    'winner', jsonb_build_object('id', 'd2000000-0000-0000-0000-000000000002')
  ),
  'd1000000-0000-0000-0000-000000000001'
);

insert into task6_result_ids (id)
select public.persist_group_recommendation(
  (select id from task6_session_id),
  'fair-group-v1.0.0',
  repeat('a', 64),
  jsonb_build_object(
    'sessionId', (select id from task6_session_id)::text,
    'winner', jsonb_build_object('id', 'd2000000-0000-0000-0000-000000000002')
  ),
  'd1000000-0000-0000-0000-000000000001'
);

select is(
  (select count(distinct id) from task6_result_ids),
  1::bigint,
  'identical computations return the same persisted snapshot'
);

select is(
  (
    select count(*)
    from public.group_recommendation_results
    where session_id = (select id from task6_session_id)
  ),
  1::bigint,
  'identical computations create only one result row'
);

select is(
  (
    select status
    from public.group_sessions
    where id = (select id from task6_session_id)
  ),
  'decided',
  'persisting a recommendation marks the session decided'
);

select throws_ok(
  $$
    select public.persist_group_recommendation(
      (select id from task6_session_id),
      'fair-group-v1.0.0',
      repeat('b', 64),
      jsonb_build_object('sessionId', (select id from task6_session_id)::text),
      'd1000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  'only the creator may compute this session',
  'a non-creator cannot persist a recommendation'
);

select * from finish();
rollback;
