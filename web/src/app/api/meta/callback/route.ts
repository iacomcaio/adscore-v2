import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getMetaUser,
} from "@/lib/meta-api";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect("/login");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect("/meta/connect");
  }

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/meta/callback`;

  try {
    const shortLived = await exchangeCodeForShortLivedToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const profile = await getMetaUser(longLived.access_token);

    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        metaToken: longLived.access_token,
        metaTokenExp: expiresAt,
        metaUserId: profile.id,
      },
    });
  } catch {
    // For now, just continue to the connect page; we'll add richer error handling later.
  }

  return NextResponse.redirect("/meta/connect");
}

