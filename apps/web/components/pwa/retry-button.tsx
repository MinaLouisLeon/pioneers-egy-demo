"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@pioneers/ui/components/button";

export function RetryButton() {
  return (
    <Button onClick={() => window.location.reload()} className="w-full">
      <RefreshCw /> Try again
    </Button>
  );
}
