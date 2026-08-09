"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { setPasswordSchema, type SetPasswordInput } from "@pioneers/core/schemas";
import { Alert, AlertDescription } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@pioneers/ui/components/form";
import { Input } from "@pioneers/ui/components/input";
import { cn } from "@pioneers/ui/lib/utils";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const RULES = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "A number", test: (v: string) => /[0-9]/.test(v) },
];

export function SetPasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // The link is single-use and time-limited; without a session there is nothing
  // to update, so say so rather than failing on submit.
  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  const password = form.watch("password");

  async function onSubmit(values: SetPasswordInput) {
    setFormError(null);

    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: values.password,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (hasSession === false) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">This link has expired</h1>
          <p className="text-muted-foreground text-balance text-sm">
            Invitation and reset links can only be used once, and expire after an hour. Ask your
            administrator to send a new one.
          </p>
        </div>
        <Button onClick={() => router.replace("/login")}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a password</h1>
          <p className="text-muted-foreground text-balance text-sm">
            Pick something you have not used elsewhere.
          </p>
        </div>

        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" autoFocus {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <ul className="grid gap-1.5 text-sm" aria-live="polite">
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-2",
                  met ? "text-success" : "text-muted-foreground",
                )}
              >
                {met ? <Check className="size-3.5" /> : <X className="size-3.5 opacity-50" />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting || hasSession === null}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Save password and continue
        </Button>
      </form>
    </Form>
  );
}
