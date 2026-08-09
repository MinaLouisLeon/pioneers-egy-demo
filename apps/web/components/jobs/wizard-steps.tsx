import { Check } from "lucide-react";

import { cn } from "@pioneers/ui/lib/utils";

export const WIZARD_STEPS = [
  { id: "details", label: "Job details", hint: "Project, company and visit date" },
  { id: "tasks", label: "Inspection tasks", hint: "Add one or more tasks" },
  { id: "review", label: "Review & submit", hint: "Check everything, then submit" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export function WizardSteps({ current }: { current: WizardStepId }) {
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
      {WIZARD_STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step.id} className="flex flex-1 items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isComplete && !isCurrent && "text-muted-foreground",
                )}
                aria-hidden
              >
                {isComplete ? <Check className="size-4" /> : index + 1}
              </span>

              <div className="min-w-0">
                <div
                  className={cn(
                    "truncate text-sm font-medium",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {isCurrent ? <span className="sr-only"> (current step)</span> : null}
                </div>
                <div className="text-muted-foreground hidden truncate text-xs lg:block">
                  {step.hint}
                </div>
              </div>
            </div>

            {index < WIZARD_STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-3 hidden h-px flex-1 sm:block",
                  isComplete ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
