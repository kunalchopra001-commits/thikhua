"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appendStatusEvent, getIssueByCode, supabase } from "../../../lib/db";

export async function reopenIssue(codeValue: string) {
  const code = z.string().trim().min(1).max(32).parse(codeValue).toUpperCase();
  const issue = await getIssueByCode(code);
  if (!issue) return { ok: false as const, error: "not_found" as const };
  if (issue.status !== "resolved") return { ok: false as const, error: "not_resolved" as const };

  const { data: latestEvent, error } = await supabase
    .from("status_events")
    .select("event_type")
    .eq("issue_id", issue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (latestEvent?.event_type !== "REOPENED") {
    await appendStatusEvent({
      issue_id: issue.id,
      event_type: "REOPENED",
      actor_office: "Public issue ledger",
      note: "A citizen reported that the published repair has not fixed the issue.",
    });
  }

  revalidatePath(`/issue/${code}`);
  return { ok: true as const };
}
