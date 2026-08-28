import { t } from "../../lib/i18n";

const sources = [
  ["sourceSamagraFinance", "https://samagra.education.gov.in/docs/FMP.pdf"],
  ["sourceSamagraFramework", "https://samagra.education.gov.in/docs/ss_implementation.pdf"],
  ["sourceRte", "https://www.indiacode.nic.in/handle/123456789/2086?locale=en"],
  ["sourceNcpcr", "https://www.ncpcr.gov.in/public/report"],
  ["sourceUdise", "https://udiseplus.gov.in/"],
  ["sourceCpgrams", "https://www.pgportal.gov.in/"],
  ["sourceDarpg", "https://darpg.gov.in/sites/default/files/Comprehensive_guidelines_for_handling_the_Public_Grievances.pdf"],
  ["sourceDpdp", "https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf"],
  ["sourceDpdpRules", "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa"],
  ["sourceDigipin", "https://www.indiapost.gov.in/digipin"],
] as const;

export default function ResearchPage() {
  return (
    <main className="min-h-screen bg-sand px-4 py-10 text-charcoal sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <header className="border-b-2 border-indigo pb-7">
          <p className="text-sm font-bold uppercase tracking-widest text-terracotta">{t("researchNav")}</p>
          <h1 className="mt-2 text-4xl font-black leading-tight text-indigo sm:text-5xl">{t("researchTitle")}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8">{t("researchIntro")}</p>
        </header>

        <div className="mt-12 space-y-14">
          <section aria-labelledby="campaign">
            <h2 id="campaign" className="text-xl font-black tracking-wide text-indigo">{t("researchCampaignTitle")}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 sm:text-lg">
              <p>{t("researchCampaignBodyOne")}</p>
              <p>{t("researchCampaignBodyTwo")}</p>
            </div>
          </section>

          <section aria-labelledby="existing">
            <h2 id="existing" className="text-xl font-black tracking-wide text-indigo">{t("researchExistingTitle")}</h2>
            <div className="mt-6 space-y-7">
              <div className="border-l-4 border-ochre pl-5">
                <h3 className="font-black text-indigo">{t("researchCpgramsTitle")}</h3>
                <p className="mt-2 leading-8">{t("researchCpgramsBody")}</p>
              </div>
              <div className="border-l-4 border-terracotta pl-5">
                <h3 className="font-black text-indigo">{t("researchRteTitle")}</h3>
                <p className="mt-2 leading-8">{t("researchRteBody")}</p>
              </div>
              <div className="border-l-4 border-stone pl-5">
                <h3 className="font-black text-indigo">{t("researchUdiseTitle")}</h3>
                <p className="mt-2 leading-8">{t("researchUdiseBody")}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="finding" className="rounded border-2 border-indigo bg-indigo p-6 text-sand sm:p-8">
            <h2 id="finding" className="text-xl font-black tracking-wide">{t("researchFindingTitle")}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 sm:text-lg">
              <p>{t("researchFindingBodyOne")}</p>
              <p>{t("researchFindingBodyTwo")}</p>
            </div>
          </section>

          <section aria-labelledby="response">
            <h2 id="response" className="text-xl font-black tracking-wide text-indigo">{t("researchProductTitle")}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 sm:text-lg">
              <p>{t("researchProductBodyOne")}</p>
              <p>{t("researchProductBodyTwo")}</p>
            </div>
          </section>

          <section aria-labelledby="sources" className="border-t-2 border-indigo pt-8">
            <h2 id="sources" className="text-xl font-black tracking-wide text-indigo">{t("researchSourcesTitle")}</h2>
            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 marker:text-terracotta">
              {sources.map(([key, href]) => (
                <li key={key}>
                  <a href={href} className="font-bold text-indigo underline decoration-ochre decoration-2 underline-offset-4">
                    {t(key)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </main>
  );
}
