import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixed UUIDs for idempotent seed
const SEASON_ID = "00000000-0000-0000-0000-000000000001";
const TEAM_IDS = [
  "10000000-0000-0000-0000-000000000001",
  "10000000-0000-0000-0000-000000000002",
  "10000000-0000-0000-0000-000000000003",
  "10000000-0000-0000-0000-000000000004",
];

const RULES_DEFAULT = {
  protectLimitPerTeam: 8,
  eachExistingTeamCanLoseMax: 1,
  maxSelectedFromSameTeamTotal: 1,
  expansionDraftMinPicks: 14,
  expansionDraftMaxPicks: 30,
  uFAExemptFromProtection: true,
  allowDraftingPlayersWithOptions: true,
  rfaMode: "risk" as const,
  expansionCapPctYear1: 0.667,
  expansionCapPctYear2: 0.8,
  salaryFloorPct: 0.9,
  scoringWeights: {
    impact: 0.45,
    age: 0.2,
    contract: 0.25,
    availability: 0.1,
  },
  ageCurve: {
    peakAgeStart: 24,
    peakAgeEnd: 30,
    declineStart: 31,
    steepDeclineStart: 34,
  },
  contractPenalty: {
    salaryWeight: 0.4,
    yearsWeight: 0.4,
    ageInteractionWeight: 0.2,
  },
  availabilityWindowYears: 2,
  positionalBalanceWarnings: true,
};

async function main() {
  const seasonYear = 2025; // 2025-26 season

  // Idempotent: delete dependent data first (draft runs, exports, picks, protection lists, etc.)
  await prisma.export.deleteMany({});
  await prisma.draftPick.deleteMany({});
  await prisma.protectionListItem.deleteMany({});
  await prisma.protectionList.deleteMany({});
  await prisma.runTeam.deleteMany({});
  await prisma.draftRun.deleteMany({});
  await prisma.playerSeasonMetric.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.season.deleteMany({});

  // Create season
  await prisma.season.create({
    data: {
      id: SEASON_ID,
      year: seasonYear,
      salaryCap: 140_000_000,
      salaryFloorPct: 0.9,
      expansionCapPctYear1: 0.667,
      expansionCapPctYear2: 0.8,
      rulesDefaultJson: RULES_DEFAULT as object,
    },
  });

  const teams = [
    { id: TEAM_IDS[0], name: "Boston Celtics", abbrev: "BOS" },
    { id: TEAM_IDS[1], name: "Los Angeles Lakers", abbrev: "LAL" },
    { id: TEAM_IDS[2], name: "Golden State Warriors", abbrev: "GSW" },
    { id: TEAM_IDS[3], name: "Miami Heat", abbrev: "MIA" },
  ];

  for (const t of teams) {
    await prisma.team.create({
      data: {
        id: t.id,
        seasonId: SEASON_ID,
        name: t.name,
        abbrev: t.abbrev,
        isExpansion: false,
      },
    });
  }

  // 48 players: mix of young/old, cheap/expensive, injured, expiring, player option
  const positions = ["PG", "SG", "SF", "PF", "C"] as const;
  const firstNames = [
    "Jayson", "Jaylen", "Derrick", "Marcus", "Al", "Robert", "Grant", "Payton",
    "LeBron", "Anthony", "Austin", "D'Angelo", "Rui", "Jarred", "Gabe", "Max",
    "Stephen", "Andrew", "Draymond", "Klay", "Jonathan", "Kevon", "Gary", "Moses",
    "Jimmy", "Bam", "Tyler", "Terry", "Jaime", "Duncan", "Haywood", "Thomas",
  ];
  const lastNames = [
    "Tatum", "Brown", "White", "Smart", "Horford", "Williams", "Williams", "Pritchard",
    "James", "Davis", "Reaves", "Russell", "Hachimura", "Vanderbilt", "Vincent", "Christie",
    "Curry", "Wiggins", "Green", "Thompson", "Kuminga", "Looney", "Payton", "Moody",
    "Butler", "Adebayo", "Herro", "Rozier", "Jaquez", "Robinson", "Highsmith", "Bryant",
    "Smith", "Johnson", "Williams", "Jones", "Davis", "Wilson", "Taylor", "Anderson",
    "Moore", "Clark", "Lewis", "Walker", "Hall", "Young", "King", "Wright",
  ];

  const playerData: Array<{
    firstName: string;
    lastName: string;
    birthYear: number;
    position: string;
    salary: number;
    yearsRemaining: number;
    hasPlayerOption: boolean;
    hasTeamOption: boolean;
    isUFA: boolean;
    isRFA: boolean;
    gamesPlayed: number;
    minutesPerGame: number;
    starts: number;
    overallRating: number;
  }> = [];

  for (let i = 0; i < 48; i++) {
    const teamIdx = i % 4;
    const posIdx = i % 5;
    const birthYear = 1988 + (i % 18);
    const salary = 2_000_000 + (i % 25) * 1_500_000;
    const yearsRemaining = i % 5;
    const hasPlayerOption = i % 7 === 3;
    const hasTeamOption = i % 11 === 5;
    const isUFA = yearsRemaining === 0 && !hasPlayerOption && i % 3 === 1;
    const isRFA = yearsRemaining === 0 && !hasPlayerOption && i % 3 === 2;
    const gamesPlayed = i % 6 === 2 ? 25 : 65 + (i % 18);
    const minutesPerGame = 18 + (i % 25);
    const starts = Math.floor(gamesPlayed * (0.2 + (i % 8) / 10));
    const overallRating = 55 + (i % 40);

    playerData.push({
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      birthYear,
      position: positions[posIdx],
      salary,
      yearsRemaining,
      hasPlayerOption,
      hasTeamOption,
      isUFA,
      isRFA,
      gamesPlayed,
      minutesPerGame,
      starts,
      overallRating,
    });
  }

  for (let i = 0; i < 48; i++) {
    const p = playerData[i];
    const playerId = `20000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
    const teamId = TEAM_IDS[i % 4];
    const birthdate = new Date(p.birthYear, 5, 15);

    await prisma.player.create({
      data: {
        id: playerId,
        firstName: p.firstName,
        lastName: p.lastName,
        birthdate,
        primaryPosition: p.position,
      },
    });

    const contractId = `30000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
    await prisma.contract.create({
      data: {
        id: contractId,
        seasonId: SEASON_ID,
        teamId,
        playerId,
        salary: p.salary,
        yearsRemaining: p.yearsRemaining,
        hasPlayerOption: p.hasPlayerOption,
        hasTeamOption: p.hasTeamOption,
        isUFAAfterSeason: p.isUFA,
        isRFAAfterSeason: p.isRFA,
      },
    });

    const metricId = `40000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`;
    await prisma.playerSeasonMetric.create({
      data: {
        id: metricId,
        seasonId: SEASON_ID,
        playerId,
        teamId,
        gamesPlayed: p.gamesPlayed,
        minutesPerGame: p.minutesPerGame,
        starts: p.starts,
        pointsPerGame: 8 + (i % 25),
        assistsPerGame: 1 + (i % 8),
        reboundsPerGame: 2 + (i % 12),
        overallRating: p.overallRating,
      },
    });
  }

  console.log("Seed completed: 1 season, 4 teams, 48 players, contracts, metrics");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
