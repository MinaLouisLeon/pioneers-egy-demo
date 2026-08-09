import type { Metadata } from "next";

import { WifiOff } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@pioneers/ui/components/card";

import { BrandLockup } from "@/components/brand";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no connection.
 *
 * Must not read cookies or query the database — it has to be a fully static
 * page for the worker to be able to cache it at install time.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-center border-b px-4 py-4">
        <BrandLockup showTagline />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="bg-muted text-muted-foreground mb-2 flex size-11 items-center justify-center rounded-full">
              <WifiOff className="size-5" aria-hidden />
            </div>
            <CardTitle>You are offline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-balance text-sm">
              This page needs a connection. Reconnect and try again — anything you had already saved
              is safe on the server.
            </p>
            <p className="text-muted-foreground text-balance text-sm">
              Working somewhere without signal? Use the Pioneers-EGY mobile app, which records
              inspections offline and syncs them when you are back in range.
            </p>
            <RetryButton />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
