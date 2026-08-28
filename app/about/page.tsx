import { t } from "../../lib/i18n";
import Link from "next/link";

export default function About() {
  return (
    <main className="min-h-screen bg-sand px-4 py-10 text-charcoal sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="border-b-2 border-indigo pb-6">
          <h1 className="text-4xl font-bold text-indigo">{t("aboutTitle")}</h1>
          <p className="mt-3 max-w-2xl leading-7">{t("aboutIntro")}</p>
        </header>

        <div className="mt-10 space-y-10">
        <section aria-labelledby="works-today">
          <h2 id="works-today" className="text-xl font-black tracking-wide text-indigo">{t("aboutWorksToday")}</h2>
          <p className="mt-3 leading-7">{t("aboutWorksTodayBody")}</p>
        </section>
        <section aria-labelledby="simulated">
          <h2 id="simulated" className="text-xl font-black tracking-wide text-indigo">{t("aboutMocked")}</h2>
          <p className="mt-3 leading-7">{t("aboutMockedBody")}</p>
          <Link href="/dept/bengaluru-east-urban" className="mt-4 inline-flex min-h-11 items-center rounded border-2 border-rani px-4 py-2 font-bold text-charcoal">
            {t("aboutDepartmentDemo")}
          </Link>
        </section>
        <section aria-labelledby="limitations" className="border-l-4 border-ochre pl-5">
          <h2 id="limitations" className="text-xl font-black tracking-wide text-indigo">{t("aboutKnownLimitations")}</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 leading-7">
            <li>{t("aboutLimitationGallery")}</li>
            <li>{t("aboutLimitationSignboard")}</li>
            <li>{t("aboutLimitationRls")}</li>
            <li>{t("aboutLimitationFaces")}</li>
          </ul>
        </section>
        <section aria-labelledby="at-scale">
          <h2 id="at-scale" className="text-xl font-black tracking-wide text-indigo">{t("aboutAtScale")}</h2>
          <p className="mt-3 leading-7">{t("aboutAtScaleBody")}</p>
        </section>
        <section aria-labelledby="retention">
          <h2 id="retention" className="text-xl font-black tracking-wide text-indigo">{t("aboutRetention")}</h2>
          <p className="mt-3 leading-7">{t("aboutRetentionBody")}</p>
        </section>
        <p className="border-t border-stone pt-6 leading-7">
          <a
            href="https://github.com/kunalchopra001-commits/thikhua/blob/main/BUILD-LOG.md"
            className="font-bold text-indigo underline decoration-ochre decoration-2 underline-offset-4"
          >
            {t("aboutBuildLog")}
          </a>
        </p>
        </div>
      </div>
    </main>
  );
}
