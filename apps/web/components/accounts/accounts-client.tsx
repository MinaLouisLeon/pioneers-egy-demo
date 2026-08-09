"use client";

import { useMemo, useState } from "react";

import {
  MailWarning,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api, type AdminUser } from "@pioneers/api-client";
import { formatRelative, initialsOf } from "@pioneers/core/format";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@pioneers/core/roles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pioneers/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@pioneers/ui/components/avatar";
import { Badge } from "@pioneers/ui/components/badge";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent } from "@pioneers/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pioneers/ui/components/dropdown-menu";
import { Input } from "@pioneers/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pioneers/ui/components/table";

import { EmptyState } from "@/components/empty-state";
import { EditUserDialog } from "@/components/accounts/edit-user-dialog";
import { InviteUserDialog } from "@/components/accounts/invite-user-dialog";
import { getApiClient } from "@/lib/api";

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  manager: "border-chart-2/30 bg-chart-2/10 text-chart-2",
  inspector: "text-muted-foreground",
};

export function AccountsClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.is_active) return false;
      if (statusFilter === "inactive" && user.is_active) return false;
      if (!query) return true;
      return (
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  function upsertUser(updated: AdminUser) {
    setUsers((current) => {
      const index = current.findIndex((user) => user.id === updated.id);
      if (index === -1) return [...current, updated];
      const next = [...current];
      next[index] = updated;
      return next;
    });
  }

  async function handleResendInvite(user: AdminUser) {
    try {
      await api.admin.resendInvite(getApiClient(), user.id);
      toast.success("Invitation re-sent", { description: user.email });
    } catch (error) {
      toast.error("Could not re-send the invitation", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await api.admin.deleteUser(getApiClient(), deleting.id);
      setUsers((current) => current.filter((user) => user.id !== deleting.id));
      toast.success("Account deleted", { description: deleting.email });
      setDeleting(null);
    } catch (error) {
      toast.error("Could not delete the account", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const activeCount = users.filter((user) => user.is_active).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone…"
            className="pl-9"
            aria-label="Search accounts"
          />
        </div>

        <div className="flex gap-2">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {USER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}
          >
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <InviteUserDialog onInvited={upsertUser} />
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} of {users.length} account{users.length === 1 ? "" : "s"} · {activeCount}{" "}
        active
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts match those filters"
          description="Try clearing the search box or widening the filters."
        />
      ) : (
        <>
          {/* Desktop: table. Below md the same data is rendered as cards, since a
              five-column table cannot be read on a phone without horizontal scroll. */}
          <Card className="hidden overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initialsOf(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="truncate">{user.full_name}</span>
                            {user.id === currentUserId ? (
                              <Badge variant="secondary" className="text-[10px]">
                                You
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE_STYLES[user.role]}>
                        {user.role === "admin" ? <ShieldCheck className="size-3" /> : null}
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusCell user={user} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        user={user}
                        isSelf={user.id === currentUserId}
                        onEdit={() => setEditing(user)}
                        onDelete={() => setDeleting(user)}
                        onResend={() => handleResendInvite(user)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {filtered.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex items-start gap-3">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initialsOf(user.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{user.full_name}</span>
                      {user.id === currentUserId ? (
                        <Badge variant="secondary" className="text-[10px]">
                          You
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground break-anywhere text-xs">{user.email}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={ROLE_BADGE_STYLES[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                      <StatusCell user={user} />
                    </div>

                    <div className="text-muted-foreground mt-2 text-xs">
                      Last sign-in:{" "}
                      {user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : "Never"}
                    </div>
                  </div>

                  <RowActions
                    user={user}
                    isSelf={user.id === currentUserId}
                    onEdit={() => setEditing(user)}
                    onDelete={() => setDeleting(user)}
                    onResend={() => handleResendInvite(user)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <EditUserDialog
        user={editing}
        isSelf={editing?.id === currentUserId}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onUpdated={upsertUser}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their sign-in. If they have created inspection jobs or
              uploaded certificates, deletion is blocked to keep those records intact — deactivate
              the account instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusCell({ user }: { user: AdminUser }) {
  if (!user.is_active) {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        Inactive
      </Badge>
    );
  }
  if (user.invite_pending) {
    return (
      <Badge variant="outline" className="border-warning/40 bg-warning/15">
        <MailWarning className="size-3" /> Invite pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
      Active
    </Badge>
  );
}

function RowActions({
  user,
  isSelf,
  onEdit,
  onDelete,
  onResend,
}: {
  user: AdminUser;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onResend: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.full_name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <UserCog className="size-4" /> Edit account
        </DropdownMenuItem>
        {user.invite_pending ? (
          <DropdownMenuItem onSelect={onResend}>
            <Send className="size-4" /> Re-send invitation
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete} disabled={isSelf}>
          <Trash2 className="size-4" /> Delete account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
