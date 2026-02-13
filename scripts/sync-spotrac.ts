#!/usr/bin/env npx tsx
/**
 * CLI: Scrape Basketball-Reference.com contracts and update Contract records in the DB.
 * Usage: npx tsx scripts/sync-spotrac.ts [seasonYear]
 * Example: npx tsx scripts/sync-spotrac.ts 2025
 *
 * Requires DATABASE_URL in the environment (e.g. from .env in project root
 * if you load it: node -r dotenv/config node_modules/.bin/tsx scripts/sync-spotrac.ts 2025).
 */

import { syncSpotracToDb } from "../src/lib/spotrac";

const seasonYear = process.argv[2] ? parseInt(process.argv[2], 10) : new Date().getFullYear();
if (!Number.isInteger(seasonYear)) {
  console.error("Usage: npx tsx scripts/sync-spotrac.ts [seasonYear]");
  process.exit(1);
}

syncSpotracToDb(seasonYear)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
