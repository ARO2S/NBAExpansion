/**
 * Spotrac NBA contracts scraper.
 * Fetches contract data from https://www.spotrac.com/nba/contracts and returns
 * structured rows for matching to DB players. Uses Playwright (no public API).
 *
 * Use sparingly: run on a schedule or via admin trigger; respect the site.
 */

import { prisma } from "@/lib/db";
import { SPOTRAC_CONTRACTS_URL } from "./spotrac-debug-shared";
const USER_AGENT =
  "Mozilla/5.0 (compatible; NBAExpansion/1.0; +https://github.com/nba-expansion)";

export interface SpotracContractRow {
  playerName: string;
  teamAbbrev: string | null;
  /** Total contract value in USD (from "Value" column) */
  value: number;
  /** Average annual value in USD (from "AAV" column) – use for cap hit */
  aav: number;
  years: number;
  /** Basketball-Reference player ID (from "Player-additional" column) */
  bbrefId?: string;
}

/** Map Spotrac team names/abbrevs to our Team.abbrev when they differ */
const TEAM_ABBREV_MAP: Record<string, string> = {
  lal: "LAL",
  lac: "LAC",
  gs: "GSW",
  gsw: "GSW",
  ny: "NYK",
  nyk: "NYK",
  no: "NOP",
  nop: "NOP",
  sa: "SAS",
  sas: "SAS",
  uta: "UTA",
  okc: "OKC",
  phx: "PHX",
  pho: "PHX",
  wsh: "WAS",
  was: "WAS",
  bkn: "BKN",
  brk: "BKN",
  bro: "BKN",
  cha: "CHA",
  cho: "CHA",
  mem: "MEM",
  orl: "ORL",
};

function normalizeTeamAbbrev(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return TEAM_ABBREV_MAP[key] ?? raw.trim().toUpperCase().slice(0, 3);
}

