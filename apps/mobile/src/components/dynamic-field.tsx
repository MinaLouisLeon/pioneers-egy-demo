import { Pressable, Text, View } from "react-native";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import type { FieldSpec } from "@pioneers/core/forms";

import { Field, Input } from "@/components/ui";
import { radius, spacing } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Native renderer for a FieldSpec from @pioneers/core.
 *
 * The counterpart to apps/web/components/forms/dynamic-field.tsx: same specs,
 * same Zod schemas, same validation messages — different primitives. This pair
 * of files is the entire per-platform cost of a new inspection form type.
 */
export function DynamicField<TValues extends FieldValues>({
  spec,
  control,
  namePrefix = "",
}: {
  spec: FieldSpec;
  control: Control<TValues>;
  namePrefix?: string;
}) {
  const theme = useTheme();

  // Photos are captured through the camera flow, not a form control.
  if (spec.kind === "photos") return null;

  const name = `${namePrefix}${spec.name}` as Path<TValues>;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={spec.label}
          required={spec.required}
          hint={spec.helpText}
          error={fieldState.error?.message}
        >
          {spec.kind === "textarea" ? (
            <Input
              value={String(field.value ?? "")}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={spec.placeholder}
              multiline
              numberOfLines={spec.rows ?? 4}
              style={{
                minHeight: 24 * (spec.rows ?? 4),
                textAlignVertical: "top",
                paddingTop: spacing.md,
              }}
              hasError={!!fieldState.error}
            />
          ) : spec.kind === "number" ? (
            <View style={{ position: "relative", justifyContent: "center" }}>
              <Input
                // Numeric inputs come back as strings on native. Empty becomes
                // NaN, not 0, so a blank quantity fails the "required" check
                // rather than silently recording zero — same rule as the web.
                value={
                  field.value === undefined || field.value === null || Number.isNaN(field.value)
                    ? ""
                    : String(field.value)
                }
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.-]/g, "");
                  field.onChange(cleaned === "" ? Number.NaN : Number(cleaned));
                }}
                onBlur={field.onBlur}
                placeholder={spec.placeholder}
                keyboardType="number-pad"
                hasError={!!fieldState.error}
                style={spec.unit ? { paddingRight: 40 } : undefined}
              />
              {spec.unit ? (
                <Text
                  style={{
                    position: "absolute",
                    right: spacing.md,
                    color: theme.colors.textMuted,
                    fontSize: 15,
                  }}
                >
                  {spec.unit}
                </Text>
              ) : null}
            </View>
          ) : spec.kind === "select" || spec.kind === "radio" ? (
            /*
             * A native picker is a poor fit here: the option sets are short
             * (2–5 items) and inspectors are often wearing gloves, so large
             * tappable chips beat a wheel or a modal list.
             */
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {spec.options.map((option) => {
                const selected = field.value === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => field.onChange(option.value)}
                    style={{
                      paddingVertical: 11,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      minHeight: 46,
                      justifyContent: "center",
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected
                        ? theme.dark
                          ? theme.colors.surfaceAlt
                          : "#e4edf9"
                        : theme.colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? theme.colors.primary : theme.colors.text,
                        fontWeight: selected ? "600" : "400",
                        fontSize: 14,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Input
              value={String(field.value ?? "")}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={spec.placeholder}
              hasError={!!fieldState.error}
            />
          )}
        </Field>
      )}
    />
  );
}
