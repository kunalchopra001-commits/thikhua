"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../../lib/i18n";
import { recordDepartmentAction } from "./actions";

type ActionKind = "acknowledge" | "inspection" | "unfunded" | "resolve";
type ResultError = Exclude<Awaited<ReturnType<typeof recordDepartmentAction>>, { ok: true }>["error"];

const errorKeys: Record<ResultError, Parameters<typeof t>[0]> = {
  reason_required: "deptReasonRequired",
  issue_not_found: "deptIssueNotFound",
  issue_closed: "deptIssueClosed",
  photo_required: "deptPhotoRequired",
  photo_too_large: "deptPhotoTooLarge",
  photo_redaction_failed: "deptPhotoRedactionFailed",
  unexpected: "deptActionFailed",
};

export function IssueActions({ blockId, issueId }: { blockId: string; issueId: string }) {
  const router = useRouter();
  const [action, setAction] = useState<ActionKind>("acknowledge");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-5 border-t-2 border-stone pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await recordDepartmentAction(formData);
          if (result.ok) {
            setMessage(t("deptActionRecorded"));
            form.reset();
            setAction("acknowledge");
            router.refresh();
          } else {
            setMessage(t(errorKeys[result.error]));
          }
        });
      }}
    >
      <input type="hidden" name="block_id" value={blockId} />
      <input type="hidden" name="issue_id" value={issueId} />
      <fieldset>
        <legend className="font-bold text-indigo">{t("deptChooseAction")}</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["acknowledge", "inspection", "unfunded", "resolve"] as const).map((value) => (
            <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center rounded border-2 px-2 py-3 text-center text-sm font-bold ${action === value ? "border-indigo bg-indigo text-sand" : "border-stone bg-sand text-charcoal"}`}>
              <input type="radio" name="action" value={value} checked={action === value} onChange={() => setAction(value)} className="sr-only" />
              {t({ acknowledge: "deptAcknowledge", inspection: "deptOrderInspection", unfunded: "deptMarkUnfunded", resolve: "deptResolve" }[value] as Parameters<typeof t>[0])}
            </label>
          ))}
        </div>
      </fieldset>

      {action === "unfunded" ? (
        <label className="mt-4 block font-bold text-indigo">
          {t("deptUnfundedReason")}
          <select name="unfunded_reason" required className="mt-2 min-h-12 w-full rounded border-2 border-indigo bg-sand px-3 py-2 text-charcoal">
            <option value="">{t("deptSelectReason")}</option>
            <option value="not_awpb">{t("deptReasonAwbp")}</option>
            <option value="awaiting_sanction">{t("deptReasonSanction")}</option>
            <option value="exceeds_grant">{t("deptReasonGrant")}</option>
          </select>
        </label>
      ) : null}

      {action === "resolve" ? (
        <label className="mt-4 block font-bold text-indigo">
          {t("deptAfterPhoto")}
          <input name="resolution_photo" type="file" accept="image/*" capture="environment" required className="mt-2 block min-h-12 w-full rounded border-2 border-indigo bg-sand p-2 text-charcoal file:mr-3 file:rounded file:border-0 file:bg-indigo file:px-3 file:py-2 file:font-bold file:text-sand" />
          <span className="mt-1 block text-xs font-normal text-charcoal">{t("deptAfterPhotoPrivacy")}</span>
        </label>
      ) : null}

      <label className="mt-4 block font-bold text-indigo">
        {t("deptOfficerNote")}
        <textarea name="note" required minLength={3} maxLength={2000} placeholder={t("deptOfficerNotePlaceholder")} className="mt-2 min-h-28 w-full rounded border-2 border-indigo bg-sand p-3 text-base text-charcoal placeholder:text-stone" />
      </label>
      <button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full rounded bg-rani px-5 py-3 font-bold text-sand disabled:opacity-60 sm:w-auto">
        {isPending ? t("deptRecordingAction") : t("deptRecordAction")}
      </button>
      {message ? <p className="mt-3 text-sm font-bold" role="status">{message}</p> : null}
    </form>
  );
}
