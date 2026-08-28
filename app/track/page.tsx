"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../lib/i18n";

export default function TrackPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function normalizedCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-12 text-charcoal sm:px-6">
      <section className="mx-auto max-w-lg rounded border-2 border-indigo p-5 sm:p-8">
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-rani">
          {t("trackAnonymous")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-indigo sm:text-4xl">{t("trackTitle")}</h1>
        <p className="mt-3 leading-6">{t("trackHelp")}</p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            const destinationCode = normalizedCode(code);
            if (destinationCode.length === 6) router.push(`/issue/${destinationCode}`);
          }}
        >
          <label htmlFor="complaint-code" className="block font-bold text-indigo">
            {t("trackCodeLabel")}
          </label>
          <input
            id="complaint-code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => setCode(normalizedCode(event.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            placeholder={t("trackCodePlaceholder")}
            className="mt-2 min-h-14 w-full rounded border-2 border-indigo bg-sand px-4 py-3 font-mono text-2xl font-black uppercase tracking-[0.15em] text-charcoal placeholder:text-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          />
          <button
            type="submit"
            disabled={code.length !== 6}
            className="mt-5 min-h-12 w-full rounded bg-rani px-5 py-3 font-bold text-sand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("trackSubmit")}
          </button>
        </form>
      </section>
    </main>
  );
}
