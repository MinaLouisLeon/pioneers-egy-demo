import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Route guard + session refresh.
 *
 * Next 16 renamed the `middleware.ts` convention to `proxy.ts`; the behaviour
 * is unchanged.
 *
 * Two things happen on every matched request:
 *
 *  1. `getClaims()` is called *early*, before any response is produced. It
 *     verifies the JWT signature and refreshes the session if the access token
 *     has expired, writing the new cookies onto the response we are about to
 *     return. If a refresh landed after the response was committed, the new
 *     session would be lost and every request would re-refresh.
 *
 *  2. Unauthenticated visitors are redirected to /login, and authenticated ones
 *     are bounced off the auth pages.
 *
 * This is a convenience layer, not the security boundary — RLS in Postgres and
 * the per-route checks in lib/auth.ts are. A proxy alone cannot be trusted to
 * protect data.
 */

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/set-password", "/verify", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Preserve where they were heading so login can send them back.
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation output. Note the
     * public certificate-verify page IS matched (so its session is refreshed if
     * the visitor happens to be signed in) but is allow-listed above.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
