"use client";

import type { Control, FieldValues, Path } from "react-hook-form";

import type { FieldSpec } from "@pioneers/core/forms";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@pioneers/ui/components/form";
import { Input } from "@pioneers/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@pioneers/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import { Textarea } from "@pioneers/ui/components/textarea";
import { cn } from "@pioneers/ui/lib/utils";

/**
 * Renders one FieldSpec from @pioneers/core with shadcn controls.
 *
 * This is the whole reason the specs are data: the web app has exactly one
 * component that knows how to draw an inspection field, and the Expo app has
 * exactly one equivalent built from React Native primitives. Adding the real
 * environmental forms later touches neither.
 *
 * `photos` is handled by the caller (PhotoUploader) because uploading needs job
 * and task ids that a generic field renderer has no business knowing about.
 */
export function DynamicField<TValues extends FieldValues>({
  spec,
  control,
  namePrefix = "",
  disabled,
}: {
  spec: FieldSpec;
  control: Control<TValues>;
  /** e.g. "data." so field names resolve inside the task's data object. */
  namePrefix?: string;
  disabled?: boolean;
}) {
  // Photo fields need job/task ids to build an R2 key and authorise the upload,
  // which a generic field renderer has no business knowing. The caller renders
  // PhotoUploader for these.
  if (spec.kind === "photos") return null;

  const name = `${namePrefix}${spec.name}` as Path<TValues>;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn(spec.colSpan === 2 ? "sm:col-span-2" : "sm:col-span-1")}>
          <FormLabel>
            {spec.label}
            {spec.required ? (
              <span className="text-destructive" aria-hidden>
                *
              </span>
            ) : (
              <span className="text-muted-foreground font-normal">(optional)</span>
            )}
          </FormLabel>

          <FormControl>
            {spec.kind === "textarea" ? (
              <Textarea
                {...field}
                value={field.value ?? ""}
                rows={spec.rows ?? 4}
                placeholder={spec.placeholder}
                disabled={disabled}
                className="resize-y"
              />
            ) : spec.kind === "number" ? (
              <div className="relative">
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  // Empty input becomes NaN rather than 0, so a missing value
                  // fails the schema's "required" check instead of silently
                  // recording a zero quantity.
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? Number.NaN : event.target.valueAsNumber,
                    )
                  }
                  min={spec.min}
                  max={spec.max}
                  step={spec.step ?? 1}
                  placeholder={spec.placeholder}
                  disabled={disabled}
                  className={cn(spec.unit && "pr-9")}
                />
                {spec.unit ? (
                  <span
                    className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                    aria-hidden
                  >
                    {spec.unit}
                  </span>
                ) : null}
              </div>
            ) : spec.kind === "select" ? (
              <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={disabled}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={spec.placeholder ?? "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  {spec.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : spec.kind === "radio" ? (
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ""}
                disabled={disabled}
                className="flex flex-wrap gap-2 pt-1"
              >
                {spec.options.map((option) => (
                  <FormItem key={option.value} className="flex-1">
                    <FormLabel
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-normal transition-colors",
                        "hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5",
                      )}
                    >
                      <FormControl>
                        <RadioGroupItem value={option.value} />
                      </FormControl>
                      {option.label}
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            ) : (
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder={spec.placeholder}
                disabled={disabled}
              />
            )}
          </FormControl>

          {spec.helpText ? <FormDescription>{spec.helpText}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
