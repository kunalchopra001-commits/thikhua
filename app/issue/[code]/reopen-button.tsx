"use client";

import { useState, useTransition } from "react";
import { t } from "../../../lib/i18n";
import { reopenIssue } from "./actions";

export function ReopenButton({ code }: { code: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await reopenIssue(code);
            setMessage(result.ok ? t("issueReopened") : t("issueReopenFailed"));
          });
        }}
        className="min-h-12 w-full rounded bg-rani px-5 py-3 font-bold text-sand disabled:opacity-60 sm:w-auto"
      >
        {isPending ? t("issueReopening") : t("issueNotFixed")}
      </button>
      {message ? <p className="mt-2 text-sm" role="status">{message}</p> : null}
    </div>
  );
}
