import { resolveShareToken } from "@/lib/verify";

type Context = { params: Promise<{ token: string }> };

/**
 * Public certificate lookup — no authentication.
 *
 * Exists so the Expo QR scanner can resolve a token without opening a browser.
 * All the access rules live in resolveShareToken().
 */
export async function GET(request: Request, { params }: Context) {
  const { token } = await params;

  const result = await resolveShareToken(token, {
    action: "view",
    userAgent: request.headers.get("user-agent"),
  });

  return Response.json(result, {
    status: result.status === "ok" ? 200 : 404,
    // Signed download URLs are short-lived and each view is logged, so this
    // response must never be cached by a browser, CDN or proxy.
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
