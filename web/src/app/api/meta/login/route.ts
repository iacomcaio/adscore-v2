import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMetaOAuthUrl } from "@/lib/meta-api";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect("/login");
  }

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/meta/callback`;

  const metaAuthUrl = getMetaOAuthUrl(redirectUri);

  return NextResponse.redirect(metaAuthUrl);
}

