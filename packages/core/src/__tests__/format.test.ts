import { describe, expect, it } from "vitest";

import { certificateStatus } from "../schemas/certificate";
import { daysUntil, formatDate, initialsOf, toDateInput, truncate } from "../format";
import { buildCertificateKey, formatBytes, sanitizeFileName, validateUpload } from "../files";
import { canEditJob, canViewJob, can, isStaff } from "../roles";

describe("formatDate", () => {
  // Regression guard: `new Date("2026-01-01")` is UTC midnight, which renders
  // as 31 Dec for anyone west of Greenwich. Calendar dates must never go
  // through the Date timezone machinery.
  it("formats a calendar date without timezone drift", () => {
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDate("2026-03-14")).toBe("14 Mar 2026");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
  });

  it("tolerates a full timestamp", () => {
    expect(formatDate("2026-03-14T23:30:00Z")).toBe("14 Mar 2026");
  });

  it("renders a dash for empty or malformed input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("nonsense")).toBe("—");
  });
});

describe("toDateInput", () => {
  it("uses local date parts, zero-padded", () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateInput(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  it("counts forward and backward", () => {
    expect(daysUntil("2026-08-09", now)).toBe(0);
    expect(daysUntil("2026-08-10", now)).toBe(1);
    expect(daysUntil("2026-08-08", now)).toBe(-1);
  });

  it("returns null when there is no date", () => {
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe("certificateStatus", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  it("buckets by remaining days", () => {
    expect(certificateStatus(null, now)).toBe("no-expiry");
    expect(certificateStatus("2026-08-08", now)).toBe("expired");
    expect(certificateStatus("2026-08-09", now)).toBe("expiring");
    // EXPIRING_SOON_DAYS is 30, so the 30th day is still "expiring" and the
    // 31st tips over to "valid".
    expect(certificateStatus("2026-09-08", now)).toBe("expiring");
    expect(certificateStatus("2026-09-09", now)).toBe("valid");
  });
});

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("validateUpload", () => {
  it("accepts a normal photo", () => {
    expect(
      validateUpload("task-photo", { contentType: "image/jpeg", sizeBytes: 2_000_000 }),
    ).toBeNull();
  });

  it("rejects a PDF uploaded as a photo", () => {
    expect(
      validateUpload("task-photo", { contentType: "application/pdf", sizeBytes: 1000 }),
    ).toMatch(/Unsupported file type/);
  });

  it("rejects a non-PDF certificate", () => {
    expect(validateUpload("certificate", { contentType: "image/png", sizeBytes: 1000 })).toMatch(
      /Unsupported file type/,
    );
  });

  it("rejects oversized and empty files", () => {
    expect(
      validateUpload("task-photo", { contentType: "image/jpeg", sizeBytes: 50_000_000 }),
    ).toMatch(/too large/);
    expect(validateUpload("task-photo", { contentType: "image/jpeg", sizeBytes: 0 })).toMatch(
      /empty/,
    );
  });
});

describe("sanitizeFileName / buildCertificateKey", () => {
  it("strips path separators and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFileName("report (final).pdf")).toBe("report_final_.pdf");
    expect(sanitizeFileName("  spaced  name .pdf")).toBe("spaced_name_.pdf");
  });

  it("never produces an empty segment", () => {
    expect(sanitizeFileName("...")).toBe("file");
    expect(sanitizeFileName("")).toBe("file");
  });

  it("builds a prefixed key without duplicating the extension", () => {
    const key = buildCertificateKey({
      certificateId: "abc",
      fileName: "load-test.pdf",
      contentType: "application/pdf",
    });
    expect(key).toBe("certificates/abc/load-test.pdf");
  });

  it("keeps a traversal attempt inside the certificate prefix", () => {
    const key = buildCertificateKey({
      certificateId: "abc",
      fileName: "../../secret.pdf",
      contentType: "application/pdf",
    });
    expect(key).toBe("certificates/abc/secret.pdf");
    expect(key).not.toContain("..");
  });
});

describe("roles", () => {
  it("only admins manage accounts", () => {
    expect(can("admin", "accounts.manage")).toBe(true);
    expect(can("manager", "accounts.manage")).toBe(false);
    expect(can("inspector", "accounts.manage")).toBe(false);
    expect(can(null, "accounts.manage")).toBe(false);
  });

  it("managers see everything but cannot delete", () => {
    expect(isStaff("manager")).toBe(true);
    expect(can("manager", "jobs.read.all")).toBe(true);
    expect(can("manager", "jobs.delete")).toBe(false);
  });

  it("inspectors are scoped to their own jobs", () => {
    const own = { created_by: "user-1" };
    const other = { created_by: "user-2" };

    expect(canViewJob("inspector", "user-1", own)).toBe(true);
    expect(canViewJob("inspector", "user-1", other)).toBe(false);
    expect(canEditJob("inspector", "user-1", own)).toBe(true);
    expect(canEditJob("inspector", "user-1", other)).toBe(false);

    expect(canViewJob("manager", "user-3", other)).toBe(true);
    expect(canEditJob("manager", "user-3", other)).toBe(false);
    expect(canEditJob("admin", "user-3", other)).toBe(true);
  });
});

describe("misc formatters", () => {
  it("derives initials", () => {
    expect(initialsOf("Ahmed Sami")).toBe("AS");
    expect(initialsOf("Cher")).toBe("C");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("a".repeat(20), 10)).toHaveLength(10);
  });
});
