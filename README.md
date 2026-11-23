# ClubHub

Tournament and cup management for admins, teams and players.

ClubHub is a self-hosted platform for running football cups and leagues. Organisers
create tournaments, approve team signups, register squads, and manage fixtures and
scorers. Players and supporters browse live brackets, results, standings, and player
profiles.

Built with Next.js (App Router), Postgres, Drizzle ORM, and Supabase.

## Features

- **Tournaments** — create competitions, set dates and status, publish brackets.
- **Signups** — teams request to join a tournament; organisers approve or reject.
- **Squads** — register players, set kit colours and crests, manage transfers.
- **Fixtures & scoring** — schedule matches, record goals and assists, track results live.
- **Standings & stats** — league tables, top scorers, and per-tournament statistics.
- **Admin panel** — password-protected area for managing teams, matches, and settings.
- **Memories** — bulk photo upload per tournament, with captions, optional fixture tags and a lightbox gallery on the public cup page. Photos are resized in the browser before upload and stored in Supabase Storage.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React, TypeScript |
| Database | Postgres via `postgres-js`, schema managed by Drizzle |
| Auth | Supabase Auth sessions, admin-only route protection in `proxy.ts` |
| Storage | Supabase Storage for crests and logos |
| Styling | Tailwind CSS |
| Tests | Vitest |

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values. `.env.local` is
git-ignored and must never be committed.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by the app and `scripts/apply-schema.ts`. On serverless hosts such as Vercel, use the **transaction pooler** (port `6543`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side admin operations. |
| `DIRECT_URL` | Optional direct Postgres connection (port `5432`) preferred by a few one-off helper scripts. |
| `NEXT_PUBLIC_SITE_URL` | Optional public origin for canonical URLs, robots and sitemap. Defaults to `http://localhost:3000`. |

The app uses the Supabase service role on the server only; no browser anon key is
required. Vercel may inject its own `VERCEL_OIDC_TOKEN` automatically — it is
not part of the manual setup.

### Database setup

The schema lives in `supabase/schema.sql`. Apply it with:

```bash
npx tsx scripts/apply-schema.ts
```

Helper scripts in `scripts/` can create or delete an admin account, verify the
connection, and inspect the schema:

| Script | Purpose |
| --- | --- |
| `npx tsx scripts/check-db.ts` | Verify the connection and list tables |
| `npx tsx scripts/check-cascade.ts` | Print every foreign key's ON DELETE rule |
| `npx tsx scripts/test-delete-cascade.ts` | Prove tournament deletion cleans up (rolled back) |
| `npx tsx scripts/create-admin.ts <email> <password>` | Create or reset the organiser login |
| `npx tsx scripts/setup-memory-bucket.ts` | Create/update the public `tournament-memories` storage bucket |
| `npx tsx scripts/verify-db-hardening.ts` | Verify constraints, indexes and RLS/Storage policies |

### Tournament memories

Applying `supabase/schema.sql` creates a public `tournament-memories` Storage
bucket. If your Supabase project restricts SQL access to `storage.buckets`, run
`npx tsx scripts/setup-memory-bucket.ts` instead.

Organisers upload photos from **Admin → (tournament) → Memories**. Up to 12
images per batch are resized to a maximum of 1800px in the browser, so original
phone photos never leave the device. Each photo can carry a caption and be
tagged to a fixture; published photos appear in the **Memories** section of the
public tournament page.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run check` | Typecheck, lint, and run tests |
| `npm run test` | Run tests only |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint only |

## Deploying

Import the repository into [Vercel](https://vercel.com); the framework preset and
build command are detected automatically. Add the three required environment
variables above in **Settings → Environment Variables** before the first deploy;
the remaining two are optional.

## Project structure

```
app/            routes, pages, server actions
components/     shared UI, admin panels
lib/            database, auth, formatting, validation, stats
public/         static assets and icons
scripts/        schema and admin helper scripts
supabase/       schema SQL
tests/          Vitest unit tests
```