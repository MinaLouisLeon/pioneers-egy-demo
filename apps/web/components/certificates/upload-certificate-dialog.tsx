"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CERTIFICATE_CONTENT_TYPES, formatBytes, validateUpload } from "@pioneers/core/files";
import { newClientId } from "@pioneers/core/ids";
import { certificateMetadataSchema, type CertificateMetadata } from "@pioneers/core/schemas";
import { Alert, AlertDescription } from "@pioneers/ui/components/alert";
import { Button } from "@pioneers/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Progress } from "@pioneers/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pioneers/ui/components/select";
import { cn } from "@pioneers/ui/lib/utils";

import {
  createCertificate,
  discardFailedCertificate,
} from "@/app/(app)/dashboard/certificates/actions";
import { uploadToR2 } from "@/lib/upload";

export type JobOption = { id: string; project_name: string; company_name: string };

const NO_JOB = "__none__";

export function UploadCertificateDialog({ jobs }: { jobs: JobOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CertificateMetadata>({
    resolver: zodResolver(certificateMetadataSchema),
    defaultValues: {
      title: "",
      company_name: null,
      certificate_number: null,
      issue_date: null,
      expiry_date: null,
      job_id: null,
    },
  });

  function chooseFile(nextFile: File) {
    const problem = validateUpload("certificate", {
      contentType: nextFile.type,
      sizeBytes: nextFile.size,
    });

    setFileError(problem);
    setFile(problem ? null : nextFile);

    // Pre-fill the title from the file name — it is almost always what they want.
    if (!problem && !form.getValues("title")) {
      form.setValue("title", prettifyFileName(nextFile.name), { shouldValidate: false });
    }
  }

  function reset() {
    form.reset();
    setFile(null);
    setFileError(null);
    setProgress(null);
    setFormError(null);
  }

  async function onSubmit(values: CertificateMetadata) {
    if (!file) {
      setFileError("Choose a PDF to upload.");
      return;
    }

    setFormError(null);
    setProgress(0);

    // The id is generated here so the R2 key is known before the upload starts.
    const certificateId = newClientId();

    const created = await createCertificate({
      ...values,
      id: certificateId,
      clientId: newClientId(),
      file_name: file.name,
      content_type: "application/pdf",
      size_bytes: file.size,
    });

    if (!created.ok) {
      setProgress(null);
      setFormError(created.error);
      for (const [field, messages] of Object.entries(created.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(field as keyof CertificateMetadata, { message: messages[0] });
        }
      }
      return;
    }

    try {
      await uploadToR2({
        file,
        request: {
          scope: "certificate",
          certificateId,
          fileName: file.name,
          contentType: "application/pdf",
          sizeBytes: file.size,
        },
        onProgress: setProgress,
      });
    } catch (error) {
      // Roll the row back so a failed upload does not leave a certificate that
      // points at a file which was never stored.
      await discardFailedCertificate(certificateId);
      setProgress(null);
      setFormError(error instanceof Error ? error.message : "The upload failed.");
      return;
    }

    toast.success("Certificate uploaded", { description: values.title });
    reset();
    setOpen(false);
    router.refresh();
  }

  const isBusy = form.formState.isSubmitting || progress !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return; // don't let a close abandon an in-flight upload
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload /> Upload certificate
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a certificate</DialogTitle>
          <DialogDescription>
            PDF only, up to 25 MB. You can share it by QR code once it is uploaded.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            {formError ? (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="sm:col-span-2">
              <input
                ref={inputRef}
                type="file"
                accept={CERTIFICATE_CONTENT_TYPES.join(",")}
                className="sr-only"
                disabled={isBusy}
                onChange={(event) => {
                  const next = event.target.files?.[0];
                  if (next) chooseFile(next);
                  event.target.value = "";
                }}
              />

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-anywhere text-sm font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-xs">{formatBytes(file.size)}</p>
                  </div>
                  {!isBusy ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                      aria-label="Remove file"
                    >
                      <X />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const dropped = event.dataTransfer.files?.[0];
                    if (dropped) chooseFile(dropped);
                  }}
                  className={cn(
                    "rounded-lg border border-dashed p-6 text-center transition-colors",
                    isDragging && "border-primary bg-primary/5",
                  )}
                >
                  <FileText className="text-muted-foreground mx-auto mb-2 size-6" aria-hidden />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose PDF
                  </Button>
                  <p className="text-muted-foreground mt-2 text-xs">or drag it here</p>
                </div>
              )}

              {fileError ? <p className="text-destructive mt-2 text-sm">{fileError}</p> : null}
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Title<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Gantry Crane Load Test Certificate" {...field} />
                  </FormControl>
                  <FormDescription>Searchable, alongside the file name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Company <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
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
              name="certificate_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Certificate no.{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="PE-LIF-2026-0041"
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
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Issue date <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="w-full"
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
              name="expiry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Expiry date{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="w-full"
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
              name="job_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Linked job <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <Select
                    value={field.value ?? NO_JOB}
                    onValueChange={(value) => field.onChange(value === NO_JOB ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Not linked to a job" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_JOB}>Not linked to a job</SelectItem>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.project_name} — {job.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {progress !== null ? (
              <div className="sm:col-span-2">
                <Progress value={progress} className="h-2" />
                <p className="text-muted-foreground mt-1.5 text-xs">Uploading… {progress}%</p>
              </div>
            ) : null}

            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy || !file}>
                {isBusy ? <Loader2 className="animate-spin" /> : <Upload />}
                Upload certificate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function prettifyFileName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