function parseMoney(text: string): number {
  const cleaned = text.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseYears(text: string): number {
  const m = text.trim().match(/^(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

/**
 * Scrape the main NBA contracts page and return all contract rows.
 * Uses Playwright; run in Node (script or API route), not in edge.
 */
export async function scrapeSpotracContracts(): Promise<SpotracContractRow[]> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
    });

    await page.goto(SPOTRAC_CONTRACTS_URL, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    // Wait until contract table has player links (data may load after initial paint)
    await page.waitForSelector("table tbody tr td a[href*='player'], table tbody tr td a[href*='redirect']", {
      timeout: 20000,
    }).catch(() => {});
    await page.waitForTimeout(2000);

    const rows = await page.evaluate(() => {
      const result: { playerName: string; team: string; value: string; aav: string; years: string }[] = [];
      const tables = Array.from(document.querySelectorAll("table"));
      let table: HTMLTableElement | null = null;
      let headerCells: string[] = [];
      let bodyRows: NodeListOf<HTMLTableRowElement> | undefined;

      for (const t of tables) {
        const thead = t.querySelector("thead");
        const tbody = t.querySelector("tbody");
        if (!thead || !tbody) continue;
        const headers = Array.from(thead.querySelectorAll("th")).map((th) =>
          (th.textContent ?? "").trim().toLowerCase()
        );
        const hasPlayer = headers.some((h) => h.includes("player"));
        const hasValue = headers.some((h) => h.includes("value") || h === "aav");
        const rows = tbody.querySelectorAll("tr");
        if (!hasPlayer || !hasValue) continue;
        if (!table || rows.length > (bodyRows?.length ?? 0)) {
          table = t as HTMLTableElement;
          headerCells = headers;
          bodyRows = rows;
        }
      }

      if (!table || !bodyRows) return result;

      const playerIdx = headerCells.findIndex((h) => h.includes("player"));
      const teamIdx = headerCells.findIndex((h) => h.includes("team") || h === "tm");
      const valueIdx = headerCells.findIndex((h) => h === "value" || h.includes("value"));
      const aavIdx = headerCells.findIndex((h) => h === "aav" || h.includes("average") || h.includes("aav"));
      const yrsIdx = headerCells.findIndex((h) => h === "yrs" || h.includes("year"));

      bodyRows.forEach((tr) => {
        const cells = tr.querySelectorAll("td");
        if (cells.length < 2) return;

        const playerName = (playerIdx >= 0 ? cells[playerIdx]?.textContent?.trim() : null) ??
          (cells[1]?.querySelector("a")?.textContent?.trim() ?? cells[1]?.textContent?.trim() ?? "");
        const team = (teamIdx >= 0 ? cells[teamIdx]?.textContent?.trim() : null) ?? "";
        const value = (valueIdx >= 0 ? cells[valueIdx]?.textContent?.trim() : null) ?? "";
        const aav = (aavIdx >= 0 ? cells[aavIdx]?.textContent?.trim() : null) ?? value;
        const years = (yrsIdx >= 0 ? cells[yrsIdx]?.textContent?.trim() : null) ?? "1";

        if (playerName) {
          result.push({ playerName, team, value, aav, years });
        }
      });

      return result;
    });

    await browser.close();

    return rows.map((r) => ({
      playerName: r.playerName.trim(),
      teamAbbrev: r.team ? normalizeTeamAbbrev(r.team) : null,
      value: parseMoney(r.value),
      aav: parseMoney(r.aav),
      years: parseYears(r.years),
    }));
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// --- Sync to DB (match by player name + optional team) ---

/** Normalize for name matching so DB and Spotrac formats align */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // strip accents (é -> e, etc.)
    .replace(/[''`]/g, "")   // remove apostrophes (De'Andre vs DeAndre)
    .replace(/-/g, " ")     // Karl-Anthony -> Karl Anthony
    .replace(/\s+/g, " ")
    .replace(/\s*(jr\.?|sr\.?|iii|ii|iv)$/i, "") // strip Jr., Sr., III, II, IV
    .trim();
}

/** First-name variants so "Nic" matches "Nicolas", etc. (BBR often uses shortened first names) */
const FIRST_NAME_VARIANTS: Record<string, string[]> = {
  nic: ["nicolas"],
  nicolas: ["nic"],
  bill: ["william"],
  william: ["bill"],
  billy: ["william"],
  jim: ["james"],
  james: ["jim"],
  jimmy: ["james"],
  mike: ["michael"],
  michael: ["mike"],
  matt: ["matthew"],
  matthew: ["matt"],
  nick: ["nicholas"],
  nicholas: ["nick"],
  alex: ["alexander"],
  alexander: ["alex"],
  dan: ["daniel"],
  daniel: ["dan"],
  dj: ["dejounte"],
  dejounte: ["dj"],
  aj: ["a.j.", "aj"],
  "a.j.": ["aj"],
};

/** Return alternate key "last first" for fallback lookup (Spotrac sometimes uses "Last, First") */
function alternateKey(firstName: string, lastName: string): string {
  return normalizeName(`${lastName} ${firstName}`);
}

/** Return possible lookup keys for a normalized "first last" name (including first-name variants like Nic/Nicolas) */
function lookupKeys(normalizedFull: string): string[] {
  const keys = [normalizedFull];
  const parts = normalizedFull.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const rest = parts.slice(1).join(" ");
    const variants = FIRST_NAME_VARIANTS[first];
    if (variants) {
      for (const v of variants) keys.push(`${v} ${rest}`);
    }
  }
  return keys;
}

export interface SpotracSyncResult {
  seasonYear: number;
  rowsScraped: number;
  matched: number;
  updated: number;
  contractsCreated: number;
  skipped: number;
  /** Sample of CSV player names that had no DB match (for debugging) */
  skippedSample: string[];
  errors: string[];
}

/**
 * Apply contract rows (from scrape or CSV) to DB.
 * Strategy: iterate CSV rows, find DB player by name, update or create Contract.
 * This works after a fresh reset where players exist (from stats CSV) but have no contracts.
 */
export async function applyContractRowsToDb(
  seasonYear: number,
  rows: SpotracContractRow[]
): Promise<SpotracSyncResult> {
  const errors: string[] = [];
  const season = await prisma.season.findFirst({ where: { year: seasonYear } });
  if (!season) {
    throw new Error(`Season ${seasonYear} not found. Create a season first.`);
  }

  // Load all players for matching (by bbrefId first, then by name)
  const allPlayers = await prisma.player.findMany({
    select: { id: true, firstName: true, lastName: true, providerPlayerId: true },
  });

  // Build bbrefId → player lookup (most reliable)
  const playerByBbrefId = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const p of allPlayers) {
    if (p.providerPlayerId) {
      playerByBbrefId.set(p.providerPlayerId, p);
    }
  }

  // Build name → player lookup (fallback)
  const playerByName = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const p of allPlayers) {
    const key = normalizeName(`${p.firstName} ${p.lastName}`);
    playerByName.set(key, p);
    // Also index reversed name
    const altKey = alternateKey(p.firstName, p.lastName);
    if (!playerByName.has(altKey)) playerByName.set(altKey, p);
    // Index first-name variants
    for (const variantKey of lookupKeys(key)) {
      if (!playerByName.has(variantKey)) playerByName.set(variantKey, p);
    }
  }

  // Load teams for mapping CSV team abbrev → team ID
  const teams = await prisma.team.findMany({
    where: { seasonId: season.id },
  });
  const teamByAbbrev = new Map(teams.map((t) => [t.abbrev.toUpperCase(), t]));

  // Load existing contracts for update-vs-create check
  const existingContracts = await prisma.contract.findMany({
    where: { seasonId: season.id },
    select: { id: true, playerId: true, teamId: true, salary: true, yearsRemaining: true },
  });
  const contractByPlayerId = new Map(existingContracts.map((c) => [c.playerId, c]));

  let matched = 0;
  let updated = 0;
  let contractsCreated = 0;
  let skipped = 0;
  const skippedSample: string[] = [];

  for (const row of rows) {
    // Match by bbrefId first (reliable), then fall back to name matching
    let player: { id: string; firstName: string; lastName: string } | undefined;

    if (row.bbrefId) {
      player = playerByBbrefId.get(row.bbrefId);
    }

    if (!player) {
      const csvName = normalizeName(row.playerName);
      const keysToTry = [csvName, ...lookupKeys(csvName).filter((k) => k !== csvName)];
      for (const key of keysToTry) {
        player = playerByName.get(key);
        if (player) break;
      }
    }

    if (!player) {
      skipped++;
      if (skippedSample.length < 15) {
        skippedSample.push(row.playerName + (row.bbrefId ? ` [${row.bbrefId}]` : ""));
      }
      continue;
    }

    matched++;

    const newSalary = row.aav > 0 ? row.aav : row.value / Math.max(1, row.years);
    const yearsRemaining = row.years;

    const existing = contractByPlayerId.get(player.id);

    if (existing) {
      // Update existing contract
      if (
        Number(existing.salary) !== newSalary ||
        existing.yearsRemaining !== yearsRemaining
      ) {
        await prisma.contract.update({
          where: { id: existing.id },
          data: { salary: newSalary, yearsRemaining },
        });
        updated++;
      }
    } else {
      // Create new contract – prefer current team from metrics (handles trades),
      // fall back to CSV team column.
      let teamId: string | null = null;
      const metric = await prisma.playerSeasonMetric.findFirst({
        where: { seasonId: season.id, playerId: player.id },
        select: { teamId: true },
      });
      if (metric) {
        teamId = metric.teamId;
      }
      if (!teamId && row.teamAbbrev) {
        const team = teamByAbbrev.get(row.teamAbbrev.toUpperCase());
        if (team) teamId = team.id;
      }
      if (!teamId) {
        skipped++;
        if (skippedSample.length < 15) {
          skippedSample.push(`${row.playerName} (no team found)`);
        }
        matched--; // undo match count
        continue;
      }

      await prisma.contract.create({
        data: {
          seasonId: season.id,
          teamId,
          playerId: player.id,
          salary: newSalary,
          yearsRemaining,
        },
      });
      contractsCreated++;
    }
  }

  return {
    seasonYear,
    rowsScraped: rows.length,
    matched,
    updated,
    contractsCreated,
    skipped,
    skippedSample,
    errors,
  };
}

/**
 * Parse Basketball-Reference contract CSV (export from contracts/players.html).
 * Expects header row with Rk,Player,Tm,2025-26,...,Guaranteed; data rows with same columns.
 * Also accepts format with extra header line (,,,Salary,Salary,...).
 */
export function parseBBRContractCsv(
  csvText: string,
  seasonYear: number
): SpotracContractRow[] {
  const seasonCol = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;
  const text = csvText.replace(/^\uFEFF/, "").trim(); // strip BOM
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let end = i + 1;
        while (end < line.length && (line[end] !== '"' || line[end + 1] === '"')) end++;
        out.push(line.slice(i + 1, end).replace(/""/g, '"'));
        i = end + 1;
        if (line[i] === ",") i++;
      } else {
        const comma = line.indexOf(",", i);
        const end = comma < 0 ? line.length : comma;
        out.push(line.slice(i, end).trim());
        i = comma < 0 ? line.length : comma + 1;
      }
    }
    return out;
  };

  let headerRow: string[] = [];
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    if (row[1] === "Player" || row[0] === "Rk") {
      headerRow = row;
      dataStart = i + 1;
      break;
    }
  }

  // ---------- Fallback: no proper header found ----------
  // When the user pastes just data rows (possibly with the secondary
  // ",,,Salary,Salary,...,-additional" line), use positional parsing.
  // BBR contracts layout: Rk(0), Player(1), Tm(2), salary years(3..N-2),
  // Guaranteed(N-1), Player-additional(N).  First salary col = current season.
  if (!headerRow.length) {
    const result: SpotracContractRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const row = parseLine(lines[i]!);
      const first = (row[0] ?? "").trim();
      // Skip non-data rows (secondary header, blanks, etc.)
      if (!/^\d+$/.test(first) || row.length < 5) continue;

      const playerName = (row[1] ?? "").trim();
      if (!playerName) continue;

      const teamRaw = (row[2] ?? "").trim();

      // Last column = Player-additional (bbrefId) if it isn't money
      const lastVal = (row[row.length - 1] ?? "").trim();
      const bbrefId =
        lastVal && !lastVal.startsWith("$") && !/^[\d,]+$/.test(lastVal)
          ? lastVal
          : undefined;

      // Second-to-last column is the Guaranteed/Total (skip it for year counting)
      const salaryEnd = row.length - (bbrefId ? 3 : 2); // last salary-year index
      const salaryStart = 3; // first salary column

      const salaryText = (row[salaryStart] ?? "").trim();
      const salary = parseMoney(salaryText);

      let yearsRemaining = 0;
      for (let c = salaryStart; c <= salaryEnd; c++) {
        const v = (row[c] ?? "").trim().replace(/[$,]/g, "");
        if (v && /^\d+$/.test(v)) yearsRemaining++;
        else break;
      }
      if (yearsRemaining < 1) yearsRemaining = 1;

      result.push({
        playerName,
        teamAbbrev: teamRaw ? normalizeTeamAbbrev(teamRaw) : null,
        value: salary * yearsRemaining,
        aav: salary,
        years: yearsRemaining,
        bbrefId,
      });
    }
    return result;
  }

  // ---------- Standard header-based parsing ----------
  const playerIdx = headerRow.indexOf("Player");
  const tmIdx = headerRow.indexOf("Tm");
  let seasonIdx = headerRow.indexOf(seasonCol);
  // Fallback: if exact season not found, use first column matching YYYY-YY pattern
  if (seasonIdx < 0) {
    const seasonPattern = /^\d{4}-\d{2}$/;
    seasonIdx = headerRow.findIndex((h) => seasonPattern.test(h));
  }
  if (playerIdx < 0 || tmIdx < 0 || seasonIdx < 0) return [];

  const guarIdx = headerRow.indexOf("Guaranteed");
  const lastYearCol = guarIdx >= 0 ? guarIdx - 1 : Math.min(seasonIdx + 5, headerRow.length - 1);
  const addIdx = headerRow.findIndex(
    (h) => h === "Player-additional" || h?.toLowerCase().includes("additional")
  );

  const result: SpotracContractRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    const playerName = (row[playerIdx] ?? "").trim();
    if (!playerName || playerName === "Player" || playerName === "Rk") continue;

    const teamRaw = (row[tmIdx] ?? "").trim();
    const salaryText = (row[seasonIdx] ?? "").trim();
    const salary = parseMoney(salaryText);
    const bbrefId = addIdx >= 0 ? (row[addIdx] ?? "").trim() || undefined : undefined;

    let yearsRemaining = 0;
    for (let c = seasonIdx; c <= lastYearCol && c < row.length; c++) {
      const v = (row[c] ?? "").trim().replace(/[$,]/g, "");
      if (v && /^\d+$/.test(v)) yearsRemaining++;
      else break;
    }
    if (yearsRemaining < 1) yearsRemaining = 1;

    result.push({
      playerName,
      teamAbbrev: teamRaw ? normalizeTeamAbbrev(teamRaw) : null,
      value: salary * yearsRemaining,
      aav: salary,
      years: yearsRemaining,
      bbrefId,
    });
  }
  return result;
}

/**
 * Scrape contract data (Basketball-Reference) and update Contract records for the given season.
 */
export async function syncSpotracToDb(seasonYear: number): Promise<SpotracSyncResult> {
  const { scrapeBBRContracts } = await import("./basketball-reference");
  const rows = await scrapeBBRContracts(seasonYear);
  return applyContractRowsToDb(seasonYear, rows);
}
