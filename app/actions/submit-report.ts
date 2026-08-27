"use server";

import { createHash, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../../lib/db.ts";
import type { Database } from "../../lib/db.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const OPEN_STATUSES = ["submitted", "in_progress", "overdue", "unfunded"] as const;

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role storage credentials are not configured");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const processedRecordSchema = z.object({
  school_id: z.string().uuid(),
  detected_language: z.string().min(1),
  text_original: z.string().min(1),
  text_hindi: z.string().min(1),
  text_english_official: z.string().min(1),
  category: z.enum([
    "structural",
    "electrical",
    "sanitation",
    "water",
    "furniture",
    "accessibility",
    "boundary",
    "other",
  ]),
  severity: z.enum(["S1", "S2", "S3", "S4"]),
  severity_reasoning: z.string().min(1),
  rte_entitlement_violated: z.boolean(),
  estimated_scale: z.enum(["minor", "major"]),
  location_within_premises: z.string().nullable(),
  grievance_authority: z.string().min(1),
  execution_authority: z.string().min(1),
  funding_pathway: z.string().min(1),
  statutory_limit_days: z.literal(90),
}).strict();

function generateCode() {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join("");
}

function derivedUuid(namespace: string, label: string) {
  const bytes = createHash("sha256").update(`${namespace}:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isDuplicateObjectError(error: { message: string; statusCode?: string } | null) {
  return Boolean(error && (error.statusCode === "409" || /duplicate|already exists/i.test(error.message)));
}

export async function submitProcessedReport(formData: FormData) {
  try {
    const submissionId = z.string().uuid().parse(formData.get("submission_id"));
    const record = processedRecordSchema.parse(
      JSON.parse(z.string().parse(formData.get("processed_record"))),
    );
    const existingIssueIdValue = formData.get("existing_issue_id");
    const existingIssueId = existingIssueIdValue
      ? z.string().uuid().parse(existingIssueIdValue)
      : null;
    const captureProvenance = z.enum(["live", "upload"]).parse(
      formData.get("capture_provenance"),
    );
    const photos = formData.getAll("photos").filter(
      (photo): photo is File => photo instanceof File && photo.type.startsWith("image/"),
    );
    if (photos.length < 1 || photos.length > 5) {
      throw new Error("Provide between one and five redacted photos");
    }
    if (photos.some((photo) => photo.size > 5_000_000)) {
      throw new Error("A redacted photo exceeds the 5 MB upload limit");
    }

    const storage = storageAdmin();
    const photoUrls = await Promise.all(
      photos.map(async (photo, index) => {
        const path = `${submissionId}/${index + 1}.jpg`;
        const { error } = await storage.storage
          .from("report-photos")
          .upload(path, photo, { contentType: "image/jpeg", upsert: false });
        if (error && !isDuplicateObjectError(error)) {
          throw new Error(`Photo upload failed: ${error.message}`);
        }
        return storage.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
      }),
    );

    let issue;
    let eventType: "SUBMITTED" | "CORROBORATED";
    if (existingIssueId) {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("id", existingIssueId)
        .eq("school_id", record.school_id)
        .eq("category", record.category)
        .in("status", [...OPEN_STATUSES])
        .maybeSingle();
      if (error) throw new Error(`Duplicate issue lookup failed: ${error.message}`);
      if (!data) throw new Error("The selected existing issue is no longer open");
      issue = data;
      eventType = "CORROBORATED";
    } else {
      const { data: existingSubmission, error: existingSubmissionError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle();
      if (existingSubmissionError) {
        throw new Error(`Submission lookup failed: ${existingSubmissionError.message}`);
      }

      issue = existingSubmission;
      if (!issue) {
        let insertError: { code?: string; message: string } | null = null;
        for (let attempt = 0; attempt < 10 && !issue; attempt += 1) {
          const { data, error } = await supabase
            .from("issues")
            .insert({
              id: submissionId,
              code: generateCode(),
              school_id: record.school_id,
              category: record.category,
              severity: record.severity,
              severity_reasoning: record.severity_reasoning,
              rte_entitlement_violated: record.rte_entitlement_violated,
              estimated_scale: record.estimated_scale,
              location_within_premises: record.location_within_premises,
              grievance_authority: record.grievance_authority,
              execution_authority: record.execution_authority,
              funding_pathway: record.funding_pathway,
              statutory_limit_days: 90,
              status: "submitted",
              resolved_at: null,
              resolution_photo_url: null,
            })
            .select()
            .single();
          issue = data;
          insertError = error;
          if (error?.code !== "23505") break;
        }
        if (!issue) throw new Error(`Issue creation failed: ${insertError?.message ?? "unknown error"}`);
      }
      eventType = "SUBMITTED";
    }

    const reportId = derivedUuid(submissionId, `report:${issue.id}`);
    const { data: existingReport, error: reportLookupError } = await supabase
      .from("reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle();
    if (reportLookupError) throw new Error(`Report lookup failed: ${reportLookupError.message}`);
    if (!existingReport) {
      const { error } = await supabase.from("reports").insert({
        id: reportId,
        issue_id: issue.id,
        text_original: record.text_original,
        text_hindi: record.text_hindi,
        text_english_official: record.text_english_official,
        detected_language: record.detected_language,
        photo_url: photoUrls[0],
        photo_urls: photoUrls,
        reporter_mode: "anonymous",
        reporter_name: null,
        reporter_contact: null,
        capture_provenance: captureProvenance,
      });
      if (error) throw new Error(`Report creation failed: ${error.message}`);
    }

    const eventId = derivedUuid(submissionId, `event:${eventType}:${issue.id}`);
    const { data: existingEvent, error: eventLookupError } = await supabase
      .from("status_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventLookupError) throw new Error(`Status lookup failed: ${eventLookupError.message}`);
    if (!existingEvent) {
      const { error } = await supabase.from("status_events").insert({
        id: eventId,
        issue_id: issue.id,
        event_type: eventType,
        actor_office: "Public intake ledger",
        note:
          eventType === "CORROBORATED"
            ? "An additional anonymous report corroborated this issue."
            : "Anonymous report received and routed to the responsible office.",
      });
      if (error) throw new Error(`Status event creation failed: ${error.message}`);
    }

    return {
      ok: true as const,
      code: issue.code,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
