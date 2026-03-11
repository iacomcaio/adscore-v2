import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureTranscriptionForVideo } from "@/lib/transcription";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { videoId?: string };
  if (!body.videoId || typeof body.videoId !== "string") {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  try {
    const transcription = await ensureTranscriptionForVideo({
      userId: session.user.id,
      videoId: body.videoId,
    });

    return NextResponse.json(
      {
        videoId: body.videoId,
        transcription,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Failed to transcribe video" },
      { status: 500 },
    );
  }
}

