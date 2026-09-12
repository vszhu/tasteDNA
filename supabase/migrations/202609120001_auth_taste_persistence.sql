-- Task 3: email auth bootstrap and account-scoped TasteDNA persistence.
-- Anonymous TasteDNA remains browser-only and never writes to these tables.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

insert into public.users (id, display_name)
select
  auth_user.id,
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), '')
  )
from auth.users as auth_user
on conflict (id) do nothing;

alter table public.ratings
  alter column dish_id drop not null,
  add column if not exists client_id text,
  add column if not exists client_dish_id text,
  add column if not exists dish_snapshot jsonb;

update public.ratings
set
  client_id = coalesce(client_id, id::text),
  client_dish_id = coalesce(client_dish_id, dish_id::text)
where client_id is null or client_dish_id is null;

alter table public.ratings
  alter column client_id set not null,
  alter column client_dish_id set not null,
  add constraint ratings_client_id_not_blank check (length(trim(client_id)) > 0),
  add constraint ratings_client_dish_id_not_blank check (length(trim(client_dish_id)) > 0),
  add constraint ratings_dish_snapshot_is_object check (
    dish_snapshot is null or jsonb_typeof(dish_snapshot) = 'object'
  );

create unique index ratings_user_client_dish_uidx
  on public.ratings (user_id, client_dish_id);

alter table public.taste_profiles
  add column if not exists profile_state jsonb not null default '{}'::jsonb,
  add column if not exists state_version integer not null default 1;

alter table public.taste_profiles
  add constraint taste_profiles_profile_state_is_object check (
    jsonb_typeof(profile_state) = 'object'
  ),
  add constraint taste_profiles_profile_state_owner check (
    profile_state = '{}'::jsonb or profile_state ->> 'userId' = user_id::text
  ),
  add constraint taste_profiles_state_version_positive check (state_version > 0);

revoke all on table public.users, public.ratings, public.taste_profiles from anon;
revoke all on table public.users, public.ratings, public.taste_profiles from authenticated;

grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.ratings to authenticated;
grant select, insert, update, delete on table public.taste_profiles to authenticated;
