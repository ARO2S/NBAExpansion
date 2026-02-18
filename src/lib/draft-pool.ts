import { prisma } from "./db";
import { buildExposedPool, filterPoolByTeamLoss } from "./eligibility";

export async function getDraftPoolForRun(runId: string) {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: {
      season: true,
      protectionLists: { include: { items: true } },
      teamProtectionLocks: true,
      draftPicks: true,
    },
  });
  if (!run) return null;

  const rules = run.rulesSnapshotJson as {
    uFAExemptFromProtection?: boolean;
    allowDraftingPlayersWithOptions?: boolean;
  };

  const existingTeams = await prisma.team.findMany({
    where: { seasonId: run.seasonId, isExpansion: false },
  });

  const plByTeam = new Map(run.protectionLists.map((pl) => [pl.teamId, pl]));
  const protectedPlayerIds = new Set<string>();

  const teamsNeedingCanonical: string[] = [];
  for (const team of existingTeams) {
    const pl = plByTeam.get(team.id);
    if (pl) {
      for (const i of pl.items) {
        if (i.isProtected) protectedPlayerIds.add(i.playerId);
      }
    } else {
      teamsNeedingCanonical.push(team.id);
    }
  }

  if (teamsNeedingCanonical.length > 0) {
    const canonicalLists = await prisma.canonicalProtectionList.findMany({
      where: { seasonId: run.seasonId, teamId: { in: teamsNeedingCanonical } },
      include: { items: true },
    });
    for (const cl of canonicalLists) {
      for (const i of cl.items) {
        if (i.isProtected) protectedPlayerIds.add(i.playerId);
      }
    }
  }

  const teamsThatLost = new Set(run.draftPicks.map((p) => p.fromTeamId));

  const contracts = await prisma.contract.findMany({
    where: {
      seasonId: run.seasonId,
      team: { isExpansion: false },
    },
  });

  const contractsWithProtection = contracts.map((c) => ({
    playerId: c.playerId,
    teamId: c.teamId,
    contractId: c.id,
    salary: Number(c.salary),
    yearsRemaining: c.yearsRemaining,
    hasPlayerOption: c.hasPlayerOption,
    hasTeamOption: c.hasTeamOption,
    isUFAAfterSeason: c.isUFAAfterSeason,
    isRFAAfterSeason: c.isRFAAfterSeason,
    isProtected: protectedPlayerIds.has(c.playerId),
  }));

  const fullPool = buildExposedPool(contractsWithProtection, {
    ...rules,
    uFAExemptFromProtection: rules.uFAExemptFromProtection ?? true,
    allowDraftingPlayersWithOptions:
      rules.allowDraftingPlayersWithOptions ?? true,
  } as any);
  return filterPoolByTeamLoss(fullPool, teamsThatLost);
}
