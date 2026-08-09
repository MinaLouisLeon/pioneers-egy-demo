import { CERTIFICATE_STATUS_LABELS, type CertificateStatus } from "@pioneers/core/schemas";
import { Badge } from "@pioneers/ui/components/badge";
import { cn } from "@pioneers/ui/lib/utils";

const CERTIFICATE_STATUS_STYLES: Record<CertificateStatus, string> = {
  valid: "border-success/30 bg-success/10 text-success",
  expiring: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  "no-expiry": "border-border bg-muted text-muted-foreground",
};

export function CertificateStatusBadge({
  status,
  className,
}: {
  status: CertificateStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(CERTIFICATE_STATUS_STYLES[status], className)}>
      {CERTIFICATE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function JobStatusBadge({ status }: { status: "draft" | "submitted" }) {
  return status === "submitted" ? (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
      Submitted
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Draft
    </Badge>
  );
}

export function TestResultBadge({ result }: { result: "pass" | "fail" }) {
  return result === "pass" ? (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
      Pass
    </Badge>
  ) : (
    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
      Fail
    </Badge>
  );
}
