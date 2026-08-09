import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { loginSchema, type LoginInput } from "@pioneers/core/schemas";

import { Body, Button, Field, Input, Muted, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { spacing, radius } from "@/theme";
import { useTheme } from "@/theme/use-theme";

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) setFormError(error);
    // On success the root navigator redirects; nothing to do here.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.xl,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Body style={{ color: theme.colors.primaryText, fontSize: 22, fontWeight: "700" }}>
              P
            </Body>
          </View>
          <Title>Pioneers-EGY</Title>
          <Muted>
            Sign in with the account your administrator set up. Your work is saved on this device
            and syncs when you have signal.
          </Muted>
        </View>

        {formError ? (
          <View
            style={{
              backgroundColor: theme.colors.dangerBg,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Body style={{ color: theme.colors.danger, fontSize: 14 }}>{formError}</Body>
          </View>
        ) : null}

        <View style={{ gap: spacing.lg }}>
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field label="Email" required error={fieldState.error?.message}>
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="you@pioneers-egy.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  hasError={!!fieldState.error}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field label="Password" required error={fieldState.error?.message}>
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete="current-password"
                  hasError={!!fieldState.error}
                  onSubmitEditing={form.handleSubmit(onSubmit)}
                  returnKeyType="go"
                />
              </Field>
            )}
          />

          <Button
            title="Sign in"
            onPress={form.handleSubmit(onSubmit)}
            loading={form.formState.isSubmitting}
          />
        </View>

        <Muted style={{ textAlign: "center" }}>
          Accounts are created by an administrator. Contact yours if you need access.
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
