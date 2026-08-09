"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { Ban, Check, Copy, Download, Link2, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { api, type ShareLink } from "@pioneers/api-client";
import { formatDateTime, formatRelative } from "@pioneers/core/format";
import { Badge } from "@pioneers/ui/components/badge";
import { Button } from "@pioneers/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pioneers/ui/components/dialog";
import { Input } from "@pioneers/ui/components/input";
import { Label } from "@pioneers/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import { Separator } from "@pioneers/ui/components/separator";
import { Skeleton } from "@pioneers/ui/components/skeleton";

import { getApiClient } from "@/lib/api";

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never expires" },
];

/**
 * Create and manage the QR share links for one certificate.
 *
 * The QR encodes the app's own /verify URL, not a storage link — so the company
 * that receives it gets a branded page, and Pioneers-EGY keeps the ability to
 * revoke access and see who downloaded what.
 */
export function ShareCertificateDialog({
  certificateId,
  certificateTitle,
  open,
  onOpenChange,
}: {
  certificateId: string;
  certificateTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [expiry, setExpiry] = useState("30");
  const [isCreating, setIsCreating] = useState(false);
  const [activeQr, setActiveQr] = useState<{ dataUrl: string; url: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { shareLinks } = await api.certificates.listShareLinks(getApiClient(), certificateId);
      setLinks(shareLinks);
    } catch {
      setLinks([]);
    }
  }, [certificateId]);

  useEffect(() => {
    if (open) {
      setLinks(null);
      setActiveQr(null);
      void load();
    }
  }, [open, load]);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const { shareLink, qrCodeDataUrl } = await api.certificates.createShareLink(
        getApiClient(),
        certificateId,
        {
          label: null,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        },
      );

      setLinks((current) => [shareLink, ...(current ?? [])]);
      setActiveQr({ dataUrl: qrCodeDataUrl, url: shareLink.url });
      toast.success("Share link created");
    } catch (error) {
      toast.error("Could not create the share link", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(link: ShareLink) {
    try {
      await api.certificates.revokeShareLink(getApiClient(), certificateId, link.id);
      setLinks((current) =>
        (current ?? []).map((item) => (item.id === link.id ? { ...item, is_revoked: true } : item)),
      );
      if (activeQr?.url === link.url) setActiveQr(null);
      toast.success("Share link revoked");
    } catch (error) {
      toast.error("Could not revoke the link", {
        description: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  async function copy(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedToken(link.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error("Could not copy — select the address and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share certificate</DialogTitle>
          <DialogDescription className="break-anywhere">{certificateTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="share-expiry" className="mb-2">
                Link expires after
              </Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="share-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void handleCreate()} disabled={isCreating}>
              {isCreating ? <Loader2 className="animate-spin" /> : <QrCode />}
              Create link
            </Button>
          </div>

          {activeQr ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-white p-3">
                <Image
                  src={activeQr.dataUrl}
                  alt="QR code linking to the certificate verification page"
                  width={192}
                  height={192}
                  unoptimized
                />
              </div>
              <p className="text-muted-foreground text-balance text-center text-xs">
                Send this QR code to the company. Scanning it opens a page where they can verify and
                download the certificate — no account needed.
              </p>
              <div className="flex w-full gap-2">
                <Input readOnly value={activeQr.url} className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy link"
                  onClick={() => {
                    void navigator.clipboard.writeText(activeQr.url);
                    toast.success("Link copied");
                  }}
                >
                  <Copy />
                </Button>
                <Button variant="outline" size="icon" asChild aria-label="Download QR code">
                  <a href={activeQr.dataUrl} download={`${slugify(certificateTitle)}-qr.png`}>
                    <Download />
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-medium">Existing links</h3>

            {links === null ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No share links yet. Create one above to send this certificate out.
              </p>
            ) : (
              <ul className="space-y-2">
                {links.map((link) => {
                  const isExpired =
                    !!link.expires_at && new Date(link.expires_at).getTime() < Date.now();
                  const isDead = link.is_revoked || isExpired;

                  return (
                    <li key={link.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link2 className="text-muted-foreground size-3.5" aria-hidden />
                            <code className="text-xs">…{link.token.slice(-10)}</code>
                            {link.is_revoked ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/30 text-destructive"
                              >
                                Revoked
                              </Badge>
                            ) : isExpired ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                Expired
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-success/30 bg-success/10 text-success"
                              >
                                Active
                              </Badge>
                            )}
                          </div>

                          <p className="text-muted-foreground mt-1.5 text-xs">
                            Created {formatRelative(link.created_at)}
                            {link.expires_at
                              ? ` · Expires ${formatDateTime(link.expires_at)}`
                              : " · No expiry"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {link.view_count} view{link.view_count === 1 ? "" : "s"} ·{" "}
                            {link.download_count} download
                            {link.download_count === 1 ? "" : "s"}
                            {link.last_accessed_at
                              ? ` · last ${formatRelative(link.last_accessed_at)}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Copy link"
                            disabled={isDead}
                            onClick={() => void copy(link)}
                          >
                            {copiedToken === link.token ? (
                              <Check className="text-success" />
                            ) : (
                              <Copy />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Revoke link"
                            disabled={link.is_revoked}
                            onClick={() => void handleRevoke(link)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Ban />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "certificate"
  );
}
