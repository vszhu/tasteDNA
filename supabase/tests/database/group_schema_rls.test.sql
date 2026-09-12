begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'venues', 'venues table exists');
select has_table('public', 'friendships', 'friendships table exists');
select has_table('public', 'group_sessions', 'group sessions table exists');
select has_table('public', 'group_session_members', 'group session members table exists');
select has_table('public', 'group_session_candidates', 'group session candidates table exists');
select has_table('public', 'group_session_meal_preferences', 'group meal preferences table exists');
select has_table('public', 'group_recommendation_results', 'group result snapshots table exists');
select has_column('public', 'menus', 'venue_id', 'menus can be linked to venues');
select has_column('public', 'menus', 'content_hash', 'menus carry a content hash');
select has_column('public', 'menus', 'version', 'menus carry a venue version');

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'creator@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'member@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'invitee@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'declined@example.test'),
  ('00000000-0000-0000-0000-000000000005', 'outsider@example.test'),
  ('00000000-0000-0000-0000-000000000006', 'transient@example.test');

insert into public.users (id, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'Creator'),
  ('00000000-0000-0000-0000-000000000002', 'Member'),
  ('00000000-0000-0000-0000-000000000003', 'Invitee'),
  ('00000000-0000-0000-0000-000000000004', 'Declined'),
  ('00000000-0000-0000-0000-000000000005', 'Outsider'),
  ('00000000-0000-0000-0000-000000000006', 'Transient')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.dishes (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Policy Test Dish');

insert into public.ratings (id, user_id, dish_id, client_id, client_dish_id, value, source)
values
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'creator-rating', 'policy-test-dish', 5, 'onboarding'),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member-rating', 'policy-test-dish', 4, 'onboarding');

insert into public.taste_profiles (id, user_id, rating_count)
values
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1),
  ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 1);

insert into public.venues (
  id,
  external_id,
  source,
  name,
  latitude,
  longitude,
  is_active
)
values
  ('20000000-0000-0000-0000-000000000001', 'cmu:active', 'cmu', 'Active Venue', 40.4433, -79.9436, true),
  ('20000000-0000-0000-0000-000000000002', 'cmu:inactive', 'cmu', 'Inactive Venue', 40.4440, -79.9420, false),
  ('20000000-0000-0000-0000-000000000003', 'cmu:temporary', 'cmu', 'Temporary Venue', 40.4450, -79.9410, true);

insert into public.venues (id, external_id, source, name)
values ('20000000-0000-0000-0000-000000000099', 'cmu:active', 'cmu', 'Updated Venue')
on conflict (external_id) do update set name = excluded.name;

select is(
  (select count(*) from public.venues where external_id = 'cmu:active'),
  1::bigint,
  'external venue IDs support idempotent upserts'
);

select is(
  (select name from public.venues where external_id = 'cmu:active'),
  'Updated Venue',
  'an external venue upsert updates the existing row'
);

insert into public.menus (id, user_id, restaurant_name, source_type)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Legacy Solo Menu', 'text');

insert into public.menus (
  id,
  venue_id,
  restaurant_name,
  source_type,
  source_provider,
  content_hash,
  version,
  observed_at
)
values (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'Shared Menu',
  'image',
  'upload',
  'menu-hash-1',
  1,
  now()
);

insert into public.menus (
  id,
  venue_id,
  restaurant_name,
  source_type,
  source_provider,
  content_hash,
  version
)
values (
  '30000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  'Duplicate Content',
  'image',
  'upload',
  'menu-hash-1',
  2
)
on conflict do nothing;

insert into public.menus (
  id,
  venue_id,
  restaurant_name,
  source_type,
  source_provider,
  content_hash,
  version
)
values (
  '30000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001',
  'Duplicate Version',
  'image',
  'upload',
  'menu-hash-2',
  1
)
on conflict do nothing;

select is(
  (select count(*) from public.menus where venue_id = '20000000-0000-0000-0000-000000000001'),
  1::bigint,
  'shared menu content hashes and versions are unique per venue'
);

select is(
  (select count(*) from public.menus where id = '30000000-0000-0000-0000-000000000001' and venue_id is null),
  1::bigint,
  'legacy solo menus remain valid without venue metadata'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*) from public.venues),
  2::bigint,
  'anonymous clients can read only active venues'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    insert into public.friendships (requester_id, addressee_id)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
  $$,
  '42501'
);

