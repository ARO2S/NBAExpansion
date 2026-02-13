/**
 * Basketball-Reference.com NBA contracts scraper.
 * Fetches from https://www.basketball-reference.com/contracts/players.html
 * Table: Rk, Player, Tm, 2025-26, 2026-27, ... (salary columns).
 *
 * Use sparingly; respect the site. Same row shape as Spotrac for sync reuse.
 */

import type { SpotracContractRow } from "./spotrac";

const BBR_CONTRACTS_URL = "https://www.basketball-reference.com/contracts/players.html";
const USER_AGENT =
  "Mozilla/5.0 (compatible; NBAExpansion/1.0; +https://github.com/nba-expansion)";

/** BBR uses PHO, BRK; our DB may use PHX, BKN from other providers */
const BBR_TEAM_TO_OURS: Record<string, string> = {
  pho: "PHX",
  brk: "BKN",
};

function normalizeTeamAbbrev(raw: string): string {
  const r = raw.trim().toUpperCase();
  const key = r.toLowerCase();
  return BBR_TEAM_TO_OURS[key] ?? r;
}

function parseMoney(text: string): number {
  const cleaned = String(text).replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Scrape BBR player contracts and return rows for the given season.
 * seasonYear 2025 -> uses column "2025-26" as current salary; years = remaining non-empty years.
 */
export async function scrapeBBRContracts(
  seasonYear: number
): Promise<SpotracContractRow[]> {
  const { chromium } = await import("playwright");
  const seasonCol = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`; // e.g. 2025-26

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
    });

    await page.goto(BBR_CONTRACTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const rows = await page.evaluate((colLabel: string) => {
      const result: { playerName: string; team: string; salary: string; yearsRemaining: number }[] = [];
      const tables = Array.from(document.querySelectorAll("table"));
      let table: Element | null = null;
      let playerIdx = -1;
      let tmIdx = -1;
      let seasonIdx = -1;

      for (const t of tables) {
        const thead = t.querySelector("thead");
        const tbody = t.querySelector("tbody");
        if (!thead || !tbody) continue;
        const headerRows = thead.querySelectorAll("tr");
        let headers: string[] = [];
        for (const row of headerRows) {
          const rowHeaders = Array.from(row.querySelectorAll("th")).map((th) =>
            (th.textContent ?? "").trim()
          );
          if (rowHeaders.includes("Player") && rowHeaders.includes("Tm")) {
            headers = rowHeaders;
            break;
          }
        }
        if (headers.length === 0) headers = Array.from(thead.querySelectorAll("th")).map((th) => (th.textContent ?? "").trim());
        const p = headers.findIndex((h) => h === "Player");
        const tm = headers.findIndex((h) => h === "Tm");
        const s = headers.findIndex((h) => h === colLabel);
        if (p >= 0 && tm >= 0 && s >= 0 && tbody.querySelectorAll("tr").length > 50) {
          table = t;
          playerIdx = p;
          tmIdx = tm;
          seasonIdx = s;
          break;
        }
      }
      if (!table || playerIdx < 0 || tmIdx < 0 || seasonIdx < 0) return result;

      const tbody = table.querySelector("tbody");
      const bodyRows = tbody ? tbody.querySelectorAll("tr") : [];
      bodyRows.forEach((tr) => {
        const cells = tr.querySelectorAll("th, td");
        if (cells.length <= Math.max(playerIdx, tmIdx, seasonIdx)) return;

        const playerCell = cells[playerIdx];
        const playerName = (
          playerCell?.querySelector("a")?.textContent ??
          playerCell?.textContent ??
          ""
        ).trim();
        const team = (cells[tmIdx]?.textContent ?? "").trim();
        const salaryText = (cells[seasonIdx]?.textContent ?? "").trim();
        if (!playerName || playerName === "Player" || playerName === "Rk") return;

        let yearsRemaining = 0;
        for (let i = seasonIdx; i < cells.length; i++) {
          const t = (cells[i]?.textContent ?? "").trim();
          if (!t || t === "") break;
          if (/^\$[\d,]+$/.test(t) || /^[\d,]+$/.test(t)) yearsRemaining++;
          else break;
        }
        if (yearsRemaining < 1) yearsRemaining = 1;

        result.push({
          playerName,
          team,
          salary: salaryText,
          yearsRemaining,
        });
      });

      return result;
    }, seasonCol);

    await browser.close();

    return rows.map((r) => {
      const salary = parseMoney(r.salary);
      return {
        playerName: r.playerName.trim(),
        teamAbbrev: r.team ? normalizeTeamAbbrev(r.team) : null,
        value: salary * Math.max(1, r.yearsRemaining),
        aav: salary,
        years: r.yearsRemaining,
      };
    });
  } catch (err) {
    await browser.close();
    throw err;
  }
}
