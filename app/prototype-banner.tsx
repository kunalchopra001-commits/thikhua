"use client";

import { useState } from "react";
import { t } from "../lib/i18n";

export function PrototypeBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="border-b border-ochre bg-sand text-charcoal">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 py-3 text-sm sm:items-center sm:px-6">
        <p>{t("prototypeBanner")}</p>
        <button
          type="button"
          className="shrink-0 rounded border border-charcoal px-2 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          aria-label={t("dismissBanner")}
          onClick={() => setIsVisible(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}