select lives_ok(
  $$
    insert into public.friendships (id, requester_id, addressee_id)
    values (
      '40000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'a user can request a friendship'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

update public.friendships
set status = 'accepted'
where id = '40000000-0000-0000-0000-000000000001';

select is(
  (select status from public.friendships where id = '40000000-0000-0000-0000-000000000001'),
  'accepted',
  'the addressee can accept a friendship'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

insert into public.friendships (requester_id, addressee_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

select is(
  (
    select count(*)
    from public.friendships
    where least(requester_id, addressee_id) = '00000000-0000-0000-0000-000000000001'
      and greatest(requester_id, addressee_id) = '00000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'reversed friendships cannot create a duplicate relationship'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.friendships (id, requester_id, addressee_id)
values (
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    update public.friendships
    set status = 'accepted'
    where id = '40000000-0000-0000-0000-000000000002'
  $$,
  'an outsider update is filtered by RLS'
);

reset role;

select is(
  (select status from public.friendships where id = '40000000-0000-0000-0000-000000000002'),
  'pending',
  'an outsider cannot accept another user friendship request'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

update public.friendships
set status = 'accepted'
where id = '40000000-0000-0000-0000-000000000002';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.friendships (id, requester_id, addressee_id)
values (
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

update public.friendships
set status = 'accepted'
where id = '40000000-0000-0000-0000-000000000003';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.group_sessions (id, creator_id, name)
values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Friday dinner'
);

select is(
  (
    select count(*)
    from public.group_session_members
    where session_id = '50000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000001'
      and status = 'accepted'
  ),
  1::bigint,
  'creating a session automatically creates an accepted creator membership'
);

insert into public.group_session_members (session_id, user_id, invited_by)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001'
  );

select throws_ok(
  $$
    insert into public.group_session_members (session_id, user_id, invited_by)
    values (
      '50000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501'
);

insert into public.group_session_candidates (session_id, venue_id, added_by)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.group_session_meal_preferences (session_id, user_id, preference_state)
values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"dietaryRestrictions":["vegetarian"]}'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

update public.group_session_members
set status = 'accepted'
where session_id = '50000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';

insert into public.group_session_meal_preferences (session_id, user_id, preference_state)
values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '{"maxPrice":20}'
);

update public.group_session_meal_preferences
set state_version = 2,
    preference_state = '{"maxPrice":25}'
where session_id = '50000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';

select is(
  (
    select state_version
    from public.group_session_meal_preferences
    where session_id = '50000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000002'
  ),
  2,
  'an accepted member can update their own temporary meal state'
);

select is(
  (select count(*) from public.group_sessions where id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an accepted member can read the session'
);

select is(
  (select count(*) from public.group_session_members where session_id = '50000000-0000-0000-0000-000000000001'),
  4::bigint,
  'an accepted member can read the roster'
);

select is(
  (select count(*) from public.group_session_candidates where session_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an accepted member can read candidates'
);

select is(
  (select count(*) from public.group_session_meal_preferences where session_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'a member can read only their own temporary meal state'
);

select is(
  (select count(*) from public.ratings),
  1::bigint,
  'a member cannot read another user rating history'
);

select is(
  (select count(*) from public.taste_profiles),
  1::bigint,
  'a member cannot read another user taste profile'
);

select throws_ok(
  $$
    insert into public.group_session_candidates (session_id, venue_id, added_by)
    values (
      '50000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501'
);

select throws_ok(
  $$
    insert into public.group_recommendation_results (
      session_id,
      algorithm_version,
      input_hash,
      result_snapshot,
      computed_by
    ) values (
      '50000000-0000-0000-0000-000000000001',
      'group-v1',
      'client-write',
      '{"winner":"forbidden"}',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501'
);

reset role;

insert into public.group_recommendation_results (
  id,
  session_id,
  algorithm_version,
  input_hash,
  result_snapshot,
  computed_by
)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'group-v1',
  'server-compute-1',
  '{"winnerVenueId":"20000000-0000-0000-0000-000000000001"}',
  '00000000-0000-0000-0000-000000000005'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.group_recommendation_results where session_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'accepted members can read server-created derived results'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.group_sessions where id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an invitee can read the session summary'
);

select is(
  (select count(*) from public.group_session_members where session_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an invitee can read only their own invitation'
);

select is(
  (select count(*) from public.group_session_candidates where session_id = '50000000-0000-0000-0000-000000000001'),
  0::bigint,
  'an invitee cannot read candidates before accepting'
);

select is(
  (select count(*) from public.group_recommendation_results where session_id = '50000000-0000-0000-0000-000000000001'),
  0::bigint,
  'an invitee cannot read results before accepting'
);

select throws_ok(
  $$
    insert into public.group_session_meal_preferences (session_id, user_id, preference_state)
    values (
      '50000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000003',
      '{}'
    )
  $$,
  '42501'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

update public.group_session_members
set status = 'declined'
where session_id = '50000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000004';

select is(
  (select count(*) from public.group_sessions where id = '50000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a declined member can no longer read the session'
);

select is(
  (select count(*) from public.group_session_members where session_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'a declined member can read only their own terminal membership status'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.group_sessions),
  0::bigint,
  'an outsider cannot read group sessions'
);

select is(
  (select count(*) from public.group_session_members),
  0::bigint,
  'an outsider cannot read group membership rows'
);

select is(
  (select count(*) from public.group_session_candidates),
  0::bigint,
  'an outsider cannot read group candidates'
);

select is(
  (select count(*) from public.group_recommendation_results),
  0::bigint,
  'an outsider cannot read derived group results'
);

reset role;

insert into public.group_sessions (id, creator_id, name)
values (
  '50000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000006',
  'Cascade test'
);

insert into public.group_session_meal_preferences (session_id, user_id, preference_state)
values (
  '50000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000006',
  '{}'
);

insert into public.group_recommendation_results (
  id,
  session_id,
  algorithm_version,
  input_hash,
  result_snapshot,
  computed_by
)
values (
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000002',
  'group-v1',
  'cascade-test',
  '{}',
  '00000000-0000-0000-0000-000000000006'
);

delete from public.group_sessions where id = '50000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.group_session_members where session_id = '50000000-0000-0000-0000-000000000002'),
  0::bigint,
  'deleting a session cascades to memberships'
);

select is(
  (select count(*) from public.group_session_meal_preferences where session_id = '50000000-0000-0000-0000-000000000002'),
  0::bigint,
  'deleting a session cascades to meal state'
);

select is(
  (select count(*) from public.group_recommendation_results where session_id = '50000000-0000-0000-0000-000000000002'),
  0::bigint,
  'deleting a session cascades to result snapshots'
);

insert into public.friendships (id, requester_id, addressee_id)
values (
  '40000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000005'
);

delete from auth.users where id = '00000000-0000-0000-0000-000000000005';

select is(
  (select count(*) from public.friendships where id = '40000000-0000-0000-0000-000000000005'),
  0::bigint,
  'deleting a user cascades to friendships'
);

select is(
  (select count(*) from public.group_recommendation_results where id = '60000000-0000-0000-0000-000000000001'),
  1::bigint,
  'deleting a computing user preserves the derived result snapshot'
);

select is(
  (select computed_by from public.group_recommendation_results where id = '60000000-0000-0000-0000-000000000001'),
  null::uuid,
  'deleting a computing user clears only the result attribution'
);

insert into public.menus (
  id,
  venue_id,
  restaurant_name,
  source_type,
  source_provider,
  content_hash,
  version
)
values (
  '30000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000003',
  'Venue deletion test',
  'text',
  'cmu',
  'temporary-menu',
  1
);

insert into public.group_session_candidates (session_id, venue_id, added_by)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001'
);

delete from public.venues where id = '20000000-0000-0000-0000-000000000003';

select is(
  (select venue_id from public.menus where id = '30000000-0000-0000-0000-000000000005'),
  null::uuid,
  'deleting a venue preserves shared menu history with a null venue reference'
);

select is(
  (
    select count(*)
    from public.group_session_candidates
    where session_id = '50000000-0000-0000-0000-000000000001'
      and venue_id = '20000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'deleting a venue removes it from session candidates'
);

select is(
  (select count(*) from public.group_recommendation_results where id = '60000000-0000-0000-0000-000000000001'),
  1::bigint,
  'venue deletion does not remove a historical derived result snapshot'
);

select * from finish();
rollback;
