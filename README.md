# NBA Expansion Draft Simulator

A monetizable web app that lets users simulate drafting an NBA expansion team under configurable expansion-draft rules, with clean exports (text, text+contracts, image).

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Postgres + Auth + Storage)
- **Prisma** ORM
- **Playwright** for server-side screenshot export
- **Zod** for validation

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Supabase connection string)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Admin (comma-separated emails for admin routes)
ADMIN_EMAILS=admin@example.com

# For Playwright image export
BASE_URL=http://localhost:3000
```

### 3. Database setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (or use migrate)
npm run db:push

# Seed demo data (4 teams, 48 players)
npm run db:seed
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed Demo Data

The seed script inserts:

- 1 season (2024)
- 4 teams: Boston Celtics, LA Lakers, Golden State Warriors, Miami Heat
- 48 players with contracts and metrics
- Variation: young/old, cheap/expensive, injured (low games), expiring, player options

```bash
npm run db:seed
```

Or use the **Admin** page at `/admin` and click "Run Seed Script" (requires API to be running).

## User Flows

1. **Start a draft run** → Choose ruleset (1995-style, 2004-style, Custom), expansion teams, names
2. **Rules** → Review snapshot; continue to protection
3. **Protection lists** → Auto-generated per team; toggle protect/expose; lock when done
4. **Draft room** → Pick from exposed pool; constraints enforced; cap sheet visible
5. **Results** → Export as text, text+contracts, or image (PNG screenshot)

## Exports

| Type | Route | Description |
|------|-------|-------------|
| Text | `/api/export/text?runId=...` | Plain roster by position |
| Text + Contracts | `/api/export/text-contracts?runId=...` | Roster with salary, years, options, cap summary |
| Image | `/api/export/image?runId=...` | PNG screenshot of print-ready export page |

**Image export** uses Playwright to screenshot `/export/[runId]`. Ensure `BASE_URL` points to your running server (e.g. `http://localhost:3000` for local dev).

## Running Playwright Image Export

- The image export API launches a headless browser and navigates to the export page
- For local dev: `BASE_URL=http://localhost:3000` and run `npm run dev`
- Playwright installs Chromium on first run; no additional setup needed

## Data Modes

1. **Demo** – Use seed script (default)
2. **Admin upload** – JSON/CSV import (admin routes; configure as needed)
3. **SportsDataIO** – Add `SPORTSDATAIO_API_KEY` to `.env`, then go to Admin and click "Sync from SportsDataIO" to pull teams, players, contracts, and stats from the licensed API

## Testing

```bash
npm run test       # Watch mode
npm run test:run   # Single run
```

Tests cover: protect score, draft constraints, export formatting.

## Project Structure

```
src/
├── app/              # Next.js routes
│   ├── api/          # API routes
│   ├── runs/[runId]/ # Draft flow pages
│   └── export/       # Print-ready export page
├── components/       # UI components
├── lib/              # Domain logic
│   ├── protect-score.ts
│   ├── eligibility.ts
│   ├── draft-constraints.ts
│   ├── export-format.ts
│   └── rules-schema.ts
prisma/
├── schema.prisma
└── seed.ts
```

## No Scraping

This app does **not** scrape Basketball-Reference, Sports-Reference, Spotrac, or any websites. Data comes from:

- Demo seed
- Admin-uploaded datasets
- Licensed provider APIs (when configured)
