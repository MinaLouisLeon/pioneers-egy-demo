"use client";

import Link from "next/link";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { forgotPasswordSchema } from "@pioneers/core/schemas";
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

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    // Always report success, even for an unknown address — otherwise this form
    // becomes an account-enumeration oracle.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
          <MailCheck className="size-5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-muted-foreground text-balance text-sm">
            If an account exists for <strong>{form.getValues("email")}</strong>, we have sent a link
            to reset its password. The link expires in one hour.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground text-balance text-sm">
            Enter your email and we will send you a link to choose a new password.
          </p>
        </div>

        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Send reset link
        </Button>

        <Button asChild variant="ghost" size="sm">
          <Link href="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </form>
    </Form>
  );
}
