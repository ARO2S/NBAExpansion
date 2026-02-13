/**
 * Parse Basketball-Reference stats CSV and apply to PlayerSeasonMetric.
 * Format: Rk,Player,Age,Team,Pos,G,GS,MP,...,TRB,AST,...,PTS,...,Player-additional
 */

import { prisma } from "@/lib/db";
import {
  normalizeTeamAbbrev,
  TEAM_NAMES,
} from "@/lib/team-abbrev";

export interface BBRStatsRow {
  playerName: string;
  teamAbbrev: string;
  gamesPlayed: number;
  starts: number;
  minutesPerGame: number;
  pointsPerGame: number;
  assistsPerGame: number;
  reboundsPerGame: number;
  position: string;
  /** Player age (from BBR "Age" column) for birthdate approximation */
  age?: number;
  /** Basketball-Reference player id for future matching */
  bbrefId?: string;
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (č -> c)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNum(val: string): number {
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse BBR per-game stats CSV.
 * Header: Rk,Player,Age,Team,Pos,G,GS,MP,FG,FGA,FG%,...,ORB,DRB,TRB,AST,...,PTS,...
 */
export function parseBBRStatsCsv(csvText: string): BBRStatsRow[] {
  const text = csvText.replace(/^\uFEFF/, "").trim();
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
  if (!headerRow.length) return [];

  const playerIdx = headerRow.indexOf("Player");
  const teamIdx = headerRow.indexOf("Team") >= 0 ? headerRow.indexOf("Team") : headerRow.indexOf("Tm");
  const posIdx = headerRow.indexOf("Pos");
  const ageIdx = headerRow.indexOf("Age");
  const gIdx = headerRow.indexOf("G");
  const gsIdx = headerRow.indexOf("GS");
  const mpIdx = headerRow.indexOf("MP");
  const ptsIdx = headerRow.indexOf("PTS");
  const astIdx = headerRow.indexOf("AST");
  const trbIdx = headerRow.indexOf("TRB");
  const addIdx = headerRow.findIndex((h) => h === "Player-additional" || h?.toLowerCase().includes("additional"));

  if (playerIdx < 0 || teamIdx < 0 || gIdx < 0 || ptsIdx < 0 || astIdx < 0 || trbIdx < 0) return [];

  const result: BBRStatsRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    const playerName = (row[playerIdx] ?? "").trim();
    if (!playerName || playerName === "Player" || playerName === "Rk") continue;

    const teamRaw = (row[teamIdx] ?? "").trim();
    if (!teamRaw) continue;
    const teamUpper = teamRaw.toUpperCase();
    if (["2TM", "3TM", "TOT"].includes(teamUpper)) continue;
    const canonicalAbbrev = normalizeTeamAbbrev(teamRaw);
    if (!(canonicalAbbrev in TEAM_NAMES)) continue;

    const gamesPlayed = Math.floor(parseNum(row[gIdx] ?? "0"));
    const starts = Math.floor(parseNum(row[gsIdx] ?? "0"));
    const minutesPerGame = parseNum(row[mpIdx] ?? "0");
    const pointsPerGame = parseNum(row[ptsIdx] ?? "0");
    const assistsPerGame = parseNum(row[astIdx] ?? "0");
    const reboundsPerGame = parseNum(row[trbIdx] ?? "0");
    const position = (row[posIdx] ?? "SF").trim().slice(0, 2).toUpperCase();
    const pos = ["PG", "SG", "SF", "PF", "C"].includes(position) ? position : "SF";
    const ageRaw = ageIdx >= 0 ? parseNum(row[ageIdx] ?? "0") : 0;
    const age = ageRaw > 0 && ageRaw < 60 ? Math.floor(ageRaw) : undefined;
    const bbrefId = addIdx >= 0 ? (row[addIdx] ?? "").trim() || undefined : undefined;

    result.push({
      playerName,
      teamAbbrev: canonicalAbbrev,
      gamesPlayed,
      starts,
      minutesPerGame,
      pointsPerGame,
      assistsPerGame,
      reboundsPerGame,
      position: pos,
      age,
      bbrefId,
    });
  }
  return result;
}

export interface MetricsUploadResult {
  seasonYear: number;
  rowsParsed: number;
  matched: number;
  updated: number;
  created: number;
  playersCreated: number;
  skipped: number;
  skippedSample: string[];
}

/**
 * Match CSV player name to DB player. Tries normalized name, "Last First", etc.
 */
async function findPlayerByName(playerName: string): Promise<{ id: string; firstName: string; lastName: string } | null> {
  const normalized = normalizeName(playerName);
  const parts = playerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const lastNamePart = parts[parts.length - 1]!;
  const firstNamePart = parts[0]!;

  const candidates = await prisma.player.findMany({
    where: { lastName: { equals: lastNamePart, mode: "insensitive" } },
    select: { id: true, firstName: true, lastName: true },
  });

  for (const p of candidates) {
    const dbFull = `${p.firstName} ${p.lastName}`;
    if (normalizeName(dbFull) === normalized) return p;
    if (normalizeName(`${p.lastName} ${p.firstName}`) === normalized) return p;
  }
  return null;
}

/**
 * Apply parsed stats rows to DB. Creates/updates PlayerSeasonMetric.
 * Creates Player records when not found (BBR CSV is the source of truth).
 * Auto-creates Team records when not found.
 */
async function getOrCreateTeam(
  seasonId: string,
  abbrev: string,
  teamsByAbbrev: Map<string, { id: string; abbrev: string }>
): Promise<{ id: string; abbrev: string } | null> {
  const key = abbrev.toUpperCase();
  let team = teamsByAbbrev.get(key);
  if (team) return team;

  const name = TEAM_NAMES[key] ?? `${abbrev} Team`;
  const created = await prisma.team.create({
    data: { seasonId, name, abbrev: key, isExpansion: false },
  });
  teamsByAbbrev.set(key, { id: created.id, abbrev: created.abbrev });
  return { id: created.id, abbrev: created.abbrev };
}

/**
 * Parse a BBR player name into firstName / lastName.
 * "LeBron James" → { firstName: "LeBron", lastName: "James" }
 * "Shai Gilgeous-Alexander" → { firstName: "Shai", lastName: "Gilgeous-Alexander" }
 */
function splitName(playerName: string): { firstName: string; lastName: string } {
  const parts = playerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "Player" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Approximate birthdate from age and season year.
 * BBR age is "age as of Feb 1" of the season. We approximate to June 15 of (seasonYear - age).
 */
function approximateBirthdate(age: number | undefined, seasonYear: number): Date {
  const effectiveAge = age && age > 0 ? age : 25; // default 25 if unknown
  const birthYear = seasonYear - effectiveAge;
  return new Date(birthYear, 5, 15); // June 15
}

export async function applyMetricsRowsToDb(
  seasonYear: number,
  rows: BBRStatsRow[]
): Promise<MetricsUploadResult> {
  const season = await prisma.season.findFirst({ where: { year: seasonYear } });
  if (!season) throw new Error(`Season ${seasonYear} not found. Create a season first.`);

  const teams = await prisma.team.findMany({
    where: { seasonId: season.id },
  });
  const teamsByAbbrev = new Map(teams.map((t) => [t.abbrev.toUpperCase(), { id: t.id, abbrev: t.abbrev }]));

  let matched = 0;
  let updated = 0;
  let created = 0;
  let playersCreated = 0;
  let skipped = 0;
  const skippedSample: string[] = [];

  for (const row of rows) {
    const team = await getOrCreateTeam(season.id, row.teamAbbrev, teamsByAbbrev);
    if (!team) {
      skipped++;
      if (skippedSample.length < 10) skippedSample.push(`${row.playerName} (team ${row.teamAbbrev})`);
      continue;
    }

    // Try to find existing player by bbrefId first, then by name; create if not found
    let player: { id: string; firstName: string; lastName: string } | null = null;

    if (row.bbrefId) {
      const byProvider = await prisma.player.findFirst({
        where: { providerPlayerId: row.bbrefId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (byProvider) player = byProvider;
    }

    if (!player) {
      player = await findPlayerByName(row.playerName);
    }

    if (!player) {
      const { firstName, lastName } = splitName(row.playerName);
      const birthdate = approximateBirthdate(row.age, seasonYear);
      const newPlayer = await prisma.player.create({
        data: {
          firstName,
          lastName,
          birthdate,
          primaryPosition: row.position,
          providerPlayerId: row.bbrefId ?? null,
        },
      });
      player = { id: newPlayer.id, firstName: newPlayer.firstName, lastName: newPlayer.lastName };
      playersCreated++;
    } else if (row.bbrefId) {
      // Backfill bbrefId on existing player if missing
      await prisma.player.update({
        where: { id: player.id },
        data: { providerPlayerId: row.bbrefId },
      }).catch(() => {}); // ignore if duplicate providerPlayerId
    }

    matched++;

    // Check for existing metric on ANY team this season (handles traded players).
    // BBR CSV lists teams in order: first team, then current team. So the last
    // row we process is the player's current team — we overwrite the old entry.
    const existingOnAnyTeam = await prisma.playerSeasonMetric.findFirst({
      where: { seasonId: season.id, playerId: player.id },
    });

    const data = {
      seasonId: season.id,
      teamId: team.id,
      playerId: player.id,
      gamesPlayed: row.gamesPlayed,
      minutesPerGame: row.minutesPerGame,
      starts: row.starts,
      pointsPerGame: row.pointsPerGame,
      assistsPerGame: row.assistsPerGame,
      reboundsPerGame: row.reboundsPerGame,
      overallRating: null,
    };

    if (existingOnAnyTeam) {
      // Delete any OTHER metrics for this player this season (e.g. previous team)
      await prisma.playerSeasonMetric.deleteMany({
        where: {
          seasonId: season.id,
          playerId: player.id,
          id: { not: existingOnAnyTeam.id },
        },
      });
      // Update the remaining entry with current team + stats
      await prisma.playerSeasonMetric.update({
        where: { id: existingOnAnyTeam.id },
        data,
      });
      updated++;
    } else {
      await prisma.playerSeasonMetric.create({ data });
      created++;
    }
  }

  return {
    seasonYear,
    rowsParsed: rows.length,
    matched,
    updated,
    created,
    playersCreated,
    skipped,
    skippedSample,
  };
}
