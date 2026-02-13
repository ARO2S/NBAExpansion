import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const { status } = body;
    const valid = ["setup", "protecting", "drafting", "complete"];
    if (!valid.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }
    await prisma.draftRun.update({
      where: { id: runId },
      data: { status },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
