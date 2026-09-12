begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function(
  'public',
  'request_friendship_by_email',
  array['uuid', 'text'],
  'privacy-preserving friendship request function exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.request_friendship_by_email(uuid,text)',
    'EXECUTE'
  ),
  false,
  'authenticated browser clients cannot invoke the email lookup directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.request_friendship_by_email(uuid,text)',
    'EXECUTE'
  ),
  true,
  'server-side service-role code can invoke the email lookup'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '71000000-0000-0000-0000-000000000001',
    'requester@example.test',
    '{"display_name":"Requester"}'
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'friend@example.test',
    '{"display_name":"Friend"}'
  );

select is(
  public.request_friendship_by_email(
    '71000000-0000-0000-0000-000000000001',
    '  FRIEND@example.test '
  ),
  'created',
  'email lookup is normalized and creates a pending request'
);

select is(
  (
    select status
    from public.friendships
    where requester_id = '71000000-0000-0000-0000-000000000001'
      and addressee_id = '71000000-0000-0000-0000-000000000002'
  ),
  'pending',
  'the resolved account becomes the addressee'
);

select is(
  public.request_friendship_by_email(
    '71000000-0000-0000-0000-000000000001',
    'friend@example.test'
  ),
  'existing',
  'duplicate requests do not create another row'
);

select is(
  public.request_friendship_by_email(
    '71000000-0000-0000-0000-000000000002',
    'requester@example.test'
  ),
  'existing',
  'reversed requests do not create another row'
);

select is(
  (
    select count(*)
    from public.friendships
    where least(requester_id, addressee_id) = '71000000-0000-0000-0000-000000000001'
      and greatest(requester_id, addressee_id) = '71000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'duplicate and reversed requests leave one relationship'
);

select is(
  public.request_friendship_by_email(
    '71000000-0000-0000-0000-000000000001',
    'requester@example.test'
  ),
  'self',
  'self requests are rejected'
);

select is(
  public.request_friendship_by_email(
    '71000000-0000-0000-0000-000000000001',
    'unknown@example.test'
  ),
  'not-found',
  'an unknown email does not create a relationship'
);

select is(
  (
    select count(*)
    from public.friendships
    where requester_id = '71000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'unknown and duplicate requests do not add rows'
);

select * from finish();
rollback;

