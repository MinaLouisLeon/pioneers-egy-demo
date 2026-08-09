"use client";

import { useEffect, useState } from "react";

import { Download, X } from "lucide-react";

import { Button } from "@pioneers/ui/components/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pioneers:install-dismissed";

/**
 * "Install app" banner, shown only when Chrome/Edge says the app is actually
 * installable (which requires HTTPS, a manifest and a service worker).
 *
 * Dismissal is remembered so the banner does not nag on every visit.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    function onBeforeInstallPrompt(event: Event) {
      // Suppress the browser's own mini-infobar so we can place the prompt.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
      localStorage.setItem(DISMISSED_KEY, "installed");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferred(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="bg-card fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-lg border p-3 shadow-lg sm:left-auto sm:w-96">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
        <Download className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install Pioneers-EGY</p>
        <p className="text-muted-foreground text-balance text-xs">
          Add it to your device for quicker access and an offline fallback.
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" onClick={() => void install()}>
          Install
        </Button>
        <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss">
          <X />
        </Button>
      </div>
    </div>
  );
}
