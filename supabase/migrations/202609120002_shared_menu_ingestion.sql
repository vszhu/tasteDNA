-- Task 4: atomic, versioned shared-menu ingestion and current-menu reads.

alter table public.dishes
  add column ranking_embedding jsonb,
  add column ranking_embedding_model text,
  add column content_hash text,
  add constraint dishes_ranking_embedding_is_array check (
    ranking_embedding is null or jsonb_typeof(ranking_embedding) = 'array'
  );

alter table public.menu_items
  add column category text;

create index menus_current_venue_version_idx
  on public.menus (venue_id, version desc)
  where venue_id is not null and valid_until is null;

create or replace function public.ingest_shared_menu(
  p_venue_id uuid,
  p_uploaded_by uuid,
  p_restaurant_name text,
  p_source_type text,
  p_source_provider text,
  p_source_uri text,
  p_source_metadata jsonb,
  p_currency text,
  p_content_hash text,
  p_observed_at timestamptz,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_menu_id uuid;
  v_existing_version integer;
  v_existing_valid_until timestamptz;
  v_menu_id uuid;
  v_version integer;
  v_item jsonb;
  v_dish jsonb;
  v_features jsonb;
  v_dish_id uuid;
begin
  if p_uploaded_by is null or not exists (
    select 1 from public.users where id = p_uploaded_by
  ) then
    raise exception 'a valid uploader is required' using errcode = '23503';
  end if;

  perform 1
  from public.venues
  where id = p_venue_id and is_active
  for update;
  if not found then
    raise exception 'an active venue is required' using errcode = '42501';
  end if;

  if p_source_type not in ('image', 'text')
    or p_source_provider is null or btrim(p_source_provider) = ''
    or p_currency !~ '^[A-Z]{3}$'
    or p_content_hash !~ '^[0-9a-f]{64}$'
    or p_observed_at is null
    or jsonb_typeof(p_source_metadata) <> 'object'
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid shared menu input' using errcode = '22023';
  end if;

  select id, version, valid_until
  into v_existing_menu_id, v_existing_version, v_existing_valid_until
  from public.menus
  where venue_id = p_venue_id and content_hash = p_content_hash;

  if v_existing_menu_id is not null then
    if v_existing_valid_until is null then
      update public.menus
      set
        observed_at = greatest(observed_at, p_observed_at),
        source_metadata = source_metadata || p_source_metadata,
        updated_at = now()
      where id = v_existing_menu_id;
    end if;

    return jsonb_build_object(
      'menuId', v_existing_menu_id,
      'version', v_existing_version,
      'created', false
    );
  end if;

  select coalesce(max(version), 0) + 1
  into v_version
  from public.menus
  where venue_id = p_venue_id;

  update public.menus
  set valid_until = greatest(
    p_observed_at,
    coalesce(valid_from, p_observed_at - interval '1 microsecond') + interval '1 microsecond'
  )
  where venue_id = p_venue_id and valid_until is null;

  insert into public.menus (
    user_id,
    venue_id,
    restaurant_name,
    source_type,
    currency,
    source_provider,
    source_uri,
    source_metadata,
    content_hash,
    version,
    observed_at,
    valid_from,
    valid_until
  ) values (
    p_uploaded_by,
    p_venue_id,
    nullif(btrim(p_restaurant_name), ''),
    p_source_type,
    p_currency,
    p_source_provider,
    p_source_uri,
    p_source_metadata,
    p_content_hash,
    v_version,
    p_observed_at,
    p_observed_at,
    null
  )
  returning id into v_menu_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_dish := v_item -> 'dish';
    v_features := v_dish -> 'features';

    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_dish) <> 'object'
      or jsonb_typeof(v_features) <> 'object'
      or nullif(btrim(v_dish ->> 'name'), '') is null
      or jsonb_typeof(v_dish -> 'ingredients') <> 'array'
      or jsonb_typeof(v_dish -> 'rankingEmbedding') <> 'array' then
      raise exception 'invalid shared menu item' using errcode = '22023';
    end if;

    insert into public.dishes (
      name,
      description,
      cuisine,
      ingredients,
      normalized_embedding_text,
      embedding_model,
      ranking_embedding,
      ranking_embedding_model,
      content_hash
    ) values (
      v_dish ->> 'name',
      coalesce(v_dish ->> 'description', ''),
      coalesce(nullif(v_dish ->> 'cuisine', ''), 'Unknown'),
      v_dish -> 'ingredients',
      v_dish ->> 'normalizedEmbeddingText',
      v_dish ->> 'embeddingModel',
      v_dish -> 'rankingEmbedding',
      v_dish ->> 'embeddingModel',
      v_dish ->> 'contentHash'
    )
    returning id into v_dish_id;

    insert into public.dish_features (
      dish_id,
      sweet,
      salty,
      sour,
      bitter,
      umami,
      spicy,
      rich,
      fresh,
      crispy,
      creamy,
      chewy,
      smoky,
      cuisines,
      major_ingredients,
      protein_types,
      carbohydrate_types,
      cooking_methods,
      confidence,
      unknown_fields
    ) values (
      v_dish_id,
      (v_features ->> 'sweet')::real,
      (v_features ->> 'salty')::real,
      (v_features ->> 'sour')::real,
      (v_features ->> 'bitter')::real,
      (v_features ->> 'umami')::real,
      (v_features ->> 'spicy')::real,
      (v_features ->> 'rich')::real,
      (v_features ->> 'fresh')::real,
      (v_features ->> 'crispy')::real,
      (v_features ->> 'creamy')::real,
      (v_features ->> 'chewy')::real,
      (v_features ->> 'smoky')::real,
      array(select jsonb_array_elements_text(v_features -> 'cuisines')),
      array(select jsonb_array_elements_text(v_features -> 'majorIngredients')),
      array(select jsonb_array_elements_text(v_features -> 'proteinTypes')),
      array(select jsonb_array_elements_text(v_features -> 'carbohydrateTypes')),
      array(select jsonb_array_elements_text(v_features -> 'cookingMethods')),
      case
        when jsonb_typeof(v_features -> 'confidence') = 'number'
          then (v_features ->> 'confidence')::real
        else null
      end,
      array(select jsonb_array_elements_text(v_features -> 'unknownFields'))
    );

    insert into public.menu_items (
      menu_id,
      dish_id,
      menu_order,
      price,
      category
    ) values (
      v_menu_id,
      v_dish_id,
      (v_item ->> 'menuOrder')::integer,
      case
        when jsonb_typeof(v_item -> 'price') = 'number'
          then (v_item ->> 'price')::numeric
        else null
      end,
      nullif(v_item ->> 'category', '')
    );
  end loop;

  return jsonb_build_object(
    'menuId', v_menu_id,
    'version', v_version,
    'created', true
  );
