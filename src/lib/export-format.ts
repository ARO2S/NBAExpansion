import type { ExpansionRules } from "./rules-schema";

export interface DraftPickForExport {
  pickNumber: number;
  playerName: string;
  position: string;
  age?: number;
  rating?: number;
  salary?: number;
  yearsRemaining?: number;
  hasPlayerOption?: boolean;
  hasTeamOption?: boolean;
  isUFA?: boolean;
  isRFA?: boolean;
  fromTeam: string;
}

export interface ExportContext {
  runName: string;
  runDate: string;
  picks: DraftPickForExport[];
  expansionTeamName: string;
  totalSalary: number;
  expansionCap: number;
  salaryFloor: number;
  rules: ExpansionRules;
}

const POSITION_ORDER = ["PG", "SG", "SF", "PF", "C"];

function sortPicksByPosition(picks: DraftPickForExport[]): DraftPickForExport[] {
  return [...picks].sort((a, b) => {
    const aIdx = POSITION_ORDER.indexOf(a.position);
    const bIdx = POSITION_ORDER.indexOf(b.position);
    const ai = aIdx === -1 ? 99 : aIdx;
    const bi = bIdx === -1 ? 99 : bIdx;
    if (ai !== bi) return ai - bi;
    return a.pickNumber - b.pickNumber;
  });
}

export function formatTextExport(ctx: ExportContext): string {
  const sorted = sortPicksByPosition(ctx.picks);
  const lines: string[] = [
    `NBA EXPANSION DRAFT: ${ctx.runName}`,
    `Date: ${ctx.runDate}`,
    ``,
    `--- ${ctx.expansionTeamName} Roster ---`,
    ``,
  ];

  let lastPos = "";
  for (const p of sorted) {
    if (p.position !== lastPos) {
      lines.push(`${p.position}s:`);
      lastPos = p.position;
    }
    const ageStr = p.age != null ? `, Age ${p.age}` : "";
    const ratingStr = p.rating != null ? `, Rating ${p.rating}` : "";
    lines.push(`  ${p.pickNumber}. ${p.playerName} (${p.fromTeam})${ageStr}${ratingStr}`);
  }

  lines.push(``);
  lines.push(`Total picks: ${ctx.picks.length}`);

  return lines.join("\n");
}

export function formatTextContractsExport(ctx: ExportContext): string {
  const sorted = sortPicksByPosition(ctx.picks);
  const lines: string[] = [
    `NBA EXPANSION DRAFT: ${ctx.runName}`,
    `Date: ${ctx.runDate}`,
    ``,
    `--- ${ctx.expansionTeamName} Roster (with contracts) ---`,
    ``,
  ];

  for (const p of sorted) {
    const salaryStr = p.salary != null ? `$${(p.salary / 1_000_000).toFixed(2)}M` : "N/A";
    const yrsStr = p.yearsRemaining != null ? `${p.yearsRemaining} yrs` : "";
    const opts: string[] = [];
    if (p.hasPlayerOption) opts.push("PO");
    if (p.hasTeamOption) opts.push("TO");
    if (p.isUFA) opts.push("UFA");
    if (p.isRFA) opts.push("RFA");
    const optsStr = opts.length ? ` [${opts.join(", ")}]` : "";
    lines.push(
      `${p.pickNumber}. ${p.playerName} | ${p.position} | ${salaryStr} | ${yrsStr}${optsStr} | from ${p.fromTeam}`
    );
  }

  lines.push(``);
  lines.push(`--- Cap Summary ---`);
  lines.push(`Total Salary: $${(ctx.totalSalary / 1_000_000).toFixed(2)}M`);
  lines.push(`Expansion Cap:  $${(ctx.expansionCap / 1_000_000).toFixed(2)}M`);
  lines.push(`Salary Floor:   $${(ctx.salaryFloor / 1_000_000).toFixed(2)}M`);

  return lines.join("\n");
}
