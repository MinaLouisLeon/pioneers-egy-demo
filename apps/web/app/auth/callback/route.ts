import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing point for invite and password-reset emails.
 *
 * Supabase sends either `?code=` (PKCE) or `?token_hash=&type=`, depending on
 * how the email template is configured, so both are handled. On success the
 * session cookie is set and the user continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next");

  // Only ever redirect within this origin.
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const supabase = await getSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "email" | "signup" | "magiclink",
    });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const failure = new URL("/login", origin);
  failure.searchParams.set("error", "link-invalid");
  return NextResponse.redirect(failure);
}
