import { prisma } from "@/lib/prisma";
import { getVideoSource } from "@/lib/meta-api";

export type TranscriptionSegments = {
  full: string;
  hook: string | null;
  meio: string | null;
  cta: string | null;
};

function splitTranscriptionIntoSegments(text: string): TranscriptionSegments {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { full: text, hook: null, meio: null, cta: null };
  }

  const total = words.length;
  const hookCount = Math.max(1, Math.floor(total * 0.3));
  const ctaCount = Math.max(1, Math.floor(total * 0.15));
  const meioStart = hookCount;
  const meioEnd = Math.max(meioStart, total - ctaCount);

  const hookWords = words.slice(0, hookCount);
  const meioWords = words.slice(meioStart, meioEnd);
  const ctaWords = words.slice(meioEnd);

  return {
    full: text,
    hook: hookWords.length ? hookWords.join(" ") : null,
    meio: meioWords.length ? meioWords.join(" ") : null,
    cta: ctaWords.length ? ctaWords.join(" ") : null,
  };
}

async function callWhisperWithUrl(audioUrl: string): Promise<string> {
  const whisperUrl = process.env.WHISPER_API_URL;
  const whisperKey = process.env.WHISPER_API_KEY;

  if (!whisperUrl || !whisperKey) {
    throw new Error("Whisper API is not configured");
  }

  const res = await fetch(whisperUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${whisperKey}`,
    },
    body: JSON.stringify({ audio_url: audioUrl }),
  });

  if (!res.ok) {
    throw new Error("Failed to transcribe audio with Whisper");
  }

  const json = (await res.json()) as { text?: string };

  if (!json.text) {
    throw new Error("Whisper response did not include text");
  }

  return json.text;
}

export async function ensureTranscriptionForVideo(params: {
  userId: string;
  videoId: string;
}): Promise<TranscriptionSegments> {
  const { userId, videoId } = params;

  const existing = await prisma.transcription.findUnique({
    where: { videoId },
  });

  if (existing) {
    return {
      full: existing.full,
      hook: existing.hook,
      meio: existing.meio,
      cta: existing.cta,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.metaToken) {
    throw new Error("User does not have a Meta token configured");
  }

  const sourceUrl = await getVideoSource({
    videoId,
    accessToken: user.metaToken,
  });

  const text = await callWhisperWithUrl(sourceUrl);
  const segments = splitTranscriptionIntoSegments(text);

  await prisma.transcription.create({
    data: {
      videoId,
      full: segments.full,
      hook: segments.hook,
      meio: segments.meio,
      cta: segments.cta,
    },
  });

  return segments;
}

