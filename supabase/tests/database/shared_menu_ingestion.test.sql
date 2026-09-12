begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email)
values ('91000000-0000-0000-0000-000000000001', 'menu-uploader@example.test');

insert into public.venues (id, external_id, source, name, latitude, longitude)
values (
  '92000000-0000-0000-0000-000000000001',
  'test:shared-menu',
  'test',
  'Shared Menu Test Venue',
  40.4433,
  -79.9436
);

select is(
  (
    public.ingest_shared_menu(
      '92000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      'Shared Menu Test Venue',
      'text',
      'pgtap',
      null,
      '{"rawImageStored":false}'::jsonb,
      'USD',
      repeat('a', 64),
      '2026-09-12T12:00:00Z',
      '[{
        "menuOrder":0,
        "price":12.5,
        "category":"Mains",
        "dish":{
          "name":"Test Ramen",
          "description":"Miso and mushrooms",
          "cuisine":"Japanese",
          "ingredients":["miso","mushroom"],
          "normalizedEmbeddingText":"test ramen miso mushroom",
          "embeddingModel":"deterministic-local-v1",
          "rankingEmbedding":[0.1,0.2],
          "contentHash":"dish-a",
          "features":{
            "sweet":0.1,"salty":0.6,"sour":0.1,"bitter":0.1,
            "umami":0.8,"spicy":0.2,"rich":0.4,"fresh":0.2,
            "crispy":0.1,"creamy":0.2,"chewy":0.5,"smoky":0.1,
            "cuisines":["Japanese"],"majorIngredients":["miso","mushroom"],
            "proteinTypes":[],"carbohydrateTypes":["noodle"],
            "cookingMethods":["simmered"],"confidence":0.9,"unknownFields":[]
          }
        }
      }]'::jsonb
    ) ->> 'created'
  ),
  'true',
  'the first normalized upload creates a shared menu version'
);

select is(
  (
    public.ingest_shared_menu(
      '92000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      'Shared Menu Test Venue',
      'text',
      'pgtap',
      null,
      '{"rawImageStored":false}'::jsonb,
      'USD',
      repeat('a', 64),
      '2026-09-12T13:00:00Z',
      '[{
        "menuOrder":0,"price":12.5,"category":"Mains",
        "dish":{
          "name":"Test Ramen","description":"Miso and mushrooms","cuisine":"Japanese",
          "ingredients":["miso","mushroom"],"normalizedEmbeddingText":"test ramen miso mushroom",
          "embeddingModel":"deterministic-local-v1","rankingEmbedding":[0.1,0.2],"contentHash":"dish-a",
          "features":{
            "sweet":0.1,"salty":0.6,"sour":0.1,"bitter":0.1,"umami":0.8,"spicy":0.2,
            "rich":0.4,"fresh":0.2,"crispy":0.1,"creamy":0.2,"chewy":0.5,"smoky":0.1,
            "cuisines":["Japanese"],"majorIngredients":["miso","mushroom"],"proteinTypes":[],
            "carbohydrateTypes":["noodle"],"cookingMethods":["simmered"],"confidence":0.9,"unknownFields":[]
          }
        }
      }]'::jsonb
    ) ->> 'created'
  ),
  'false',
  'uploading identical normalized content is idempotent'
);

select is(
  (select count(*) from public.menus where venue_id = '92000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an identical upload creates no duplicate menu, dish, or item transaction'
);

select is(
  (
    public.ingest_shared_menu(
      '92000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      'Shared Menu Test Venue',
      'text',
      'pgtap',
      null,
      '{"rawImageStored":false}'::jsonb,
      'USD',
      repeat('b', 64),
      '2026-09-13T12:00:00Z',
      '[{
        "menuOrder":0,"price":14,"category":"Mains",
        "dish":{
          "name":"Changed Ramen","description":"New recipe","cuisine":"Japanese",
          "ingredients":["miso"],"normalizedEmbeddingText":"changed ramen miso",
          "embeddingModel":"deterministic-local-v1","rankingEmbedding":[0.2,0.3],"contentHash":"dish-b",
          "features":{
            "sweet":0.1,"salty":0.5,"sour":0.1,"bitter":0.1,"umami":0.7,"spicy":0.2,
            "rich":0.3,"fresh":0.2,"crispy":0.1,"creamy":0.2,"chewy":0.5,"smoky":0.1,
            "cuisines":["Japanese"],"majorIngredients":["miso"],"proteinTypes":[],
            "carbohydrateTypes":["noodle"],"cookingMethods":["simmered"],"confidence":0.9,"unknownFields":[]
          }
        }
      }]'::jsonb
    ) ->> 'version'
  ),
  '2',
  'changed menu content creates the next version'
);

select is(
  (select count(*) from public.menus where venue_id = '92000000-0000-0000-0000-000000000001' and valid_until is null),
  1::bigint,
  'only the newest changed menu remains current'
);

select throws_ok(
  $$
    select public.ingest_shared_menu(
      '92000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      'Shared Menu Test Venue',
      'text',
      'pgtap',
      null,
      '{}'::jsonb,
      'USD',
      repeat('c', 64),
      '2026-09-14T12:00:00Z',
      '[{"menuOrder":0,"dish":{"ingredients":[],"rankingEmbedding":[],"features":{}}}]'::jsonb
    )
  $$,
  '22023',
  'invalid shared menu item',
  'an invalid item aborts the ingestion transaction'
);

select is(
  (select count(*) from public.menus where content_hash = repeat('c', 64)),
  0::bigint,
  'a failed ingestion rolls its inserted menu back'
);

select is(
  (select version from public.menus where venue_id = '92000000-0000-0000-0000-000000000001' and valid_until is null),
  2,
  'a failed ingestion also rolls back closing the prior current version'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ingest_shared_menu(uuid,uuid,text,text,text,text,jsonb,text,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated browser clients cannot call the privileged ingestion transaction'
);

select * from finish();
rollback;
