-- Balloon Bluebook schema
-- Money is stored as integer cents (bigint). Multipliers and fractions use numeric.
-- Every configuration change is a new immutable row in valuation_configs. The JSON
-- snapshot is what the engine runs; the normalized tables are materialized from it
-- per version for reporting and querying.

-- gen_random_uuid() is built into Postgres 13+.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.balloon_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  model text not null,
  typical_volume_cuft integer,
  category text check (category in ('sport', 'commercial', 'racer', 'special_shape')),
  registry_count integer not null default 0,
  year_min integer,
  year_max integer,
  source text,
  created_at timestamptz not null default now(),
  unique (manufacturer_id, model)
);
create index if not exists balloon_models_manufacturer_idx on public.balloon_models (manufacturer_id);

-- ---------------------------------------------------------------------------
-- Versioned pricing configuration
-- ---------------------------------------------------------------------------

create table if not exists public.valuation_configs (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  label text,
  notes text,
  snapshot jsonb not null,
  is_active boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists valuation_configs_one_active on public.valuation_configs (is_active) where is_active;

create table if not exists public.envelope_price_references (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  manufacturer text,
  kind text not null default 'volume' check (kind in ('volume', 'racer', 'special_shape')),
  volume_cuft integer,
  price_cents bigint not null check (price_cents >= 0)
);
create index if not exists envelope_price_references_config_idx on public.envelope_price_references (config_id);

create table if not exists public.age_depreciation_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  rule_set text not null check (rule_set in ('envelope_depreciation', 'hardware_remaining')),
  age numeric(6, 2) not null,
  factor numeric(8, 6) not null check (factor between 0 and 1)
);
create index if not exists age_depreciation_rules_config_idx on public.age_depreciation_rules (config_id);

create table if not exists public.condition_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  condition char(1) not null check (condition in ('A', 'B', 'C', 'D', 'E')),
  multiplier numeric(8, 6) not null
);

create table if not exists public.fabric_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  fabric text not null,
  multiplier numeric(8, 6) not null
);

create table if not exists public.appearance_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  rule text not null,
  deduction numeric(8, 6) not null check (deduction between 0 and 1)
);

create table if not exists public.basket_models (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  model_key text not null,
  manufacturer text not null,
  model text not null,
  construction text,
  new_price_cents bigint check (new_price_cents >= 0)
);
create index if not exists basket_models_config_idx on public.basket_models (config_id);

create table if not exists public.burner_models (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  model_key text not null,
  manufacturer text not null,
  model text not null,
  configuration text,
  glow text not null check (glow in ('glow', 'non_glow', 'any')),
  used_value_cents bigint check (used_value_cents >= 0)
);
create index if not exists burner_models_config_idx on public.burner_models (config_id);

create table if not exists public.tank_price_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  material text not null check (material in ('aluminum', 'steel')),
  capacity text not null,
  used_value_cents bigint not null check (used_value_cents >= 0)
);

create table if not exists public.accessory_price_rules (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  accessory_key text not null,
  label text not null,
  used_value_cents bigint check (used_value_cents >= 0)
);

create table if not exists public.brand_policies (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.valuation_configs(id) on delete cascade,
  policy_key text not null,
  manufacturer text not null,
  kind text not null check (kind in ('cap', 'zero')),
  max_value_cents bigint,
  typical_min_cents bigint,
  typical_max_cents bigint,
  message text,
  active boolean not null default true
);

