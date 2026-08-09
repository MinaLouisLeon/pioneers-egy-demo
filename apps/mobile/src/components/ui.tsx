import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from "react-native";

import { radius, spacing, typography } from "@/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * Small set of themed primitives so screens are not littered with inline
 * StyleSheets. Deliberately minimal — the app's visual identity comes from the
 * shared tokens, not from a component library.
 */

export function Screen({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} {...props} />;
}

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: spacing.lg,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Title({ style, ...props }: TextProps) {
  const theme = useTheme();
  return <Text style={[typography.title, { color: theme.colors.text }, style]} {...props} />;
}

export function Heading({ style, ...props }: TextProps) {
  const theme = useTheme();
  return <Text style={[typography.heading, { color: theme.colors.text }, style]} {...props} />;
}

export function Body({ style, ...props }: TextProps) {
  const theme = useTheme();
  return <Text style={[typography.body, { color: theme.colors.text }, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  const theme = useTheme();
  return <Text style={[typography.caption, { color: theme.colors.textMuted }, style]} {...props} />;
}

export function Label({ style, ...props }: TextProps) {
  const theme = useTheme();
  return <Text style={[typography.label, { color: theme.colors.text }, style]} {...props} />;
}

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...props
}: PressableProps & {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
}) {
  const theme = useTheme();

  const background = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceAlt,
    danger: theme.colors.danger,
    ghost: "transparent",
  }[variant];

  const foreground = {
    primary: theme.colors.primaryText,
    secondary: theme.colors.text,
    danger: "#ffffff",
    ghost: theme.colors.primary,
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.sm,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor: variant === "secondary" ? theme.colors.border : "transparent",
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          // 44pt is the minimum comfortable touch target, and these are pressed
          // with gloves on a windy jetty.
          minHeight: 48,
        },
        style as object,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 15, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Label>
        {label}
        {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
        {!required ? (
          <Text style={{ color: theme.colors.textMuted, fontWeight: "400" }}> (optional)</Text>
        ) : null}
      </Label>
      {children}
      {hint && !error ? <Muted>{hint}</Muted> : null}
      {error ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }: TextInputProps & { hasError?: boolean }) {
  const theme = useTheme();
  const { hasError, ...rest } = props as TextInputProps & { hasError?: boolean };

  return (
    <TextInput
      placeholderTextColor={theme.colors.textMuted}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: hasError ? theme.colors.danger : theme.colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 11,
          fontSize: 15,
          color: theme.colors.text,
          minHeight: 46,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  const theme = useTheme();

  const styles = {
    neutral: { bg: theme.colors.surfaceAlt, fg: theme.colors.textMuted },
    success: { bg: theme.colors.successBg, fg: theme.colors.success },
    warning: { bg: theme.colors.warningBg, fg: theme.colors.warning },
    danger: { bg: theme.colors.dangerBg, fg: theme.colors.danger },
    primary: { bg: theme.dark ? theme.colors.surfaceAlt : "#e4edf9", fg: theme.colors.primary },
  }[tone];

  return (
    <View
      style={{
        backgroundColor: styles.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: styles.fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Heading style={{ textAlign: "center" }}>{title}</Heading>
      {description ? (
        <Muted style={{ textAlign: "center", maxWidth: 320 }}>{description}</Muted>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
      <ActivityIndicator color={theme.colors.primary} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}
