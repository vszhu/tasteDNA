// Isolated PostgreSQL regression checks. No network, production URL, or credentials.
// Install the test-only runtime separately; see the medication expansion handoff.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const runtime = process.argv[2];
if (!runtime) throw new Error("Pass the directory containing the isolated PGlite test runtime.");
const requireRuntime = createRequire(resolve(runtime, "package.json"));
const { PGlite } = requireRuntime("@electric-sql/pglite");
const { pgcrypto } = requireRuntime("@electric-sql/pglite/contrib/pgcrypto");
const { vector } = requireRuntime("@electric-sql/pglite-pgvector");
const db = new PGlite({ extensions: { pgcrypto, vector } });
const migrations = new URL("../supabase/migrations/", import.meta.url);
let checks = 0;
const same = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const A = "f1000000-0000-4000-8000-000000000001";
const B = "f1000000-0000-4000-8000-000000000002";
const C = "f1000000-0000-4000-8000-000000000003";
const S = "f2000000-0000-4000-8000-000000000001";
async function rows(sql, params = []) { return (await db.query(sql, params)).rows; }
async function scalar(sql, params = []) { return Object.values((await rows(sql, params))[0])[0]; }
async function as(role, id = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${role}`); // Only the fixed test role literals below are supplied.
}
async function rejects(sql, params, code) {
  await assert.rejects(() => db.query(sql, params), (error) => error.code === code); checks++;
}
async function versions() {
  return scalar("select jsonb_object_agg(m.user_id::text, coalesce(p.revision::text, 'none')) from public.group_session_members m left join public.user_medication_profiles p on p.user_id = m.user_id where m.session_id = $1 and m.status = 'accepted'", [S]);
}
async function persist(current, hash = "test") {
  return scalar("select public.persist_medication_group_recommendation($1,'test-meds-v1',$2,$3::jsonb,$4,$5::jsonb)", [S, hash, JSON.stringify({ sessionId: S }), A, JSON.stringify(current)]);
}

try {
  // Supabase's built-in roles/auth schema are the only harness stubs. Every
  // application table, policy, trigger, and RPC comes from the actual migrations.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
    console.log(`Applied ${file}`);
  }
  for (const [id, name] of [[A, "owner"], [B, "friend"], [C, "outsider"]]) {
    await db.query("insert into auth.users(id,email) values ($1,$2)", [id, `${name}@example.test`]);
  }
  await as("authenticated", A);
  const owner = (await rows("insert into public.user_medication_profiles(user_id,medications) values($1,array['simvastatin']) returning *", [A]))[0];
  same(owner.use_in_groups, false);
  same(owner.medications, ["simvastatin"]);
  await as("authenticated", B);
  same(await rows("select * from public.user_medication_profiles"), []);
  same(await rows("update public.user_medication_profiles set use_in_groups=true where user_id=$1 returning *", [A]), []);
  same(await rows("delete from public.user_medication_profiles where user_id=$1 returning *", [A]), []);
  await rejects("insert into public.user_medication_profiles(user_id) values($1)", [A], "42501");
  await as("anon");
  await rejects("select * from public.user_medication_profiles", [], "42501");
  await as("authenticated", A);
  for (const list of [[""], [null], ["x".repeat(101)], Array(13).fill("simvastatin")]) {
    await rejects("update public.user_medication_profiles set medications=$1::text[] where user_id=$2", [list, A], "23514");
  }
  await rejects("update public.user_medication_profiles set medications=ARRAY[ARRAY['a'],ARRAY['b']] where user_id=$1", [A], "23514");
  await rejects("update public.user_medication_profiles set user_id=$1 where user_id=$2", [C, A], "42501");
  await rejects("select public.persist_medication_group_recommendation($1,'x','x','{}',$2,'{}')", [S, A], "42501");
  const edited = (await rows("update public.user_medication_profiles set use_in_groups=true,revision=$1 where user_id=$2 returning *", [owner.revision, A]))[0];
  same(edited.revision !== owner.revision, true);

  await as("postgres");
  await db.query("insert into public.friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [A, B]);
  await db.query("insert into public.group_sessions(id,creator_id,name) values($1,$2,'Medication test')", [S, A]);
  await db.query("insert into public.group_session_members(session_id,user_id,invited_by,status) values($1,$2,$3,'invited')", [S, B, A]);
  const originalVersions = await versions();
  same(Object.keys(originalVersions), [A]);
  const firstId = await persist(originalVersions);
  same(await persist(originalVersions), firstId);
  await as("authenticated", B);
  await db.query("update public.group_session_members set status='accepted' where session_id=$1 and user_id=$2", [S, B]);
  await as("postgres");
  same(await scalar("select count(*)::int from public.group_recommendation_results where session_id=$1", [S]), 0);
  await assert.rejects(() => persist(originalVersions), (error) => error.code === "40001"); checks++;
  let current = await versions();
  same(current[B], "none");
  await persist(current, "accepted");
  await as("authenticated", B);
  await db.query("insert into public.user_medication_profiles(user_id,medications,use_in_groups) values($1,array['fexofenadine'],true)", [B]);
  same((await rows("select user_id from public.user_medication_profiles")).map((row) => row.user_id), [B]);
  await as("postgres");
  same(await scalar("select count(*)::int from public.group_recommendation_results"), 0);
  await assert.rejects(() => persist(current), (error) => error.code === "40001"); checks++;
  current = await versions(); await persist(current, "both-lists");
  await as("authenticated", A);
  await db.query("update public.user_medication_profiles set medications='{}',use_in_groups=false where user_id=$1", [A]);
  await as("postgres");
  same(await scalar("select count(*)::int from public.group_recommendation_results"), 0);
  await assert.rejects(() => persist(current), (error) => error.code === "40001"); checks++;
  current = await versions(); await persist(current, "opt-out");
  await as("authenticated", B);
  await db.query("delete from public.user_medication_profiles where user_id=$1", [B]);
  await as("postgres");
  same(await scalar("select count(*)::int from public.group_recommendation_results"), 0);
  same((await versions())[B], "none");
  await as("service_role");
  await rejects("select public.persist_medication_group_recommendation($1,'x','x',$2::jsonb,$3,'{}')", [S, JSON.stringify({ sessionId: S }), C], "42501");
  await persist(await versions(), "service-authorized"); checks++;
  console.log(`PASS: ${checks} database checks (owner isolation, consent, validation, invalidation, stale revisions, RPC grants).`);
} finally { await db.close(); }