-- Unpacks a config snapshot into the normalized tables. Runs automatically on insert.
create or replace function public.materialize_valuation_config(p_config_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb;
  item jsonb;
  mfr jsonb;
  k text;
begin
  select snapshot into s from public.valuation_configs where id = p_config_id;
  if s is null then
    raise exception 'valuation config % not found', p_config_id;
  end if;

  delete from public.envelope_price_references where config_id = p_config_id;
  delete from public.age_depreciation_rules where config_id = p_config_id;
  delete from public.condition_rules where config_id = p_config_id;
  delete from public.fabric_rules where config_id = p_config_id;
  delete from public.appearance_rules where config_id = p_config_id;
  delete from public.basket_models where config_id = p_config_id;
  delete from public.burner_models where config_id = p_config_id;
  delete from public.tank_price_rules where config_id = p_config_id;
  delete from public.accessory_price_rules where config_id = p_config_id;
  delete from public.brand_policies where config_id = p_config_id;

  for item in select * from jsonb_array_elements(coalesce(s->'envelopePrices', '[]'::jsonb)) loop
    insert into public.envelope_price_references (config_id, kind, volume_cuft, price_cents)
    values (p_config_id, 'volume', (item->>'volumeCuFt')::integer, (item->>'priceCents')::bigint);
  end loop;
  for mfr in select * from jsonb_array_elements(coalesce(s->'manufacturerEnvelopePrices', '[]'::jsonb)) loop
    for item in select * from jsonb_array_elements(coalesce(mfr->'points', '[]'::jsonb)) loop
      insert into public.envelope_price_references (config_id, manufacturer, kind, volume_cuft, price_cents)
      values (p_config_id, mfr->>'manufacturer', 'volume', (item->>'volumeCuFt')::integer, (item->>'priceCents')::bigint);
    end loop;
  end loop;
  insert into public.envelope_price_references (config_id, kind, price_cents)
  values (p_config_id, 'racer', (s->>'racerEnvelopeCents')::bigint),
         (p_config_id, 'special_shape', (s->>'specialShapeEnvelopeCents')::bigint);

  for item in select * from jsonb_array_elements(coalesce(s->'envelopeAgeCurve', '[]'::jsonb)) loop
    insert into public.age_depreciation_rules (config_id, rule_set, age, factor)
    values (p_config_id, 'envelope_depreciation', (item->>'age')::numeric, (item->>'depreciation')::numeric);
  end loop;
  for item in select * from jsonb_array_elements(coalesce(s->'hardwareAgeBands', '[]'::jsonb)) loop
    insert into public.age_depreciation_rules (config_id, rule_set, age, factor)
    values (p_config_id, 'hardware_remaining', (item->>'minAge')::numeric, (item->>'remaining')::numeric);
  end loop;

  for k in select jsonb_object_keys(s->'conditionMultipliers') loop
    insert into public.condition_rules (config_id, condition, multiplier)
    values (p_config_id, k, (s->'conditionMultipliers'->>k)::numeric);
  end loop;
  for k in select jsonb_object_keys(s->'fabricMultipliers') loop
    insert into public.fabric_rules (config_id, fabric, multiplier)
    values (p_config_id, k, (s->'fabricMultipliers'->>k)::numeric);
  end loop;
  for k in select jsonb_object_keys(s->'appearanceDeductions') loop
    insert into public.appearance_rules (config_id, rule, deduction)
    values (p_config_id, k, (s->'appearanceDeductions'->>k)::numeric);
  end loop;

  for item in select * from jsonb_array_elements(coalesce(s->'basketModels', '[]'::jsonb)) loop
    insert into public.basket_models (config_id, model_key, manufacturer, model, construction, new_price_cents)
    values (p_config_id, item->>'id', item->>'manufacturer', item->>'model', item->>'construction', (item->>'newPriceCents')::bigint);
  end loop;
  for item in select * from jsonb_array_elements(coalesce(s->'burnerModels', '[]'::jsonb)) loop
    insert into public.burner_models (config_id, model_key, manufacturer, model, configuration, glow, used_value_cents)
    values (p_config_id, item->>'id', item->>'manufacturer', item->>'model', item->>'configuration', item->>'glow', (item->>'usedValueCents')::bigint);
  end loop;

  insert into public.tank_price_rules (config_id, material, capacity, used_value_cents)
  values (p_config_id, 'aluminum', 'any', (s->'tankPrices'->>'aluminumCents')::bigint);
  for k in select jsonb_object_keys(s->'tankPrices'->'steel') loop
    insert into public.tank_price_rules (config_id, material, capacity, used_value_cents)
    values (p_config_id, 'steel', k, (s->'tankPrices'->'steel'->>k)::bigint);
  end loop;

  for item in select * from jsonb_array_elements(coalesce(s->'accessories', '[]'::jsonb)) loop
    insert into public.accessory_price_rules (config_id, accessory_key, label, used_value_cents)
    values (p_config_id, item->>'key', item->>'label', (item->>'usedValueCents')::bigint);
  end loop;

  for item in select * from jsonb_array_elements(coalesce(s->'brandPolicies', '[]'::jsonb)) loop
    insert into public.brand_policies (config_id, policy_key, manufacturer, kind, max_value_cents, typical_min_cents, typical_max_cents, message, active)
    values (p_config_id, item->>'id', item->>'manufacturer', item->>'kind', (item->>'maxValueCents')::bigint,
            (item->>'typicalMinCents')::bigint, (item->>'typicalMaxCents')::bigint, item->>'message', coalesce((item->>'active')::boolean, true));
  end loop;
end;
$$;

create or replace function public.valuation_configs_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.materialize_valuation_config(new.id);
  return new;
end;
$$;

drop trigger if exists valuation_configs_materialize on public.valuation_configs;
create trigger valuation_configs_materialize
after insert on public.valuation_configs
for each row execute function public.valuation_configs_after_insert();

-- Snapshots are immutable once written. Only the active flag may change.
create or replace function public.valuation_configs_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.snapshot is distinct from old.snapshot or new.version is distinct from old.version then
    raise exception 'valuation config snapshots are immutable; create a new version instead';
  end if;
  return new;
end;
$$;

drop trigger if exists valuation_configs_immutable on public.valuation_configs;
create trigger valuation_configs_immutable
before update on public.valuation_configs
for each row execute function public.valuation_configs_guard_update();

-- Activates one version atomically.
create or replace function public.activate_valuation_config(p_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.valuation_configs where version = p_version) then
    raise exception 'valuation config version % not found', p_version;
  end if;
  update public.valuation_configs set is_active = false where is_active and version <> p_version;
  update public.valuation_configs set is_active = true where version = p_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Valuations
-- ---------------------------------------------------------------------------

create table if not exists public.valuations (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  config_id uuid references public.valuation_configs(id),
  config_version integer not null,
  engine_version text not null,
  input jsonb not null,
  result jsonb not null,
  manufacturer text,
  model text,
  scope text,
  envelope_year integer,
  envelope_age integer,
  envelope_hours numeric(10, 2),
  fair_market_value_cents bigint not null default 0 check (fair_market_value_cents >= 0),
  listing_price_cents bigint not null default 0 check (listing_price_cents >= 0),
  asking_price_cents bigint check (asking_price_cents >= 0),
  overpricing_pct numeric(10, 4),
  confidence text check (confidence in ('high', 'moderate', 'low')),
  edit_token_hash text not null,
  share_id text unique,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists valuations_user_idx on public.valuations (user_id, created_at desc);
create index if not exists valuations_created_idx on public.valuations (created_at desc);
create index if not exists valuations_manufacturer_idx on public.valuations (manufacturer);

create table if not exists public.valuation_components (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations(id) on delete cascade,
  kind text not null check (kind in ('envelope', 'basket', 'burner', 'tanks', 'accessories')),
  label text not null,
  value_cents bigint not null check (value_cents >= 0),
  provenance text not null
);
create index if not exists valuation_components_valuation_idx on public.valuation_components (valuation_id);

-- ---------------------------------------------------------------------------
-- Comparable sales
-- ---------------------------------------------------------------------------

create table if not exists public.sale_comparables (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text,
  volume_cuft integer,
  manufacture_year integer,
  envelope_hours numeric(10, 2),
  fabric text,
  condition text,
  basket text,
  burner text,
  tanks text,
  accessories text,
  asking_price_cents bigint check (asking_price_cents >= 0),
  sale_price_cents bigint check (sale_price_cents >= 0),
  date_sold date,
  region text,
  data_source text,
  verification_status text not null check (verification_status in ('asking', 'reported', 'verified')),
  valuation_input jsonb,
  notes text,
  created_at timestamptz not null default now(),
  -- An asking price is never a completed sale.
  constraint sale_comparables_asking_has_no_sale check (verification_status <> 'asking' or sale_price_cents is null),
  constraint sale_comparables_verified_has_sale check (verification_status <> 'verified' or (sale_price_cents is not null and date_sold is not null))
);
create index if not exists sale_comparables_status_idx on public.sale_comparables (verification_status);
create index if not exists sale_comparables_manufacturer_idx on public.sale_comparables (manufacturer);

-- ---------------------------------------------------------------------------
-- Row level security
-- The server uses the service role for administrator writes and anonymous
-- valuations. Browser clients (anon or signed-in) can only read reference data
-- and their own valuations.
-- ---------------------------------------------------------------------------

alter table public.manufacturers enable row level security;
alter table public.balloon_models enable row level security;
alter table public.valuation_configs enable row level security;
alter table public.envelope_price_references enable row level security;
alter table public.age_depreciation_rules enable row level security;
alter table public.condition_rules enable row level security;
alter table public.fabric_rules enable row level security;
alter table public.appearance_rules enable row level security;
alter table public.basket_models enable row level security;
alter table public.burner_models enable row level security;
alter table public.tank_price_rules enable row level security;
alter table public.accessory_price_rules enable row level security;
alter table public.brand_policies enable row level security;
alter table public.users enable row level security;
alter table public.admin_users enable row level security;
alter table public.valuations enable row level security;
alter table public.valuation_components enable row level security;
alter table public.sale_comparables enable row level security;

-- Reference data: readable by everyone, writable by nobody except the service role.
do $$
declare t text;
begin
  foreach t in array array[
    'manufacturers', 'balloon_models', 'envelope_price_references', 'age_depreciation_rules',
    'condition_rules', 'fabric_rules', 'appearance_rules', 'basket_models', 'burner_models',
    'tank_price_rules', 'accessory_price_rules', 'brand_policies'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end;
$$;

drop policy if exists valuation_configs_public_read on public.valuation_configs;
create policy valuation_configs_public_read on public.valuation_configs
  for select to anon, authenticated using (true);

-- Profiles
drop policy if exists users_own_select on public.users;
create policy users_own_select on public.users for select to authenticated using (id = auth.uid());
drop policy if exists users_own_upsert on public.users;
create policy users_own_upsert on public.users for insert to authenticated with check (id = auth.uid());
drop policy if exists users_own_update on public.users;
create policy users_own_update on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Admin list: an admin may see the list; nobody writes it from the browser.
drop policy if exists admin_users_admin_read on public.admin_users;
create policy admin_users_admin_read on public.admin_users for select to authenticated using (public.is_admin());

-- Valuations: owners only. Shared reports are served by the server, never by a public policy.
drop policy if exists valuations_owner_select on public.valuations;
create policy valuations_owner_select on public.valuations for select to authenticated using (user_id = auth.uid());
drop policy if exists valuations_owner_delete on public.valuations;
create policy valuations_owner_delete on public.valuations for delete to authenticated using (user_id = auth.uid());

drop policy if exists valuation_components_owner_select on public.valuation_components;
create policy valuation_components_owner_select on public.valuation_components for select to authenticated
  using (exists (select 1 from public.valuations v where v.id = valuation_id and v.user_id = auth.uid()));

-- Comparable sales: no browser access. Administrators manage them through the server.

revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant delete on public.valuations to authenticated;
grant insert, update on public.users to authenticated;
revoke execute on function public.materialize_valuation_config(uuid) from public, anon, authenticated;
revoke execute on function public.activate_valuation_config(integer) from public, anon, authenticated;
