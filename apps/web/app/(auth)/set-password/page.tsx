import type { Metadata } from "next";

import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

/**
 * Reached from an invite or password-reset email, after /auth/callback has
 * exchanged the code for a session. The user is technically signed in at this
 * point, which is what allows `updateUser` to set the password.
 */
export default function SetPasswordPage() {
  return <SetPasswordForm />;
}
