"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once the page is idle.
 *
 * Registering during load competes with the app's own resources for bandwidth,
 * which is exactly wrong on the poor connections this app is used on.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // A worker registered against localhost during development shadows fresh
    // builds and produces very confusing stale-asset bugs.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failing only costs the offline page; the app still works.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
