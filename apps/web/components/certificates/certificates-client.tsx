"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Award,
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { certificateStatus, formatDate, formatBytes } from "@pioneers/core";
import { canEditCertificate, type UserRole } from "@pioneers/core/roles";
import type { CertificateStatus } from "@pioneers/core/schemas";
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
import { ShareCertificateDialog } from "@/components/certificates/share-dialog";
import { CertificateStatusBadge } from "@/components/status-badge";
import { deleteCertificate } from "@/app/(app)/dashboard/certificates/actions";
import { getDownloadUrls } from "@/lib/upload";

export type CertificateRow = {
  id: string;
  title: string;
  file_name: string;
  r2_key: string;
  size_bytes: number;
  company_name: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_by: string;
  created_at: string;
  job: { id: string; project_name: string } | null;
};

export function CertificatesClient({
  certificates,
  role,
  userId,
  initialSearch,
}: {
  certificates: CertificateRow[];
  role: UserRole;
  userId: string;
  initialSearch: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<CertificateStatus | "all">("all");
  const [sharing, setSharing] = useState<CertificateRow | null>(null);
  const [deleting, setDeleting] = useState<CertificateRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Filtering is client-side because the register is a few hundred rows at
   * most and instant feedback while typing a file name is the whole point of
   * the search requirement. The server query is still bounded, and the page
   * falls back to a server search via the URL for deep links.
   */
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return certificates.filter((certificate) => {
      if (statusFilter !== "all" && certificateStatus(certificate.expiry_date) !== statusFilter) {
        return false;
      }
      if (!query) return true;

      return (
        certificate.title.toLowerCase().includes(query) ||
        certificate.file_name.toLowerCase().includes(query) ||
        (certificate.company_name ?? "").toLowerCase().includes(query) ||
        (certificate.certificate_number ?? "").toLowerCase().includes(query)
      );
    });
  }, [certificates, search, statusFilter]);

  async function handleDownload(certificate: CertificateRow) {
    try {
      const urls = await getDownloadUrls([certificate.r2_key], { download: true });
      const url = urls[certificate.r2_key];
      if (!url) throw new Error("The stored file could not be found.");
      window.location.href = url;
    } catch (error) {
      toast.error("Could not download the certificate", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setIsDeleting(true);

    const result = await deleteCertificate(deleting.id);
    setIsDeleting(false);

    if (!result.ok) {
      toast.error("Could not delete the certificate", { description: result.error });
      return;
    }

    toast.success("Certificate deleted");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name, title, company or certificate number…"
            className="pl-9"
            aria-label="Search certificates"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as CertificateStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="expiring">Expiring soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="no-expiry">No expiry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} of {certificates.length} certificate
        {certificates.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Award}
          title={
            certificates.length === 0 ? "No certificates yet" : "No certificates match your search"
          }
          description={
            certificates.length === 0
              ? "Upload a PDF certificate to add it to the register and share it by QR code."
              : "Try a different search term or clear the status filter."
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <FileText className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <div className="font-medium">{certificate.title}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {certificate.file_name} · {formatBytes(certificate.size_bytes)}
                            {certificate.certificate_number
                              ? ` · ${certificate.certificate_number}`
                              : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {certificate.company_name ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(certificate.issue_date)}</TableCell>
                    <TableCell>{formatDate(certificate.expiry_date)}</TableCell>
                    <TableCell>
                      <CertificateStatusBadge status={certificateStatus(certificate.expiry_date)} />
                    </TableCell>
                    <TableCell>
                      <RowActions
                        certificate={certificate}
                        canEdit={canEditCertificate(role, userId, certificate)}
                        onShare={() => setSharing(certificate)}
                        onDownload={() => void handleDownload(certificate)}
                        onDelete={() => setDeleting(certificate)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <ul className="grid gap-3 lg:hidden">
            {filtered.map((certificate) => (
              <li key={certificate.id}>
                <Card>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded">
                        <FileText className="size-4" aria-hidden />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="break-anywhere font-medium">{certificate.title}</p>
                        <p className="text-muted-foreground break-anywhere text-xs">
                          {certificate.file_name} · {formatBytes(certificate.size_bytes)}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <CertificateStatusBadge
                            status={certificateStatus(certificate.expiry_date)}
                          />
                          {certificate.company_name ? (
                            <span className="text-muted-foreground text-xs">
                              {certificate.company_name}
                            </span>
                          ) : null}
                        </div>

                        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 text-xs">
                          <span>Issued {formatDate(certificate.issue_date)}</span>
                          <span>Expires {formatDate(certificate.expiry_date)}</span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSharing(certificate)}
                          >
                            <QrCode /> Share
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDownload(certificate)}
                          >
                            <Download /> Download
                          </Button>
                        </div>
                      </div>

                      <RowActions
                        certificate={certificate}
                        canEdit={canEditCertificate(role, userId, certificate)}
                        onShare={() => setSharing(certificate)}
                        onDownload={() => void handleDownload(certificate)}
                        onDelete={() => setDeleting(certificate)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {sharing ? (
        <ShareCertificateDialog
          certificateId={sharing.id}
          certificateTitle={sharing.title}
          open={sharing !== null}
          onOpenChange={(open) => !open && setSharing(null)}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              The PDF is removed from storage and every share link stops working immediately,
              including QR codes already handed out. This cannot be undone.
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
              {isDeleting ? "Deleting…" : "Delete certificate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  certificate,
  canEdit,
  onShare,
  onDownload,
  onDelete,
}: {
  certificate: CertificateRow;
  canEdit: boolean;
  onShare: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${certificate.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onShare}>
          <QrCode className="size-4" /> Share by QR code
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download className="size-4" /> Download PDF
        </DropdownMenuItem>
        {certificate.job ? (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/jobs/${certificate.job.id}`}>
              <ExternalLink className="size-4" /> View linked job
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
