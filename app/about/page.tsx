import { t } from "../../lib/i18n";
import Link from "next/link";

export default function About() {
  return (
    <main className="min-h-screen bg-sand text-charcoal">
      <div className="mx-auto max-w-3xl space-y-10 p-6 py-16">
        <h1 className="text-4xl font-semibold">{t("aboutTitle")}</h1>
        <section>
          <h2 className="text-2xl font-semibold">{t("aboutWorksToday")}</h2>
          <p className="mt-3 leading-7">{t("aboutWorksTodayBody")}</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">{t("aboutMocked")}</h2>
          <p className="mt-3 leading-7">{t("aboutMockedBody")}</p>
          <Link href="/dept/bengaluru-east-urban" className="mt-4 inline-flex min-h-11 items-center rounded border-2 border-rani px-4 py-2 font-bold text-charcoal">
            {t("aboutDepartmentDemo")}
          </Link>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">{t("aboutAtScale")}</h2>
          <p className="mt-3 leading-7">{t("aboutAtScaleBody")}</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold">{t("aboutRetention")}</h2>
          <p className="mt-3 leading-7">{t("aboutRetentionBody")}</p>
        </section>
      </div>
    </main>
  );
}