end;
$$;

revoke all on function public.ingest_shared_menu(
  uuid, uuid, text, text, text, text, jsonb, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_shared_menu(
  uuid, uuid, text, text, text, text, jsonb, text, text, timestamptz, jsonb
) to service_role;

drop policy if exists "Users can manage their own menus" on public.menus;
drop policy if exists "Menu items follow menu access" on public.menu_items;

create policy "Owners can read private menus"
on public.menus for select to authenticated
using (user_id = (select auth.uid()));

create policy "Owners can create private menus"
on public.menus for insert to authenticated
with check (user_id = (select auth.uid()) and venue_id is null);

create policy "Owners can update private menus"
on public.menus for update to authenticated
using (user_id = (select auth.uid()) and venue_id is null)
with check (user_id = (select auth.uid()) and venue_id is null);

create policy "Owners can delete private menus"
on public.menus for delete to authenticated
using (user_id = (select auth.uid()) and venue_id is null);

create policy "Shared menus are publicly readable"
on public.menus for select to anon, authenticated
using (
  venue_id is not null
  and exists (
    select 1 from public.venues
    where venues.id = menus.venue_id and venues.is_active
  )
);

create policy "Owners can read private menu items"
on public.menu_items for select to authenticated
using (
  exists (
    select 1 from public.menus
    where menus.id = menu_items.menu_id
      and menus.user_id = (select auth.uid())
  )
);

create policy "Owners can create private menu items"
on public.menu_items for insert to authenticated
with check (
  exists (
    select 1 from public.menus
    where menus.id = menu_items.menu_id
      and menus.user_id = (select auth.uid())
      and menus.venue_id is null
  )
);

create policy "Owners can update private menu items"
on public.menu_items for update to authenticated
using (
  exists (
    select 1 from public.menus
    where menus.id = menu_items.menu_id
      and menus.user_id = (select auth.uid())
      and menus.venue_id is null
  )
)
with check (
  exists (
    select 1 from public.menus
    where menus.id = menu_items.menu_id
      and menus.user_id = (select auth.uid())
      and menus.venue_id is null
  )
);

create policy "Owners can delete private menu items"
on public.menu_items for delete to authenticated
using (
  exists (
    select 1 from public.menus
    where menus.id = menu_items.menu_id
      and menus.user_id = (select auth.uid())
      and menus.venue_id is null
  )
);

create policy "Shared menu items are publicly readable"
on public.menu_items for select to anon, authenticated
using (
  exists (
    select 1 from public.menus
    join public.venues on venues.id = menus.venue_id
    where menus.id = menu_items.menu_id and venues.is_active
  )
);

revoke all on table public.menus, public.menu_items from anon, authenticated;
grant select on table public.menus, public.menu_items to anon;
grant select, insert, update, delete on table public.menus, public.menu_items to authenticated;
grant select on table public.dishes, public.dish_features to anon, authenticated;

grant all on table public.menus, public.menu_items, public.dishes, public.dish_features to service_role;
