create schema if not exists private;

revoke all on schema private from public;

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  source text not null check (btrim(source) <> ''),
  name text not null check (btrim(name) <> ''),
  address_label text,
  latitude double precision,
  longitude double precision,
  hours jsonb not null default '{}'::jsonb check (jsonb_typeof(hours) in ('object', 'array')),
  menu_url text,
  specials jsonb not null default '[]'::jsonb check (jsonb_typeof(specials) in ('object', 'array')),
  soups jsonb not null default '[]'::jsonb check (jsonb_typeof(soups) in ('object', 'array')),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  content_hash text,
  source_updated_at timestamptz,
  synced_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_coordinates_are_paired check ((latitude is null) = (longitude is null)),
  constraint venues_latitude_bounds check (latitude is null or latitude between -90 and 90),
  constraint venues_longitude_bounds check (longitude is null or longitude between -180 and 180)
);

alter table public.menus
  add column venue_id uuid references public.venues(id) on delete set null,
  add column source_provider text,
  add column source_uri text,
  add column source_metadata jsonb not null default '{}'::jsonb,
  add column content_hash text,
  add column version integer,
  add column observed_at timestamptz,
  add column valid_from timestamptz,
  add column valid_until timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint menus_source_metadata_is_object check (jsonb_typeof(source_metadata) = 'object'),
  add constraint menus_version_is_positive check (version is null or version > 0),
  add constraint menus_validity_range check (valid_from is null or valid_until is null or valid_until > valid_from);

create unique index menus_venue_content_hash_uidx
  on public.menus(venue_id, content_hash)
  where venue_id is not null and content_hash is not null;

create unique index menus_venue_version_uidx
  on public.menus(venue_id, version)
  where venue_id is not null and version is not null;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct_users check (requester_id <> addressee_id),
  constraint friendships_response_timestamp check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted', 'rejected') and responded_at is not null)
  )
);

