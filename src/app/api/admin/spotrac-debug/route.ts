import { NextRequest, NextResponse } from "next/server";
import { SPOTRAC_CONTRACTS_URL } from "@/lib/spotrac-debug-shared";
import { requireAdmin } from "@/lib/admin";

export async function GET(_req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });

    await page.goto(SPOTRAC_CONTRACTS_URL, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const debugInfo = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table")).map((t, idx) => {
        const thead = t.querySelector("thead");
        const tbody = t.querySelector("tbody");
        const headers = thead
          ? Array.from(thead.querySelectorAll("th")).map((th) =>
              (th.textContent ?? "").trim()
            )
          : [];
        const rows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
        const sample = rows.slice(0, 3).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) =>
            (td.textContent ?? "").trim()
          )
        );
        return {
          index: idx,
          id: (t as HTMLElement).id || null,
          className: (t as HTMLElement).className || null,
          headerText: headers,
          rowCount: rows.length,
          sampleRows: sample,
        };
      });

      const bodyText = (document.body.innerText || "").slice(0, 2000);

      return { tables, bodyText };
    });

    await browser.close();

    return new NextResponse(JSON.stringify({ ok: true, ...debugInfo }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Spotrac debug failed:", e);
    return new NextResponse(
      JSON.stringify(
        { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
        null,
        2
      ),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

