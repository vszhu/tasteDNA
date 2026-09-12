create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cuisine text not null default 'Unknown',
  ingredients jsonb not null default '[]'::jsonb,
  embedding vector(1536),
  normalized_embedding_text text,
  embedding_model text,
  created_at timestamptz not null default now()
);

create table if not exists public.dish_features (
  dish_id uuid primary key references public.dishes(id) on delete cascade,
  sweet real not null check (sweet between 0 and 1),
  salty real not null check (salty between 0 and 1),
  sour real not null check (sour between 0 and 1),
  bitter real not null check (bitter between 0 and 1),
  umami real not null check (umami between 0 and 1),
  spicy real not null check (spicy between 0 and 1),
  rich real not null check (rich between 0 and 1),
  fresh real not null check (fresh between 0 and 1),
  crispy real not null check (crispy between 0 and 1),
  creamy real not null check (creamy between 0 and 1),
  chewy real not null check (chewy between 0 and 1),
  smoky real not null check (smoky between 0 and 1),
  cuisines text[] not null default '{}',
  major_ingredients text[] not null default '{}',
  protein_types text[] not null default '{}',
  carbohydrate_types text[] not null default '{}',
  cooking_methods text[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  unknown_fields text[] not null default '{}'
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  value smallint not null check (value between 1 and 5),
  source text not null check (source in ('onboarding', 'feedback')),
  created_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

create table if not exists public.taste_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  semantic_vector vector(1536),
  attribute_preferences jsonb not null default '{}'::jsonb,
  cuisine_preferences jsonb not null default '{}'::jsonb,
  cooking_method_preferences jsonb not null default '{}'::jsonb,
  rating_count integer not null default 0,
  confidence text not null default 'early read',
  updated_at timestamptz not null default now()
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  restaurant_name text,
  source_type text not null check (source_type in ('image', 'text', 'demo')),
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  menu_order integer not null,
  price numeric(10, 2),
  unique (menu_id, menu_order)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  taste_profile_id uuid not null references public.taste_profiles(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  semantic_score real not null,
  structured_score real not null,
  positive_factors text[] not null default '{}',
  negative_factors text[] not null default '{}',
  explanation text not null,
  created_at timestamptz not null default now()
);

create index if not exists ratings_user_id_idx on public.ratings(user_id);
create index if not exists menu_items_menu_id_idx on public.menu_items(menu_id);
create index if not exists recommendations_user_id_idx on public.recommendations(user_id);

alter table public.users enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_features enable row level security;
alter table public.ratings enable row level security;
alter table public.taste_profiles enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.recommendations enable row level security;

create policy "Users can manage their own profile" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can manage their own ratings" on public.ratings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own taste profile" on public.taste_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own menus" on public.menus for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read their recommendations" on public.recommendations for select using (auth.uid() = user_id);
create policy "Dishes are readable" on public.dishes for select using (true);
create policy "Dish features are readable" on public.dish_features for select using (true);
create policy "Menu items follow menu access" on public.menu_items for select using (
  exists (select 1 from public.menus where menus.id = menu_items.menu_id and menus.user_id = auth.uid())
);
