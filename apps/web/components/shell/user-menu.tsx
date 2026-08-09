"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { initialsOf } from "@pioneers/core/format";
import { ROLE_LABELS, type UserRole } from "@pioneers/core/roles";
import { Avatar, AvatarFallback } from "@pioneers/ui/components/avatar";
import { Button } from "@pioneers/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pioneers/ui/components/dropdown-menu";

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: UserRole;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 px-2 py-2"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initialsOf(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">{fullName}</div>
            <div className="text-muted-foreground truncate text-xs">{ROLE_LABELS[role]}</div>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{fullName}</div>
          <div className="text-muted-foreground truncate text-xs">{email}</div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* A form POST, so signing out cannot be triggered by a stray GET. */}
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut className="size-4" /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
