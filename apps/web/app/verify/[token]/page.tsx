import type { Metadata } from "next";

import { BadgeCheck, Ban, CalendarClock, Clock, Download, FileX2 } from "lucide-react";

import { certificateStatus, formatDate } from "@pioneers/core";
import { formatBytes } from "@pioneers/core/files";
import { Alert, AlertDescription, AlertTitle } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pioneers/ui/components/card";
import { Separator } from "@pioneers/ui/components/separator";

import { BrandLockup } from "@/components/brand";
import { CertificateStatusBadge } from "@/components/status-badge";
import { resolveShareToken } from "@/lib/verify";

export const metadata: Metadata = {
  title: "Verify certificate",
  // A shared certificate should never end up in a search index.
  robots: { index: false, follow: false },
};

/**
 * Public page a QR code resolves to. No sign-in.
 *
 * Rendered per-request so the signed download URL is always fresh and each view
 * is logged; a cached copy would hand out a stale link and hide the access.
 */
export const dynamic = "force-dynamic";

export default async function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  const { token } = await params;
  const result = await resolveShareToken(token, { action: "view" });

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-center border-b px-4 py-4">
        <BrandLockup showTagline />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg">
          {result.status === "ok" && result.certificate ? (
            <ValidCertificate
              certificate={result.certificate}
              downloadUrl={result.downloadUrl!}
              token={token}
            />
          ) : (
            <InvalidCertificate status={result.status} />
          )}
        </div>
      </main>

      <footer className="text-muted-foreground text-balance border-t px-4 py-5 text-center text-xs">
        This page confirms a certificate issued by Pioneers-EGY. If anything looks wrong, contact
        the issuing office before relying on the document.
      </footer>
    </div>
  );
}

function ValidCertificate({
  certificate,
  downloadUrl,
  token,
}: {
  certificate: NonNullable<Awaited<ReturnType<typeof resolveShareToken>>["certificate"]>;
  downloadUrl: string;
  token: string;
}) {
  const status = certificateStatus(certificate.expiry_date);

  return (
    <Card>
      <CardHeader>
        <div className="bg-success/10 text-success mb-2 flex size-11 items-center justify-center rounded-full">
          <BadgeCheck className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-xl">Certificate verified</CardTitle>
        <p className="text-muted-foreground text-balance text-sm">
          This certificate was issued by Pioneers-EGY and the link is still active.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {status === "expired" ? (
          <Alert variant="destructive">
            <CalendarClock />
            <AlertTitle>This certificate has expired</AlertTitle>
            <AlertDescription>
              It expired on {formatDate(certificate.expiry_date)}. The document is genuine but may
              no longer be valid for its purpose.
            </AlertDescription>
          </Alert>
        ) : null}

        <div>
          <h2 className="break-anywhere text-lg font-semibold">{certificate.title}</h2>
          <div className="mt-2">
            <CertificateStatusBadge status={status} />
          </div>
        </div>

        <Separator />

        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Issued to" value={certificate.company_name} />
          <Field label="Certificate number" value={certificate.certificate_number} />
          <Field label="Issue date" value={formatDate(certificate.issue_date)} />
          <Field label="Expiry date" value={formatDate(certificate.expiry_date)} />
        </dl>

        <Separator />

        <div className="flex flex-col gap-2">
          {/* Hits the API route so the download is logged separately from the view. */}
          <Button asChild size="lg">
            <a href={`/verify/${token}/download`} rel="nofollow">
              <Download /> Download PDF
            </a>
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {certificate.file_name} · {formatBytes(certificate.size_bytes)}
          </p>
          {/* Fallback if the redirect route is blocked; same short-lived URL. */}
          <noscript>
            <a href={downloadUrl} className="text-primary text-center text-xs underline">
              Direct download link
            </a>
          </noscript>
        </div>
      </CardContent>
    </Card>
  );
}

function InvalidCertificate({ status }: { status: "revoked" | "expired" | "not-found" | "ok" }) {
  const content = {
    revoked: {
      icon: Ban,
      title: "This link has been revoked",
      body: "Pioneers-EGY has withdrawn access to this certificate. Contact the issuing office if you still need a copy.",
    },
    expired: {
      icon: Clock,
      title: "This link has expired",
      body: "Share links are time limited. Ask Pioneers-EGY for a new link to the certificate.",
    },
    "not-found": {
      icon: FileX2,
      title: "Certificate not found",
      body: "This link does not match any certificate. Check that the whole address was copied, or scan the QR code again.",
    },
    ok: { icon: FileX2, title: "Certificate not found", body: "" },
  }[status];

  const Icon = content.icon;

  return (
    <Card>
      <CardHeader>
        <div className="bg-muted text-muted-foreground mb-2 flex size-11 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-xl">{content.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-balance text-sm">{content.body}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="break-anywhere mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}
