import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
