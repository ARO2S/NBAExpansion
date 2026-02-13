/**
 * BallDontLie NBA API adapter.
 * Uses API key from BALLDONTLIE_API_KEY env var.
 * Base URL: https://api.balldontlie.io/v1
 *
 * Free tier: Teams, Players, Games
 * ALL-STAR: + Active Players, Game Stats
 * GOAT: + Season Averages, Contracts
 *
 * @see https://docs.balldontlie.io
 * @see https://www.balldontlie.io/openapi.yml
 */

import type {
  DataProviderAdapter,
  ProviderTeam,
  ProviderPlayer,
  ProviderRosterItem,
  ProviderSalary,
  ProviderStats,
} from "./types";

const BASE = "https://api.balldontlie.io/v1";

function getKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) {
    throw new Error("BALLDONTLIE_API_KEY is not configured");
  }
  return key;
}

function headers(): Record<string, string> {
  return { Authorization: getKey() };
}

interface BDLTeam {
  id: number;
  full_name: string;
  abbreviation: string;
}

interface BDLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position?: string;
  team?: { id: number; abbreviation: string; full_name: string };
}

interface BDLContract {
  player_id: number;
  team_id: number;
  season: number;
  cap_hit?: number;
  base_salary?: number;
}

interface BDLSeasonAverage {
  player_id?: number;
  player?: { id: number };
  season: number;
  games_played?: number;
  min?: string;
  stats?: Record<string, unknown>;
}

const POS_MAP: Record<string, string> = {
  G: "SG",
  F: "SF",
  C: "C",
  "G-F": "SG",
  "F-G": "SF",
  "F-C": "PF",
  "C-F": "PF",
};

function parseMinutes(min: string | undefined): number {
  if (!min) return 0;
  const parts = min.split(":").map(Number);
  if (parts.length >= 2) return parts[0] + parts[1] / 60;
  return parseFloat(min) || 0;
}

