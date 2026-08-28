"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database, IssueStatus, StatusEventType } from "../../../lib/db";
import { redactPhotoOnServer } from "../../report/redact-photo-action";

const actionSchema = z.object({
  blockId: z.string().min(1).max(100),
  issueId: z.string().uuid(),
  action: z.enum(["acknowledge", "inspection", "unfunded", "resolve"]),
  note: z.string().trim().min(3).max(2_000),
  unfundedReason: z.enum(["not_awpb", "awaiting_sanction", "exceeds_grant"]).optional(),
});

const reasonText = {
  not_awpb: "Not in current AWP&B",
  awaiting_sanction: "Awaiting sanction",
  exceeds_grant: "Exceeds grant limit",
} as const;

function departmentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Department demonstration credentials are not configured");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function recordDepartmentAction(formData: FormData) {
  try {
    const input = actionSchema.parse({
      blockId: formData.get("block_id"),
      issueId: formData.get("issue_id"),
      action: formData.get("action"),
      note: formData.get("note"),
      unfundedReason: formData.get("unfunded_reason") || undefined,
    });
    if (input.action === "unfunded" && !input.unfundedReason) {
      return { ok: false as const, error: "reason_required" as const };
    }

    const admin = departmentAdmin();
    const { data: issue, error: issueError } = await admin
      .from("issues")
      .select("*, schools!inner(block_id)")
      .eq("id", input.issueId)
      .eq("schools.block_id", input.blockId)
      .maybeSingle();
    if (issueError) throw new Error(issueError.message);
    if (!issue) return { ok: false as const, error: "issue_not_found" as const };
    if (issue.status === "resolved") return { ok: false as const, error: "issue_closed" as const };

    let resolutionPhotoUrl: string | null = null;
    if (input.action === "resolve") {
      const photo = formData.get("resolution_photo");
      if (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size === 0) {
        return { ok: false as const, error: "photo_required" as const };
      }
      if (photo.size > 5_000_000) return { ok: false as const, error: "photo_too_large" as const };

      const redactionInput = new FormData();
      redactionInput.set("image", photo, "resolution-source.jpg");
      const redacted = await redactPhotoOnServer(redactionInput);
      if (!redacted.ok) return { ok: false as const, error: "photo_redaction_failed" as const };

      const bytes = Buffer.from(redacted.imageBase64, "base64");
      const path = `resolutions/${issue.id}/${randomUUID()}.jpg`;
      const { error: uploadError } = await admin.storage
        .from("report-photos")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      resolutionPhotoUrl = admin.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
    }

    const eventType: Record<typeof input.action, StatusEventType> = {
      acknowledge: "ACKNOWLEDGED",
      inspection: "INSPECTION_ORDERED",
      unfunded: "MARKED_UNFUNDED",
      resolve: "RESOLVED",
    };
    const note = input.action === "unfunded"
      ? `Funding constraint: ${reasonText[input.unfundedReason!]}. ${input.note}`
      : input.note;

    const { error: eventError } = await admin.from("status_events").insert({
      issue_id: issue.id,
      event_type: eventType[input.action],
      actor_office: issue.grievance_authority,
      note,
    });
    if (eventError) throw new Error(eventError.message);

    const status: Record<typeof input.action, IssueStatus> = {
      acknowledge: "in_progress",
      inspection: "in_progress",
      unfunded: "unfunded",
      resolve: "resolved",
    };
    const updates = input.action === "resolve"
      ? { status: status[input.action], resolved_at: new Date().toISOString(), resolution_photo_url: resolutionPhotoUrl }
      : { status: status[input.action] };
    const { error: updateError } = await admin.from("issues").update(updates).eq("id", issue.id);
    if (updateError) throw new Error(updateError.message);

    revalidatePath(`/dept/${input.blockId}`);
    revalidatePath(`/issue/${issue.code}`);
    return { ok: true as const };
  } catch (error) {
    console.error("[department action]", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}
