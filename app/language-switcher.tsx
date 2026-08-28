"use client";

import { useEffect } from "react";
import { languageLabels, setActiveLanguage, translate } from "../lib/i18n";
import type { Language } from "../lib/i18n";

const STORAGE_KEY = "thikhua-language";

export function LanguageSwitcher({ language }: { language: Language }) {
  setActiveLanguage(language);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if ((stored === "en" || stored === "hi" || stored === "kn") && stored !== language) {
      document.cookie = `thikhua-language=${stored}; path=/; max-age=31536000; samesite=lax`;
      window.location.reload();
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  return (
    <label className="shrink-0">
      <span className="sr-only">{translate(language, "languageSwitcherLabel")}</span>
      <select
        value={language}
        onChange={(event) => {
          const nextLanguage = event.target.value as Language;
          window.localStorage.setItem(STORAGE_KEY, nextLanguage);
          document.cookie = `thikhua-language=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
          document.documentElement.lang = nextLanguage;
          window.location.reload();
        }}
        className="min-h-11 max-w-24 rounded border border-sand bg-indigo px-2 py-2 text-xs font-bold text-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand sm:max-w-none sm:text-sm"
      >
        {(Object.keys(languageLabels) as Language[]).map((value) => (
          <option key={value} value={value} className="bg-sand text-charcoal">{languageLabels[value]}</option>
        ))}
      </select>
    </label>
  );
}
