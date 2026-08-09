import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { requireUser } from "@/lib/auth";
import { navItemsForRole } from "@/lib/navigation";

/**
 * Application shell.
 *
 * Layout by breakpoint:
 *   < lg   header with a drawer trigger, content full width
 *   >= lg  fixed 16rem sidebar, header collapses into the sidebar footer
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireUser();
  const items = navItemsForRole(profile.role);

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar hidden w-64 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex lg:h-svh">
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/dashboard" className="rounded-sm outline-none focus-visible:ring-2">
            <BrandLockup />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav items={items} />
        </div>

        <div className="border-t p-2">
          <UserMenu fullName={profile.full_name} email={profile.email} role={profile.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet header */}
        <header className="bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-sm lg:hidden">
          <MobileNav items={items} />
          <Link href="/dashboard" className="flex-1">
            <BrandLockup />
          </Link>
          <div className="w-44">
            <UserMenu fullName={profile.full_name} email={profile.email} role={profile.role} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
