begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'ratings', 'client_id', 'ratings preserve application IDs');
select has_column('public', 'ratings', 'client_dish_id', 'ratings preserve application dish IDs');
select has_column('public', 'ratings', 'dish_snapshot', 'ratings may carry a custom dish snapshot');
select has_column('public', 'taste_profiles', 'profile_state', 'profiles preserve the complete app contract');
select has_column('public', 'taste_profiles', 'state_version', 'profile JSON is versioned');

insert into auth.users (id, email, raw_user_meta_data)
values (
  '90000000-0000-0000-0000-000000000001',
  'magic-link@example.test',
  '{"display_name":"Magic Link User"}'::jsonb
);

select is(
  (select display_name from public.users where id = '90000000-0000-0000-0000-000000000001'),
  'Magic Link User',
  'creating an Auth user bootstraps its public user row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into public.ratings (
      user_id, client_id, client_dish_id, dish_snapshot, value, source
    ) values (
      '90000000-0000-0000-0000-000000000001',
      'rating-seed-ramen',
      'seed-ramen',
      null,
      5,
      'onboarding'
    )
  $$,
  'a signed-in user can store an app rating without a canonical dish UUID'
);

select lives_ok(
  $$
    insert into public.taste_profiles (user_id, profile_state, state_version)
    values (
      '90000000-0000-0000-0000-000000000001',
      '{"id":"profile-test","userId":"90000000-0000-0000-0000-000000000001"}'::jsonb,
      1
    )
  $$,
  'a signed-in user can store versioned profile JSON'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select is((select count(*) from public.ratings), 0::bigint, 'anonymous users cannot read ratings');
select is((select count(*) from public.taste_profiles), 0::bigint, 'anonymous users cannot read profiles');

select * from finish();
rollback;
