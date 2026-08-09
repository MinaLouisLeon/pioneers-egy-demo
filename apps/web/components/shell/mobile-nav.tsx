"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Menu } from "lucide-react";

import { Button } from "@pioneers/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@pioneers/ui/components/sheet";

import { BrandLockup } from "@/components/brand";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import type { NavItem } from "@/lib/navigation";

/** Drawer navigation for viewports below `lg`, where the sidebar is hidden. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — otherwise the drawer stays over the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandLockup />
        </SheetHeader>
        <div className="p-3">
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
