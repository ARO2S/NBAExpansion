/**
 * SportsDataIO NBA API adapter.
 * Uses API key from SPORTSDATAIO_API_KEY env var.
 * Player data: only current active roster via /PlayersActiveBasic (no season param).
 * Teams/stats: current season only.
 *
 * @see https://sportsdata.io/developers/api-documentation/nba
 */

import type {
  DataProviderAdapter,
  ProviderTeam,
  ProviderPlayer,
  ProviderRosterItem,
  ProviderSalary,
  ProviderStats,
} from "./types";

const SCORES_BASE = "https://api.sportsdata.io/v3/nba/scores/json";
const STATS_BASE = "https://api.sportsdata.io/v3/nba/stats/json";

function getKey(): string {
  const key = process.env.SPORTSDATAIO_API_KEY;
  if (!key) {
    throw new Error("SPORTSDATAIO_API_KEY is not configured");
  }
  return key;
}

function scoresUrl(path: string): string {
  return `${SCORES_BASE}${path}?key=${getKey()}`;
}

function statsUrl(path: string): string {
  return `${STATS_BASE}${path}?key=${getKey()}`;
}

/** Normalize API response to array; some plans or endpoints return { data: [] } or {} */
function asArray<T>(raw: unknown, key?: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const arr = key ? obj[key] : obj.data ?? obj.Players ?? obj.Teams;
    if (Array.isArray(arr)) return arr as T[];
  }
  return [];
}

/** Shape of team on player from API (object or string) */
type PlayerTeamField =
  | { TeamID?: number; Key?: string; Name?: string; City?: string; abbreviation?: string }
  | string
  | undefined;

/** Get team ID from player; API may return TeamID, teamID, or nested Team.TeamID / Team.id */
function getTeamId(p: SportsDataIOPlayer): number | null {
  const o = p as unknown as {
    TeamID?: number;
    teamID?: number;
    Team?: { TeamID?: number; id?: number };
  };
  const t =
    o.TeamID ??
    o.teamID ??
    o.Team?.TeamID ??
    o.Team?.id;
  return t != null ? Number(t) : null;
}

/** Get full team info from player for upserting Team (provider TeamID + name + abbrev). */
function getTeamInfoFromPlayer(p: SportsDataIOPlayer): { providerTeamId: string; name: string; abbrev: string } | null {
  const teamId = getTeamId(p);
  if (teamId == null) return null;
  const raw = (p as unknown as { Team?: PlayerTeamField }).Team;
  if (typeof raw === "string") {
    return { providerTeamId: String(teamId), name: raw.trim() || "Unknown", abbrev: String(teamId) };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { Key?: string; Name?: string; City?: string; abbreviation?: string };
    const abbrev = obj.Key ?? obj.abbreviation ?? String(teamId);
    const name = [obj.City, obj.Name].filter(Boolean).join(" ") || (obj.Name ?? obj.Key) || "Unknown";
    return { providerTeamId: String(teamId), name, abbrev };
  }
  return { providerTeamId: String(teamId), name: "Unknown", abbrev: String(teamId) };
}

/** Get player ID; API may return PlayerID or playerID */
function getPlayerId(p: SportsDataIOPlayer): number {
  const id = (p as unknown as { PlayerID?: number; playerID?: number }).PlayerID ?? (p as unknown as { playerID?: number }).playerID ?? p.PlayerID;
  return Number(id);
}

/** Current active players only: https://api.sportsdata.io/v3/nba/scores/json/PlayersActiveBasic?key= */
const PLAYERS_ACTIVE_PATH = "/PlayersActiveBasic";

/** Fetch and parse player array from a URL; returns [] on non-OK or empty. */
async function fetchPlayersArray(url: string): Promise<SportsDataIOPlayer[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const raw = await res.json();
  return asArray<SportsDataIOPlayer>(raw) as SportsDataIOPlayer[];
}

async function fetchActivePlayers(): Promise<SportsDataIOPlayer[]> {
  const data = await fetchPlayersArray(scoresUrl(PLAYERS_ACTIVE_PATH));
  if (data.length === 0) {
    throw new Error(
      `SportsDataIO returned no players from ${PLAYERS_ACTIVE_PATH}. Check SPORTSDATAIO_API_KEY and plan access.`
    );
  }
  return data;
}

interface SportsDataIOTeam {
  TeamID: number;
  Key: string;
  Active: boolean;
  City?: string;
  Name?: string;
  LeagueID?: number;
  StadiumID?: number;
  Conference?: string;
  Division?: string;
  PrimaryColor?: string;
  SecondaryColor?: string;
  TertiaryColor?: string;
  QuaternaryColor?: string;
  WikipediaLogoUrl?: string;
  WikipediaWordMarkUrl?: string;
  GlobalTeamID?: number;
  NbaDotComTeamID?: number;
}

