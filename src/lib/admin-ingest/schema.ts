import { z } from "zod";

export const teamRowSchema = z.object({
  name: z.string().min(1),
  abbrev: z.string().length(3),
  provider_team_id: z.string().optional(),
});

export const playerRowSchema = z.object({
  provider_player_id: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primary_position: z.enum(["PG", "SG", "SF", "PF", "C"]),
});

export const contractRowSchema = z.object({
  provider_player_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birthdate: z.string().optional(),
  team_abbrev: z.string().length(3),
  salary: z.number().min(0),
  years_remaining: z.number().int().min(0).default(1),
  has_player_option: z.boolean().default(false),
  has_team_option: z.boolean().default(false),
  is_ufa_after_season: z.boolean().default(false),
  is_rfa_after_season: z.boolean().default(false),
  guaranteed_pct: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

export const metricsRowSchema = z.object({
  provider_player_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birthdate: z.string().optional(),
  team_abbrev: z.string().length(3),
  games_played: z.number().int().min(0),
  minutes_per_game: z.number().min(0),
  starts: z.number().int().min(0),
  points_per_game: z.number().min(0),
  assists_per_game: z.number().min(0),
  rebounds_per_game: z.number().min(0),
  overall_rating: z.number().min(0).max(100).optional(),
});

export const accoladesRowSchema = z.object({
  provider_player_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birthdate: z.string().optional(),
  all_star_appearances: z.number().int().min(0).default(0),
  championships: z.number().int().min(0).default(0),
});

export const ingestPayloadSchema = z.object({
  season_year: z.number().int().min(2000).max(2040),
  salary_cap: z.number().min(0).optional(),
  teams: z.array(teamRowSchema).optional(),
  players: z.array(playerRowSchema).optional(),
  contracts: z.array(contractRowSchema).optional(),
  metrics: z.array(metricsRowSchema).optional(),
  accolades: z.array(accoladesRowSchema).optional(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
