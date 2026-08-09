"use client";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api, type AdminUser } from "@pioneers/api-client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@pioneers/core/roles";
import { updateUserSchema, type UpdateUserInput } from "@pioneers/core/schemas";
import { Button } from "@pioneers/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@pioneers/ui/components/switch";

import { getApiClient } from "@/lib/api";

export function EditUserDialog({
  user,
  isSelf,
  open,
  onOpenChange,
  onUpdated,
}: {
  user: AdminUser | null;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (user: AdminUser) => void;
}) {
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { full_name: "", role: "inspector", phone: null, is_active: true },
  });

  // Repopulate whenever a different row is opened.
  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        is_active: user.is_active,
      });
    }
  }, [user, form]);

  async function onSubmit(values: UpdateUserInput) {
    if (!user) return;

    try {
      const { user: updated } = await api.admin.updateUser(getApiClient(), user.id, values);
      onUpdated(updated);
      toast.success("Account updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not update the account", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription className="break-anywhere">{user?.email}</DialogDescription>
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
                    <Input {...field} value={field.value ?? ""} />
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSelf}>
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
                  <FormDescription>
                    {isSelf
                      ? "You cannot change your own role."
                      : ROLE_DESCRIPTIONS[field.value ?? "inspector"]}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      {isSelf
                        ? "You cannot deactivate your own account."
                        : "Deactivating signs the user out and blocks all access, without deleting their records."}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isSelf}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
