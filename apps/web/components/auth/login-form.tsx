"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginInput } from "@pioneers/core/schemas";
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

export function LoginForm({
  redirectTo,
  initialError,
}: {
  /** Already validated as a same-origin path by the page. */
  redirectTo: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(initialError);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" tells an attacker which addresses are registered.
      setFormError(
        error.message === "Invalid login credentials"
          ? "Those credentials do not match an account."
          : error.message,
      );
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5 text-center lg:text-left">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-balance text-sm">
            Use the account your administrator set up for you.
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
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@pioneers-egy.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Sign in
        </Button>

        <p className="text-muted-foreground text-balance text-center text-xs">
          Accounts are created by an administrator. Contact yours if you need access.
        </p>
      </form>
    </Form>
  );
}
