import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runComparativeAnalysis } from "@/lib/analysis";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    period?: string;
  };

  const period = body.period ?? "last_30d";

  try {
    const analysis = await runComparativeAnalysis({
      userId: session.user.id,
      period,
    });

    return NextResponse.json(
      {
        id: analysis.id,
        period: analysis.period,
        accountId: analysis.accountId,
        adsCount: analysis.adsCount,
        winnersCount: analysis.winnersCount,
        losersCount: analysis.losersCount,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to run analysis" },
      { status: 400 },
    );
  }
}

