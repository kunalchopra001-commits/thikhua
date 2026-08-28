import Link from "next/link";
import { t } from "../../../lib/i18n";

export default function IssueNotFound() {
  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-12 text-charcoal sm:px-6">
      <section className="mx-auto max-w-xl rounded border-2 border-stone p-6 text-center sm:p-8">
        <h1 className="text-3xl font-bold text-indigo">{t("issueNotFoundTitle")}</h1>
        <p className="mt-3 leading-6">{t("issueNotFoundBody")}</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded bg-indigo px-5 py-3 font-bold text-sand">
          {t("issueBackHome")}
        </Link>
      </section>
    </main>
  );
}