interface SportsDataIOPlayer {
  PlayerID: number;
  TeamID?: number;
  Team?: string;
  Jersey?: number;
  Position?: string;
  FirstName: string;
  LastName: string;
  Height?: number;
  Weight?: number;
  BirthDate?: string;
  BirthCity?: string;
  BirthState?: string;
  BirthCountry?: string;
  HighSchool?: string;
  College?: string;
  Salary?: number;
  PhotoUrl?: string;
  Experience?: number;
  SportRadarPlayerID?: string;
  RotowirePlayerID?: number;
  RotoWirePlayerID?: number;
  FantasyAlarmPlayerID?: number;
  StatsPlayerID?: number;
  SportsDirectPlayerID?: number;
  XmlTeamPlayerID?: number;
  InjuryStatus?: string;
  InjuryBodyPart?: string;
  InjuryStartDate?: string;
  InjuryNotes?: string;
  FanDuelPlayerID?: number;
  DraftKingsPlayerID?: number;
  YahooPlayerID?: number;
  FanDuelName?: string;
  DraftKingsName?: string;
  YahooName?: string;
  GlobalTeamID?: number;
  TeamID?: number;
  Status?: string;
}

interface SportsDataIOPlayerSeasonStat {
  PlayerID: number;
  Season?: number;
  Name?: string;
  Team?: string;
  TeamID?: number;
  Position?: string;
  Started?: number;
  Games?: number;
  Minutes?: number;
  Points?: number;
  Assists?: number;
  Rebounds?: number;
  TotalRebounds?: number;
  FantasyPoints?: number;
  FantasyPointsDraftKings?: number;
  FantasyPointsFanDuel?: number;
  FantasyPointsYahoo?: number;
  FantasyPointsFantasyDraft?: number;
  [key: string]: unknown;
}

export const sportsDataIOAdapter: DataProviderAdapter = {
  /** Derive teams from PlayersActiveBasic so one pull gives players + teams (with provider Team ID). */
  async syncTeams(_seasonYear: number): Promise<ProviderTeam[]> {
    const players = await fetchActivePlayers();
    const byId = new Map<string, ProviderTeam>();
    for (const p of players) {
      const info = getTeamInfoFromPlayer(p);
      if (info && !byId.has(info.providerTeamId)) {
        byId.set(info.providerTeamId, info);
      }
    }
    if (byId.size === 0) {
      throw new Error(
        `SportsDataIO ${PLAYERS_ACTIVE_PATH} returned no team info on players. Check response shape (Team or TeamID).`
      );
    }
    return Array.from(byId.values());
  },

  async syncPlayers(_seasonYear: number): Promise<ProviderPlayer[]> {
    const posMap: Record<string, string> = {
      PG: "PG",
      SG: "SG",
      G: "SG",
      SF: "SF",
      PF: "PF",
      F: "SF",
      C: "C",
      "G-F": "SG",
      "F-G": "SF",
      "F-C": "PF",
      "C-F": "PF",
    };
    const data = await fetchActivePlayers();
    return data.map((p) => {
      const pos = (p.Position || "SF").split("-")[0].trim();
      const primaryPosition = posMap[pos] || (pos.length <= 2 ? pos : "SF");
      let birthdate: Date;
      if (p.BirthDate) {
        birthdate = new Date(p.BirthDate);
      } else {
        birthdate = new Date(1995, 0, 1);
      }
      return {
        providerPlayerId: String(getPlayerId(p)),
        firstName: p.FirstName || "Unknown",
        lastName: p.LastName || "Unknown",
        birthdate,
        primaryPosition,
      };
    });
  },

  async syncRosters(seasonYear: number): Promise<ProviderRosterItem[]> {
    const players = await fetchActivePlayers();
    return players
      .filter((p) => getTeamId(p) != null)
      .map((p) => ({
        providerPlayerId: String(getPlayerId(p)),
        providerTeamId: String(getTeamId(p)!),
        seasonYear,
      }));
  },

  async syncSalaries(seasonYear: number): Promise<ProviderSalary[]> {
    try {
      const data = await fetchActivePlayers();
      const salaries: ProviderSalary[] = [];
      for (const p of data) {
        const teamId = getTeamId(p);
        if (p.Salary != null && p.Salary > 0 && teamId != null) {
          salaries.push({
            providerPlayerId: String(getPlayerId(p)),
            providerTeamId: String(teamId),
            seasonYear,
            salary: Number(p.Salary),
          });
        }
      }
      return salaries;
    } catch {
      return [];
    }
  },

  async syncStats(seasonYear: number): Promise<ProviderStats[]> {
    try {
      const res = await fetch(statsUrl(`/PlayerSeasonStats/${seasonYear}`));
      if (!res.ok) return [];
      const raw = await res.json();
      const data = asArray<SportsDataIOPlayerSeasonStat>(raw) as SportsDataIOPlayerSeasonStat[];
      return data.map((p) => ({
        providerPlayerId: String(p.PlayerID),
        seasonYear,
        gamesPlayed: p.Games ?? 0,
        minutesPerGame: p.Minutes ?? 0,
        starts: p.Started ?? 0,
        pointsPerGame: p.Points ?? 0,
        assistsPerGame: p.Assists ?? 0,
        reboundsPerGame: (p.Rebounds ?? p.TotalRebounds) ?? 0,
        overallRating: undefined,
        impactMetric: undefined,
      }));
    } catch {
      return [];
    }
  },
};
