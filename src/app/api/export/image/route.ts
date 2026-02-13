import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/export/${runId}`;

  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
    });
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    const buffer = await page.screenshot({
      type: "png",
      fullPage: true,
      timeout: 5000,
    });

    await browser.close();

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="expansion-draft-${runId.slice(0, 8)}.png"`,
      },
    });
  } catch (e) {
    if (browser) await browser.close();
    console.error("Image export failed:", e);
    return NextResponse.json(
      { error: "Image export failed. Ensure BASE_URL is set and server is running." },
      { status: 500 }
    );
  }
}
