import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Noto_Sans_Devanagari, Noto_Sans_Kannada } from "next/font/google";
import type { ReactNode } from "react";
import { isLanguage, setActiveLanguage, t } from "../lib/i18n";
import "./globals.css";
import { PrototypeBanner } from "./prototype-banner";
import { LocationProvider } from "./location-context";
import { WorkInProgressPanel } from "./work-in-progress-panel";
import { LanguageSwitcher } from "./language-switcher";

const devanagariFont = Noto_Sans_Devanagari({
  weight: "400",
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-devanagari",
  preload: false,
});

const kannadaFont = Noto_Sans_Kannada({
  weight: "400",
  subsets: ["kannada"],
  display: "swap",
  variable: "--font-kannada",
  preload: false,
});

export const metadata: Metadata = {
  title: t("siteName"),
  description: t("siteDescription"),
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieLanguage = (await cookies()).get("thikhua-language")?.value;
  const language = isLanguage(cookieLanguage) ? cookieLanguage : "en";
  setActiveLanguage(language);
  return (
    <html lang={language} className={`${devanagariFont.variable} ${kannadaFont.variable}`}>
      <body className="bg-sand text-charcoal">
        <header className="bg-indigo text-sand">
          <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight sm:text-xl">
              {t("siteName")}
            </Link>
            <LanguageSwitcher language={language} />
            <nav className="flex w-full items-center justify-between gap-1 sm:ml-auto sm:w-auto sm:justify-start sm:gap-2">
              <Link
                href="/track"
                className="flex min-h-11 items-center rounded border border-sand px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand"
              >
                <span className="sm:hidden">{t("trackIssueShort")}</span>
                <span className="hidden sm:inline">{t("trackIssue")}</span>
              </Link>
              <WorkInProgressPanel />
              <Link
                href="/report"
                className="flex min-h-11 items-center rounded border-2 border-rani bg-sand px-3 py-2 text-sm font-bold text-charcoal ring-2 ring-inset ring-rani focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand"
              >
                {t("startReport")}
              </Link>
            </nav>
          </div>
        </header>
        <PrototypeBanner />
        <LocationProvider>{children}</LocationProvider>
        <footer className="border-t border-stone bg-sand px-4 py-5 text-center text-xs text-charcoal">{t("prototypeFooter")}</footer>
      </body>
    </html>
  );
}