create unique index friendships_unordered_pair_uidx
  on public.friendships(least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_requester_idx on public.friendships(requester_id);
create index friendships_addressee_idx on public.friendships(addressee_id);

create table public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  name text check (name is null or btrim(name) <> ''),
  scheduled_for timestamptz,
  status text not null default 'planning' check (status in ('planning', 'decided', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index group_sessions_creator_idx on public.group_sessions(creator_id);

create table public.group_session_members (
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  invited_by uuid references public.users(id) on delete set null,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  constraint group_session_members_status_timestamps check (
    (status = 'invited' and accepted_at is null and declined_at is null)
    or (status = 'accepted' and accepted_at is not null and declined_at is null)
    or (status = 'declined' and accepted_at is null and declined_at is not null)
  )
);

create index group_session_members_user_idx on public.group_session_members(user_id, status);

create table public.group_session_candidates (
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  added_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, venue_id)
);

create index group_session_candidates_venue_idx on public.group_session_candidates(venue_id);

create table public.group_session_meal_preferences (
  session_id uuid not null,
  user_id uuid not null,
  state_version integer not null default 1 check (state_version > 0),
  preference_state jsonb not null default '{}'::jsonb check (jsonb_typeof(preference_state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  foreign key (session_id, user_id)
    references public.group_session_members(session_id, user_id)
    on delete cascade
);

create table public.group_recommendation_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  algorithm_version text not null check (btrim(algorithm_version) <> ''),
  input_hash text not null check (btrim(input_hash) <> ''),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  computed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, algorithm_version, input_hash)
);

create index group_recommendation_results_session_created_idx
  on public.group_recommendation_results(session_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_group_session_creator(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_sessions
    where id = target_session_id
      and creator_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_group_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_sessions
    where id = target_session_id
      and creator_id = (select auth.uid())
  ) or exists (
    select 1
    from public.group_session_members
    where session_id = target_session_id
      and user_id = (select auth.uid())
      and status in ('invited', 'accepted')
  );
$$;

create or replace function private.is_accepted_group_session_member(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_session_members
    where session_id = target_session_id
      and user_id = (select auth.uid())
      and status = 'accepted'
  );
$$;

create or replace function private.are_accepted_friends(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships
    where least(requester_id, addressee_id) = least(first_user_id, second_user_id)
      and greatest(requester_id, addressee_id) = greatest(first_user_id, second_user_id)
      and status = 'accepted'
  );
$$;

create or replace function private.add_group_session_creator_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_session_members (
    session_id,
    user_id,
    invited_by,
    status,
    accepted_at
  ) values (
    new.id,
    new.creator_id,
    new.creator_id,
    'accepted',
    now()
  );
  return new;
end;
$$;

create or replace function private.guard_friendship_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and (select auth.uid()) is not null then
      raise exception 'friendships must begin as pending' using errcode = '23514';
    end if;

    if new.status = 'pending' then
      new.responded_at = null;
    elsif new.responded_at is null then
      new.responded_at = now();
    end if;

    return new;
  end if;

  if new.requester_id is distinct from old.requester_id
    or new.addressee_id is distinct from old.addressee_id
    or new.created_at is distinct from old.created_at then
    raise exception 'friendship participants and creation time are immutable' using errcode = '23514';
  end if;

  if old.status <> 'pending' or new.status not in ('accepted', 'rejected') then
    raise exception 'invalid friendship status transition' using errcode = '23514';
  end if;

  if (select auth.uid()) is not null and (select auth.uid()) <> old.addressee_id then
    raise exception 'only the addressee may respond to a friendship' using errcode = '42501';
  end if;

  new.responded_at = now();
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.guard_group_member_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_creator_id uuid;
begin
  if tg_op = 'INSERT' then
    select creator_id
    into session_creator_id
    from public.group_sessions
    where id = new.session_id;
  else
    select creator_id
    into session_creator_id
    from public.group_sessions
    where id = old.session_id;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id = session_creator_id then
      new.status = 'accepted';
      new.accepted_at = coalesce(new.accepted_at, now());
      new.declined_at = null;
    elsif new.status <> 'invited' then
      raise exception 'non-creator memberships must begin as invited' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.session_id is distinct from old.session_id
    or new.user_id is distinct from old.user_id
    or new.invited_by is distinct from old.invited_by
    or new.created_at is distinct from old.created_at then
    raise exception 'membership identity and invitation fields are immutable' using errcode = '23514';
  end if;

  if old.user_id = session_creator_id and new.status is distinct from old.status then
    raise exception 'the session creator must remain accepted' using errcode = '23514';
  end if;

  if old.status <> 'invited' or new.status not in ('accepted', 'declined') then
    raise exception 'invalid membership status transition' using errcode = '23514';
  end if;

  if (select auth.uid()) is not null and (select auth.uid()) <> old.user_id then
    raise exception 'only the invited user may respond to an invitation' using errcode = '42501';
  end if;

  if new.status = 'accepted' then
    new.accepted_at = now();
    new.declined_at = null;
  else
    new.accepted_at = null;
    new.declined_at = now();
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger venues_set_updated_at
before update on public.venues
for each row execute function private.set_updated_at();

create trigger menus_set_updated_at
before update on public.menus
for each row execute function private.set_updated_at();

create trigger group_sessions_set_updated_at
before update on public.group_sessions
for each row execute function private.set_updated_at();

create trigger group_session_meal_preferences_set_updated_at
before update on public.group_session_meal_preferences
for each row execute function private.set_updated_at();

create trigger friendships_guard_transition
before insert or update on public.friendships
for each row execute function private.guard_friendship_transition();

create trigger group_session_members_guard_transition
before insert or update on public.group_session_members
for each row execute function private.guard_group_member_transition();

create trigger group_sessions_add_creator_membership
after insert on public.group_sessions
for each row execute function private.add_group_session_creator_membership();

alter table public.venues enable row level security;
alter table public.friendships enable row level security;
alter table public.group_sessions enable row level security;
alter table public.group_session_members enable row level security;
alter table public.group_session_candidates enable row level security;
alter table public.group_session_meal_preferences enable row level security;
alter table public.group_recommendation_results enable row level security;

revoke all on table public.venues from anon, authenticated;
revoke all on table public.friendships from anon, authenticated;
revoke all on table public.group_sessions from anon, authenticated;
revoke all on table public.group_session_members from anon, authenticated;
revoke all on table public.group_session_candidates from anon, authenticated;
revoke all on table public.group_session_meal_preferences from anon, authenticated;
revoke all on table public.group_recommendation_results from anon, authenticated;

grant select on table public.venues to anon, authenticated;
grant select, insert, update on table public.friendships to authenticated;
grant select, insert, update, delete on table public.group_sessions to authenticated;
grant select, insert, update, delete on table public.group_session_members to authenticated;
grant select, insert, delete on table public.group_session_candidates to authenticated;
grant select, insert, update, delete on table public.group_session_meal_preferences to authenticated;
grant select on table public.group_recommendation_results to authenticated;

grant all on table public.venues to service_role;
grant all on table public.friendships to service_role;
grant all on table public.group_sessions to service_role;
grant all on table public.group_session_members to service_role;
grant all on table public.group_session_candidates to service_role;
grant all on table public.group_session_meal_preferences to service_role;
grant all on table public.group_recommendation_results to service_role;

revoke all on function private.set_updated_at() from public;
revoke all on function private.is_group_session_creator(uuid) from public;
revoke all on function private.can_view_group_session(uuid) from public;
revoke all on function private.is_accepted_group_session_member(uuid) from public;
revoke all on function private.are_accepted_friends(uuid, uuid) from public;
revoke all on function private.add_group_session_creator_membership() from public;
revoke all on function private.guard_friendship_transition() from public;
revoke all on function private.guard_group_member_transition() from public;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_group_session_creator(uuid) to authenticated, service_role;
grant execute on function private.can_view_group_session(uuid) to authenticated, service_role;
grant execute on function private.is_accepted_group_session_member(uuid) to authenticated, service_role;
grant execute on function private.are_accepted_friends(uuid, uuid) to authenticated, service_role;

create policy "Active venues are publicly readable"
on public.venues
for select
to anon, authenticated
using (is_active);

create policy "Friendship participants can read"
on public.friendships
for select
to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create policy "Users can request friendships"
on public.friendships
for insert
to authenticated
with check (
  (select auth.uid()) = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
);

create policy "Addressees can respond to pending friendships"
on public.friendships
for update
to authenticated
using ((select auth.uid()) = addressee_id and status = 'pending')
with check ((select auth.uid()) = addressee_id and status in ('accepted', 'rejected'));

create policy "Participants can read their sessions"
on public.group_sessions
for select
to authenticated
using ((select private.can_view_group_session(id)));

create policy "Users can create their own sessions"
on public.group_sessions
for insert
to authenticated
with check ((select auth.uid()) = creator_id);

create policy "Creators can update their sessions"
on public.group_sessions
for update
to authenticated
using ((select private.is_group_session_creator(id)))
with check ((select auth.uid()) = creator_id);

create policy "Creators can delete their sessions"
on public.group_sessions
for delete
to authenticated
using ((select private.is_group_session_creator(id)));

create policy "Members can read the appropriate roster"
on public.group_session_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_accepted_group_session_member(session_id))
);

create policy "Creators can invite accepted friends"
on public.group_session_members
for insert
to authenticated
with check (
  (select private.is_group_session_creator(session_id))
  and invited_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and status = 'invited'
  and (select private.are_accepted_friends((select auth.uid()), user_id))
);

create policy "Invitees can respond to their invitation"
on public.group_session_members
for update
to authenticated
using (user_id = (select auth.uid()) and status = 'invited')
with check (user_id = (select auth.uid()) and status in ('accepted', 'declined'));

create policy "Creators can remove non-creator memberships"
on public.group_session_members
for delete
to authenticated
using (
  (select private.is_group_session_creator(session_id))
  and user_id <> (select auth.uid())
);

create policy "Accepted members can read candidates"
on public.group_session_candidates
for select
to authenticated
using ((select private.is_accepted_group_session_member(session_id)));

create policy "Creators can add candidates"
on public.group_session_candidates
for insert
to authenticated
with check (
  (select private.is_group_session_creator(session_id))
  and added_by = (select auth.uid())
);

create policy "Creators can remove candidates"
on public.group_session_candidates
for delete
to authenticated
using ((select private.is_group_session_creator(session_id)));

create policy "Members can read their own meal state"
on public.group_session_meal_preferences
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_accepted_group_session_member(session_id))
);

create policy "Members can create their own meal state"
on public.group_session_meal_preferences
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_accepted_group_session_member(session_id))
);

create policy "Members can update their own meal state"
on public.group_session_meal_preferences
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_accepted_group_session_member(session_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_accepted_group_session_member(session_id))
);

create policy "Members can delete their own meal state"
on public.group_session_meal_preferences
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_accepted_group_session_member(session_id))
);

create policy "Accepted members can read group results"
on public.group_recommendation_results
for select
to authenticated
using ((select private.is_accepted_group_session_member(session_id)));
