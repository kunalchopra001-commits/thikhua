import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "../lib/i18n";
import "./globals.css";
import { PrototypeBanner } from "./prototype-banner";

export const metadata: Metadata = {
  title: t("siteName"),
  description: t("siteDescription"),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-sand text-charcoal">
        <header className="bg-indigo text-sand">
          <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="text-xl font-bold tracking-tight">
              {t("siteName")}
            </Link>
            <Link
              href="/track"
              className="rounded border border-sand px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand"
            >
              {t("trackIssue")}
            </Link>
          </div>
        </header>
        <PrototypeBanner />
        {children}
      </body>
    </html>
  );
}
