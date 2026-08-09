import type { Metadata } from "next";

import { can } from "@pioneers/core/roles";

import {
  CertificatesClient,
  type CertificateRow,
} from "@/components/certificates/certificates-client";
import { UploadCertificateDialog } from "@/components/certificates/upload-certificate-dialog";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certification" };

export default async function CertificatesPage({
  searchParams,
}: PageProps<"/dashboard/certificates">) {
  const profile = await requireUser();
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search : "";

  const supabase = await getSupabaseServerClient();

  const [{ data: certificates }, { data: jobs }] = await Promise.all([
    supabase
      .from("certificates")
      .select(
        `id, title, file_name, r2_key, size_bytes, company_name, certificate_number,
         issue_date, expiry_date, uploaded_by, created_at,
         job:jobs ( id, project_name )`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    // Used to populate the "link to a job" dropdown in the upload dialog.
    supabase
      .from("jobs")
      .select("id, project_name, company_name")
      .is("deleted_at", null)
      .order("visit_date", { ascending: false })
      .limit(100),
  ]);

  return (
    <>
      <PageHeader
        title="Certification"
        description="Upload certificates, search the register, and share them with clients by QR code."
        actions={
          can(profile.role, "certificates.create") ? (
            <UploadCertificateDialog jobs={jobs ?? []} />
          ) : null
        }
      />

      <CertificatesClient
        certificates={(certificates ?? []) as unknown as CertificateRow[]}
        role={profile.role}
        userId={profile.id}
        initialSearch={search}
      />
    </>
  );
}
