#!/usr/bin/env npx tsx
/**
 * List contracts that appear to be "skipped" (2M salary, 1 year remaining).
 * These are typically contracts that couldn't be matched to Spotrac and kept
 * default values from the provider sync. Output includes player name for manual updates.
 *
 * Usage: npx tsx scripts/list-skipped-contracts.ts [seasonYear]
 * Example: npx tsx scripts/list-skipped-contracts.ts 2025
 *
 * Raw SQL (for Supabase SQL editor or psql):
 *   SELECT c.id, t.abbrev AS team, p.first_name, p.last_name,
 *          c.salary, c.years_remaining
 *   FROM "Contract" c
 *   JOIN "Player" p ON p.id = c.player_id
 *   JOIN "Team" t ON t.id = c.team_id
 *   JOIN "Season" s ON s.id = c.season_id
 *   WHERE s.year = 2025 AND c.salary = 2000000 AND c.years_remaining = 1
 *   ORDER BY t.abbrev, p.last_name;
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seasonYear = process.argv[2]
    ? parseInt(process.argv[2], 10)
    : new Date().getFullYear();
  if (!Number.isInteger(seasonYear)) {
    console.error("Usage: npx tsx scripts/list-skipped-contracts.ts [seasonYear]");
    process.exit(1);
  }

  const season = await prisma.season.findFirst({
    where: { year: seasonYear },
  });
  if (!season) {
    console.error(`Season ${seasonYear} not found`);
    process.exit(1);
  }

  const skipped = await prisma.contract.findMany({
    where: {
      seasonId: season.id,
      salary: 2_000_000,
      yearsRemaining: 1,
    },
    include: {
      player: true,
      team: true,
    },
    orderBy: [{ team: { abbrev: "asc" } }, { player: { lastName: "asc" } }],
  });

  console.log(
    `\nSkipped contracts (2M salary, 1 year remaining) - ${seasonYear} season\n`
  );
  console.log(
    "| Team | Player | Contract ID |"
  );
  console.log("|------|--------|-------------|");

  for (const c of skipped) {
    const name = `${c.player.firstName} ${c.player.lastName}`;
    console.log(`| ${c.team.abbrev.padEnd(4)} | ${name.padEnd(30)} | ${c.id} |`);
  }

  console.log(`\nTotal: ${skipped.length} contracts\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
