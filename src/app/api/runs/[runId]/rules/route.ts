import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expansionRulesSchema } from "@/lib/rules-schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const parsed = expansionRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const run = await prisma.draftRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (run.status !== "setup" && run.status !== "protecting") {
      return NextResponse.json(
        { error: "Cannot modify rules at this stage" },
        { status: 400 }
      );
    }
    await prisma.draftRun.update({
      where: { id: runId },
      data: { rulesSnapshotJson: parsed.data as object },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update rules" },
      { status: 500 }
    );
  }
}
