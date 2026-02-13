/**
 * Licensed data provider adapters - optional integrations.
 * Keys stored in env; never expose raw provider feeds to client.
 */

export interface ProviderTeam {
  providerTeamId: string;
  name: string;
  abbrev: string;
}

export interface ProviderPlayer {
  providerPlayerId: string;
  firstName: string;
  lastName: string;
  birthdate: Date;
  primaryPosition: string;
}

export interface ProviderRosterItem {
  providerPlayerId: string;
  providerTeamId: string;
  seasonYear: number;
}

export interface ProviderSalary {
  providerPlayerId: string;
  providerTeamId: string;
  seasonYear: number;
  salary: number;
  yearsRemaining?: number;
  hasPlayerOption?: boolean;
  hasTeamOption?: boolean;
  isUFA?: boolean;
  isRFA?: boolean;
}

export interface ProviderStats {
  providerPlayerId: string;
  seasonYear: number;
  gamesPlayed: number;
  minutesPerGame: number;
  starts: number;
  pointsPerGame?: number;
  assistsPerGame?: number;
  reboundsPerGame?: number;
  overallRating?: number;
  impactMetric?: number;
}

export interface DataProviderAdapter {
  syncTeams(seasonYear: number): Promise<ProviderTeam[]>;
  syncPlayers(seasonYear: number): Promise<ProviderPlayer[]>;
  syncRosters(seasonYear: number): Promise<ProviderRosterItem[]>;
  syncSalaries(seasonYear: number): Promise<ProviderSalary[]>;
  syncStats(seasonYear: number): Promise<ProviderStats[]>;
}
