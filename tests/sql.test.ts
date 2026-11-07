import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migration and seed against an embedded Postgres (PGlite) with a
 * minimal stand-in for Supabase's auth schema and roles.
 */
const AUTH_SHIM = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_SHIM);
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
}, 60000);

describe("schema and seed", () => {
  it("seeds exactly one active config and materializes it", async () => {
    const configs = await db.query<{ version: number; is_active: boolean }>("select version, is_active from valuation_configs");
    expect(configs.rows).toEqual([{ version: 1, is_active: true }]);
    const tanks = await db.query<{ material: string; capacity: string; used_value_cents: string }>(
      "select material, capacity, used_value_cents::text from tank_price_rules order by material, capacity",
    );
    expect(tanks.rows).toEqual([
      { material: "aluminum", capacity: "any", used_value_cents: "25000" },
      { material: "steel", capacity: "10", used_value_cents: "100000" },
      { material: "steel", capacity: "15", used_value_cents: "150000" },
      { material: "steel", capacity: "20", used_value_cents: "185000" },
    ]);
    const burners = await db.query<{ n: number }>("select count(*)::int as n from burner_models where used_value_cents is not null");
    expect(burners.rows[0].n).toBe(2);
    const age = await db.query<{ n: number }>("select count(*)::int as n from age_depreciation_rules where rule_set = 'envelope_depreciation'");
    expect(age.rows[0].n).toBe(19);
  });

  it("seeds the model catalog without any comparable sales", async () => {
    const models = await db.query<{ n: number }>("select count(*)::int as n from balloon_models");
    expect(models.rows[0].n).toBeGreaterThan(1000);
    const comps = await db.query<{ n: number }>("select count(*)::int as n from sale_comparables");
    expect(comps.rows[0].n).toBe(0);
  });

  it("keeps config snapshots immutable and supports activation of a new version", async () => {
    await expect(db.query("update valuation_configs set snapshot = '{}'::jsonb where version = 1")).rejects.toThrow(/immutable/);
    const snap = await db.query<{ snapshot: Record<string, unknown> }>("select snapshot from valuation_configs where version = 1");
    const next = { ...snap.rows[0].snapshot, version: 2, listingMarkup: 0.1 };
    await db.query("insert into valuation_configs (version, label, snapshot) values (2, 'test', $1::jsonb)", [JSON.stringify(next)]);
    await db.query("select activate_valuation_config(2)");
    const active = await db.query<{ version: number }>("select version from valuation_configs where is_active");
    expect(active.rows).toEqual([{ version: 2 }]);
    const v2 = await db.query<{ n: number }>(
      "select count(*)::int as n from tank_price_rules t join valuation_configs c on c.id = t.config_id where c.version = 2",
    );
    expect(v2.rows[0].n).toBe(4);
  });

  it("never stores an asking price as a completed sale", async () => {
    await expect(
      db.query("insert into sale_comparables (manufacturer, verification_status, sale_price_cents) values ('Cameron', 'asking', 100)"),
    ).rejects.toThrow();
    await expect(db.query("insert into sale_comparables (manufacturer, verification_status) values ('Cameron', 'verified')")).rejects.toThrow();
  });
});

describe("row level security", () => {
  const owner = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";

  beforeAll(async () => {
    await db.query("insert into auth.users (id) values ($1), ($2)", [owner, other]);
    await db.query(
      `insert into valuations (reference_number, user_id, config_version, engine_version, input, result, edit_token_hash)
       values ('BB-T-1', $1, 1, '1.0.0', '{}', '{}', 'x'), ('BB-T-2', null, 1, '1.0.0', '{}', '{}', 'y')`,
      [owner],
    );
    await db.query(
      "insert into sale_comparables (manufacturer, verification_status, sale_price_cents, date_sold) values ('Cameron', 'verified', 1500000, '2026-05-01')",
    );
  });

  const as = async <T,>(role: "anon" | "authenticated", sub: string | null, sql: string) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); set role ${role};`);
    try {
      return await db.query<T>(sql);
    } finally {
      await db.exec("reset role;");
    }
  };

  it("lets anyone read reference data but not write it", async () => {
    const r = await as<{ n: number }>("anon", null, "select count(*)::int as n from burner_models");
    expect(r.rows[0].n).toBeGreaterThan(0);
    await expect(as("anon", null, "insert into manufacturers (name) values ('Hacker')")).rejects.toThrow();
    await expect(as("authenticated", owner, "update tank_price_rules set used_value_cents = 1")).rejects.toThrow();
    await expect(as("authenticated", owner, "insert into valuation_configs (version, snapshot) values (99, '{}')")).rejects.toThrow();
  });

  it("hides valuations from the public and other users", async () => {
    expect((await as<{ n: number }>("anon", null, "select count(*)::int as n from valuations")).rows[0].n).toBe(0);
    expect((await as<{ n: number }>("authenticated", other, "select count(*)::int as n from valuations")).rows[0].n).toBe(0);
    expect((await as<{ n: number }>("authenticated", owner, "select count(*)::int as n from valuations")).rows[0].n).toBe(1);
  });

  it("hides comparable sales from browser clients", async () => {
    expect((await as<{ n: number }>("anon", null, "select count(*)::int as n from sale_comparables")).rows[0].n).toBe(0);
    expect((await as<{ n: number }>("authenticated", owner, "select count(*)::int as n from sale_comparables")).rows[0].n).toBe(0);
  });

  it("lets owners delete only their own valuations", async () => {
    await as("authenticated", other, "delete from valuations where reference_number = 'BB-T-1'");
    expect((await db.query<{ n: number }>("select count(*)::int as n from valuations where reference_number = 'BB-T-1'")).rows[0].n).toBe(1);
    await as("authenticated", owner, "delete from valuations where reference_number = 'BB-T-1'");
    expect((await db.query<{ n: number }>("select count(*)::int as n from valuations where reference_number = 'BB-T-1'")).rows[0].n).toBe(0);
  });
});
