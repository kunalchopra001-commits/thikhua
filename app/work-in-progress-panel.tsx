"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";

export function WorkInProgressPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function closePanel() {
    setIsOpen(false);
    window.setTimeout(() => openButtonRef.current?.focus(), 0);
  }

  return (
    <>
      <button ref={openButtonRef} type="button" aria-expanded={isOpen} aria-controls="prototype-context-panel" onClick={() => setIsOpen(true)} className="min-h-11 rounded border border-sand px-2 py-2 text-xs font-bold text-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand sm:px-3 sm:text-sm">
        {t("whatIsThis")}
      </button>
      {isOpen ? <button type="button" aria-label={t("closeContextPanel")} onClick={closePanel} className="fixed inset-0 z-40 bg-charcoal/45" /> : null}
      <aside id="prototype-context-panel" role="dialog" aria-modal="true" aria-labelledby="prototype-context-title" aria-hidden={!isOpen} className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-stone bg-sand shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-stone px-5 py-4">
          <h2 id="prototype-context-title" className="text-lg font-bold text-indigo">{t("contextPanelTitle")}</h2>
          <button ref={closeButtonRef} type="button" tabIndex={isOpen ? 0 : -1} onClick={closePanel} className="grid size-11 place-items-center rounded-full border border-indigo text-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo" aria-label={t("closeContextPanel")}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="space-y-7 overflow-y-auto px-5 py-6 text-sm leading-6 text-charcoal">
          <section><h3 className="mb-2 text-xs font-black tracking-widest text-rani">{t("contextProblemHeading")}</h3><p>{t("contextProblemBody")}</p></section>
          <section><h3 className="mb-2 text-xs font-black tracking-widest text-rani">{t("contextResearchHeading")}</h3><p>{t("contextResearchBody")}</p></section>
          <section>
            <h3 className="mb-2 text-xs font-black tracking-widest text-rani">{t("contextWorkingHeading")}</h3>
            <ul className="list-disc space-y-2 pl-5"><li>{t("contextWorkingLocal")}</li><li>{t("contextWorkingPhotos")}</li><li>{t("contextWorkingSignboard")}</li><li>{t("contextWorkingAi")}</li><li>{t("contextWorkingLedger")}</li></ul>
          </section>
          <section><h3 className="mb-2 text-xs font-black tracking-widest text-rani">{t("contextNextHeading")}</h3><p>{t("contextNextBody")}</p></section>
        </div>
      </aside>
    </>
  );
}
