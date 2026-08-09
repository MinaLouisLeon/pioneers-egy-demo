import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * The proxy already redirects `/` for both signed-in and signed-out visitors;
 * this is the belt-and-braces case where the proxy is bypassed (for example a
 * statically prefetched navigation).
 */
export default async function RootPage() {
  const profile = await getCurrentUser();
  redirect(profile ? "/dashboard" : "/login");
}
