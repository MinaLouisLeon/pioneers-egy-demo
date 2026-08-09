import type { Metadata } from "next";

import { JobDetailsForm } from "@/components/jobs/job-details-form";
import { WizardSteps } from "@/components/jobs/wizard-steps";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New inspection job" };

export default async function NewJobPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New inspection job"
        description="Start with the project details. You will add inspection tasks next."
      />
      <WizardSteps current="details" />
      <JobDetailsForm jobId={null} />
    </div>
  );
}
