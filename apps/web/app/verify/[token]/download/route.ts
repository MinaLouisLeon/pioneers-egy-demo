import { NextResponse, type NextRequest } from "next/server";

import { resolveShareToken } from "@/lib/verify";

type Context = { params: Promise<{ token: string }> };

/**
 * Redirect a public visitor to a freshly signed R2 URL.
 *
 * A separate route from the page so downloads are counted independently of
 * views, and so the presigned URL is generated at the moment the user clicks
 * rather than when the page was rendered — a page left open for ten minutes
 * would otherwise hand out an expired link.
 */
export async function GET(request: NextRequest, { params }: Context) {
  const { token } = await params;

  const result = await resolveShareToken(token, {
    action: "download",
    userAgent: request.headers.get("user-agent"),
  });

  if (result.status !== "ok" || !result.downloadUrl) {
    return NextResponse.redirect(new URL(`/verify/${token}`, request.nextUrl.origin));
  }

  return NextResponse.redirect(result.downloadUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