export const ballDontLieAdapter: DataProviderAdapter = {
  async syncTeams(_seasonYear: number): Promise<ProviderTeam[]> {
    const res = await fetch(`${BASE}/teams`, { headers: headers() });
    if (!res.ok) {
      throw new Error(`BallDontLie teams failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: BDLTeam[] };
    const data = json.data ?? json;
    const teams = Array.isArray(data) ? data : [];
    return teams.map((t) => ({
      providerTeamId: String(t.id),
      name: t.full_name || "Unknown",
      abbrev: t.abbreviation || String(t.id),
    }));
  },

  async syncPlayers(seasonYear: number): Promise<ProviderPlayer[]> {
    const out: ProviderPlayer[] = [];
    let cursor: number | undefined;
    do {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      if (cursor != null) params.set("cursor", String(cursor));
      const res = await fetch(`${BASE}/players?${params}`, { headers: headers() });
      if (!res.ok) {
        throw new Error(`BallDontLie players failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as {
        data: BDLPlayer[] | BDLPlayer;
        meta?: { next_cursor?: number };
      };
      const raw = json.data;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const p of list) {
        const pos = (p.position || "SF").split("-")[0].trim();
        const primaryPosition = POS_MAP[pos] || (pos.length <= 2 ? pos : "SF");
        const birthYear = p.draft_year ? p.draft_year + 4 : 1995;
        out.push({
          providerPlayerId: String(p.id),
          firstName: p.first_name || "Unknown",
          lastName: p.last_name || "Unknown",
          birthdate: new Date(birthYear, 5, 15),
          primaryPosition,
        });
      }
      cursor = json.meta?.next_cursor;
    } while (cursor != null && cursor > 0);
    return out;
  },

  async syncRosters(seasonYear: number): Promise<ProviderRosterItem[]> {
    const out: ProviderRosterItem[] = [];
    let cursor: number | undefined;
    do {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      if (cursor != null) params.set("cursor", String(cursor));
      const res = await fetch(`${BASE}/players?${params}`, { headers: headers() });
      if (!res.ok) {
        throw new Error(`BallDontLie rosters failed: ${res.status}`);
      }
      const json = (await res.json()) as {
        data: BDLPlayer[] | BDLPlayer;
        meta?: { next_cursor?: number };
      };
      const raw = json.data;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const p of list) {
        if (p.team?.id != null) {
          out.push({
            providerPlayerId: String(p.id),
            providerTeamId: String(p.team.id),
            seasonYear,
          });
        }
      }
      cursor = json.meta?.next_cursor;
    } while (cursor != null && cursor > 0);
    return out;
  },

  async syncSalaries(seasonYear: number): Promise<ProviderSalary[]> {
    try {
      const teamsRes = await fetch(`${BASE}/teams`, { headers: headers() });
      if (!teamsRes.ok) return [];
      const teamsJson = (await teamsRes.json()) as { data: BDLTeam[] };
      const teams = teamsJson.data ?? [];
      const salaries: ProviderSalary[] = [];
      for (const team of teams) {
        const res = await fetch(
          `${BASE}/teams/${team.id}/contracts?season=${seasonYear}`,
          { headers: headers() }
        );
        if (!res.ok) continue;
        const json = (await res.json()) as { data?: BDLContract[] | BDLContract };
        const raw = json.data;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        for (const c of list) {
          const salary = c.cap_hit ?? c.base_salary ?? 0;
          if (salary > 0) {
            salaries.push({
              providerPlayerId: String(c.player_id),
              providerTeamId: String(c.team_id),
              seasonYear,
              salary,
            });
          }
        }
      }
      return salaries;
    } catch {
      return [];
    }
  },

  async syncStats(seasonYear: number): Promise<ProviderStats[]> {
    try {
      // Try nba/v1 path first (per BDL docs); fallback to v1
      const urls = [
        `${BASE.replace("/v1", "/nba/v1")}/season_averages/general`,
        `${BASE}/season_averages/general`,
      ];
      const params = `season=${seasonYear}&season_type=regular&type=base&per_page=100`;
      let res: Response | null = null;
      let workingBase = "";
      for (const base of urls) {
        res = await fetch(`${base}?${params}`, { headers: headers() });
        if (res.ok) {
          workingBase = base;
          break;
        }
      }
      if (!res?.ok || !workingBase) return [];
      const json = (await res.json()) as {
        data?: (BDLSeasonAverage & { stats?: Record<string, unknown>; games_played?: number; min?: string; pts?: number; ast?: number; reb?: number })[];
        meta?: { next_cursor?: number };
      };
      const raw = json.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const out: ProviderStats[] = [];
      for (const s of list) {
        const stats = s.stats as Record<string, unknown> | undefined;
        const playerId = s.player_id ?? (s as { player?: { id: number } }).player?.id;
        if (playerId == null) continue;
        // Stats can be top-level (NBASeasonAverages) or in stats (NBASeasonAverageV2)
        const gp = (stats?.games_played ?? s.games_played) as number | undefined;
        const min = (stats?.min ?? s.min) as string | undefined;
        const pts = (stats?.pts ?? stats?.points ?? s.pts) as number | undefined;
        const ast = (stats?.ast ?? stats?.assists ?? s.ast) as number | undefined;
        const reb = (stats?.reb ?? stats?.rebounds ?? stats?.total_rebounds ?? s.reb) as number | undefined;
        out.push({
          providerPlayerId: String(playerId),
          seasonYear,
          gamesPlayed: typeof gp === "number" ? gp : 0,
          minutesPerGame: parseMinutes(min),
          starts: 0,
          pointsPerGame: typeof pts === "number" ? pts : 0,
          assistsPerGame: typeof ast === "number" ? ast : 0,
          reboundsPerGame: typeof reb === "number" ? reb : 0,
        });
      }
      const meta = json.meta as { next_cursor?: number } | undefined;
      let cursor = meta?.next_cursor;
      while (cursor != null && cursor > 0) {
        const nextRes = await fetch(
          `${workingBase}?${params}&cursor=${cursor}`,
          { headers: headers() }
        );
        if (!nextRes.ok) break;
        const nextJson = (await nextRes.json()) as {
          data?: (BDLSeasonAverage & { stats?: Record<string, unknown>; games_played?: number; min?: string; pts?: number; ast?: number; reb?: number })[];
          meta?: { next_cursor?: number };
        };
        const nextList = nextJson.data ?? [];
        for (const s of nextList) {
          const stats = s.stats as Record<string, unknown> | undefined;
          const playerId = s.player_id ?? (s as { player?: { id: number } }).player?.id;
          if (playerId == null) continue;
          const gp = (stats?.games_played ?? s.games_played) as number | undefined;
          const min = (stats?.min ?? s.min) as string | undefined;
          const pts = (stats?.pts ?? stats?.points ?? s.pts) as number | undefined;
          const ast = (stats?.ast ?? stats?.assists ?? s.ast) as number | undefined;
          const reb = (stats?.reb ?? stats?.rebounds ?? stats?.total_rebounds ?? s.reb) as number | undefined;
          out.push({
            providerPlayerId: String(playerId),
            seasonYear,
            gamesPlayed: typeof gp === "number" ? gp : 0,
            minutesPerGame: parseMinutes(min),
            starts: 0,
            pointsPerGame: typeof pts === "number" ? pts : 0,
            assistsPerGame: typeof ast === "number" ? ast : 0,
            reboundsPerGame: typeof reb === "number" ? reb : 0,
          });
        }
        cursor = nextJson.meta?.next_cursor;
      }
      return out;
    } catch {
      return [];
    }
  },
};
