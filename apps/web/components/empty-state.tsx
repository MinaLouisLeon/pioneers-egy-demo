import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@pioneers/ui/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-balance text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
