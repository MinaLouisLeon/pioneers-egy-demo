"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api, ApiError, type AdminUser } from "@pioneers/api-client";
import { inviteUserSchema, type InviteUserInput } from "@pioneers/core/schemas";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@pioneers/core/roles";
import { Button } from "@pioneers/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pioneers/ui/components/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@pioneers/ui/components/form";
import { Input } from "@pioneers/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";

import { getApiClient } from "@/lib/api";

export function InviteUserDialog({ onInvited }: { onInvited: (user: AdminUser) => void }) {
  const [open, setOpen] = useState(false);

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", full_name: "", role: "inspector", phone: null },
  });

  async function onSubmit(values: InviteUserInput) {
    try {
      const { user } = await api.admin.inviteUser(getApiClient(), {
        email: values.email,
        full_name: values.full_name,
        role: values.role,
        phone: values.phone,
      });

      onInvited(user);
      toast.success("Invitation sent", {
        description: `${values.email} can now set their own password.`,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        form.setError("email", { message: "An account with that email already exists." });
        return;
      }
      toast.error("Could not send the invitation", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Invite user
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They will receive an email with a link to choose their own password.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ahmed Sami" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="ahmed@pioneers-egy.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+20 100 000 0000"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{ROLE_DESCRIPTIONS[field.value]}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
