import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST-only: a GET would let any page trigger a sign-out by embedding an image
 * or link pointing here.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
