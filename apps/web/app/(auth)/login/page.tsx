import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;

  const nextParam = typeof params.next === "string" ? params.next : null;
  const errorParam = typeof params.error === "string" ? params.error : null;

  // Resolve the redirect target on the server so the form does not need
  // useSearchParams (which would force a Suspense boundary and a client-side
  // bailout on an otherwise static page). Only same-origin paths are accepted,
  // so a crafted ?next=https://evil.example cannot turn login into an open
  // redirect.
  const redirectTo =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  return (
    <LoginForm
      redirectTo={redirectTo}
      initialError={
        errorParam === "link-invalid"
          ? "That sign-in link is no longer valid. Please request a new one."
          : null
      }
    />
  );
}
