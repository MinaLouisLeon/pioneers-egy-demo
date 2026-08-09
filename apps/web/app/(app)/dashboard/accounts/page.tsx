import type { Metadata } from "next";

import { AccountsClient } from "@/components/accounts/accounts-client";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { listAdminUsers } from "@/lib/admin";

export const metadata: Metadata = { title: "Accounts" };

/**
 * Admin-only. `requireRole` redirects anyone else before a byte of this page is
 * rendered — hiding the nav item is cosmetic, this is the enforcement.
 */
export default async function AccountsPage() {
  const profile = await requireRole(["admin"]);
  const users = await listAdminUsers();

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Invite colleagues, set what they can access, and deactivate people who have left."
      />
      <AccountsClient initialUsers={users} currentUserId={profile.id} />
    </>
  );
}
