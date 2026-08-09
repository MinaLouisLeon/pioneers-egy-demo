"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { can, type UserRole } from "@pioneers/core/roles";
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
import { Button } from "@pioneers/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pioneers/ui/components/dropdown-menu";

import { deleteJob, reopenJob } from "@/app/(app)/dashboard/jobs/actions";

export function JobActions({
  jobId,
  status,
  role,
}: {
  jobId: string;
  status: "draft" | "submitted";
  role: UserRole;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  async function handleReopen() {
    setIsWorking(true);
    const result = await reopenJob(jobId);
    setIsWorking(false);

    if (!result.ok) {
      toast.error("Could not reopen the job", { description: result.error });
      return;
    }
    toast.success("Job reopened as a draft");
    router.refresh();
  }

  /**
   * On success the server action redirects to the jobs list, so nothing after
   * the await runs — the page navigates and this dialog unmounts with it.
   * Reaching the lines below therefore means the delete was refused.
   */
  async function handleDelete() {
    setIsWorking(true);
    const result = await deleteJob(jobId);

    setIsWorking(false);
    setConfirmDelete(false);
    toast.error("Could not delete the job", { description: result.error });
  }

  const canDelete = can(role, "jobs.delete");

  // Nothing to show if neither action is available.
  if (status === "draft" && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More job actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "submitted" ? (
            <DropdownMenuItem onSelect={() => void handleReopen()} disabled={isWorking}>
              <RotateCcw className="size-4" /> Reopen as draft
            </DropdownMenuItem>
          ) : null}

          {canDelete ? (
            <>
              {status === "submitted" ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
                disabled={isWorking}
              >
                <Trash2 className="size-4" /> Delete job
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              The job and its tasks will no longer appear anywhere in the app. Any certificate
              linked to it keeps its own record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isWorking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isWorking ? "Deleting…" : "Delete job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
