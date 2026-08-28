import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "../lib/i18n";
import "./globals.css";
import { PrototypeBanner } from "./prototype-banner";
import { LocationProvider } from "./location-context";
import { WorkInProgressPanel } from "./work-in-progress-panel";

export const metadata: Metadata = {
  title: t("siteName"),
  description: t("siteDescription"),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-sand text-charcoal">
        <header className="bg-indigo text-sand">
          <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight sm:text-xl">
              {t("siteName")}
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
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
