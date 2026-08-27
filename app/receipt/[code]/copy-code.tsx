"use client";

import { useState } from "react";
import { t } from "../../../lib/i18n";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="min-h-11 rounded border-2 border-indigo px-4 py-2 font-bold"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
      }}
    >
      {copied ? t("codeCopied") : t("copyCode")}
    </button>
  );
}
