/**
 * Canonical team abbreviation normalization.
 * Used by metrics CSV parsing and provider sync so DB and lookups use the same abbrevs.
 */

/** Maps provider/CSV abbrevs (lowercase) → canonical 3-letter abbrev */
export const TEAM_ABBREV_MAP: Record<string, string> = {
  lal: "LAL",
  lac: "LAC",
  gs: "GSW",
  gsw: "GSW",
  ny: "NYK",
  nyk: "NYK",
  no: "NOP",
  nop: "NOP",
  noh: "NOP", // BBRef uses NOH for New Orleans Pelicans (legacy)
  sa: "SAS",
  sas: "SAS",
  uta: "UTA",
  okc: "OKC",
  phx: "PHX",
  pho: "PHX", // BBRef uses PHO for Phoenix
  wsh: "WAS",
  was: "WAS",
  bkn: "BKN",
  brk: "BKN", // BBRef uses BRK for Brooklyn
  cha: "CHA",
  cho: "CHA", // BBRef uses CHO for Charlotte
  min: "MIN",
  minnesota: "MIN",
  cle: "CLE",
  bos: "BOS",
  den: "DEN",
  hou: "HOU",
  phi: "PHI",
  mem: "MEM",
  orl: "ORL",
  ind: "IND",
  mil: "MIL",
  tor: "TOR",
  mia: "MIA",
  atl: "ATL",
  dal: "DAL",
  sac: "SAC",
  por: "POR",
  chi: "CHI",
  det: "DET",
};

/** Canonical abbrev → full team name (for creating teams on-the-fly) */
export const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

/**
 * Normalize any team abbrev (from CSV, API, etc.) to canonical form.
 * Ensures DB and lookups use consistent 3-letter abbrevs.
 */
export function normalizeTeamAbbrev(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return TEAM_ABBREV_MAP[key] ?? raw.trim().toUpperCase().slice(0, 3);
}
