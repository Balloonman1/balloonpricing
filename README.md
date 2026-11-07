# Balloon Bluebook

Know what your balloon is really worth. A pricing resource for used hot air balloons: a guided valuation wizard, a deterministic pricing engine, appraisal-style reports with PDF export, sharing, an administrator dashboard with versioned pricing rules, and a comparable-sales database for calibration.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Zod, Recharts, jsPDF, Supabase (optional), Netlify Blobs (automatic on Netlify), Vitest.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine, data layer, SQL and CSV tests
```

Without any environment variables the app runs in local demo mode. Admin is at `/admin` with the password `bluebook-demo` (local only; production requires `ADMIN_PASSWORD`).

## Deploying on Netlify

1. Connect the repository. `netlify.toml` sets Node 22 and runs the tests before `next build`.
2. Set `ADMIN_PASSWORD` and `NEXT_PUBLIC_SITE_URL` under Site configuration > Environment variables.
3. Deploy.

Storage is chosen automatically:

| Setup | Storage | Accounts |
|---|---|---|
| Supabase variables set | Supabase Postgres | Email sign-in links |
| On Netlify, no Supabase | Netlify Blobs (no setup, persists across deploys) | Saved per browser |
| Local, no Supabase | Memory mirrored to `.data/demo-db.json` | Saved per browser |

Reports also keep a copy in the browser that created them, so a report still opens if server storage is unavailable.

## Supabase (optional)

1. Create a project and run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (pricing v1 and the model catalog; no comparable sales).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. In Authentication > URL configuration, add `https://YOUR_DOMAIN/auth/callback` as a redirect URL.

The service-role key is used only on the server. Row-level security lets browsers read reference data and their own valuations; all other writes go through the server. `tests/sql.test.ts` runs the migration, seed and RLS policies against an embedded Postgres.

## How the pricing works

All valuation math lives in `src/lib/engine/` as pure TypeScript functions. No LLM or paid API is involved.

Order of operations: replacement cost (user quote, racer or special-shape reference, manufacturer table, or interpolated volume table), hours depreciation, age depreciation, envelope condition, fabric, appearance, then basket, burner, tanks and accessories valued independently, market adjustment, resale policies (31 to 35 years capped at $4,900, over 35 years $0, Firefly and Balloon Works capped at $7,500, Raven $0), fair market value rounded to $50, selling range by confidence, listing price at +8% rounded to $100 and never above a policy cap, then the asking-price comparison.

Every number is a setting in `src/lib/engine/defaults.ts` and editable in the admin dashboard. Each saved change creates a new immutable version; every report stores the version and date it used, so it can be reproduced exactly.

## Admin dashboard

`/admin`: overview analytics, pricing rules editor with an impact preview on reference cases, version history and activation, comparable sales (manual entry, CSV import and export with a template), and calibration review. Calibration compares verified completed sales with model predictions and suggests manufacturer adjustments only with three or more sales; nothing changes until approved.

## Model catalog

`src/data/model-catalog.json` lists 48 manufacturers and about 1,170 models with typical volumes, built from the Balloon History Archive registry (The HAB Database). It feeds the model dropdown only and carries no prices. To refresh it:

```bash
npm run catalog -- ../balloon-archive/data/registry.json
npm run seed       # regenerate supabase/seed.sql
```

Models not in the catalog can always be typed in.

## Hero image

Add a photo at `public/hero.jpg` and the homepage uses it in place of the line-drawn placeholder.

## Project layout

```
src/lib/engine/        valuation engine, schemas, calibration, defaults, tests
src/lib/data/          storage: Supabase, Netlify Blobs, local demo
src/lib/services/      valuation create, recalculate, reproduce, public views
src/app/value/         guided wizard
src/app/valuation/     private report (owner)
src/app/r/             shared report (opt-in link)
src/app/admin/         dashboard
src/app/[slug]/        guides and manufacturer pages
src/components/report/ report view, gauges, PDF
supabase/              migration and seed
scripts/               catalog and seed generators
```

## Disclaimer

Balloon Bluebook provides estimated resale values based on expert pricing assumptions and the information supplied. Estimates are not certified appraisals, guarantees of selling price, aircraft inspections, or airworthiness determinations.
