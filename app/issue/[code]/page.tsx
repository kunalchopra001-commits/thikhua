import { notFound } from "next/navigation";
import { getIssueByCode, supabase } from "../../../lib/db";
import type { StatusEventType } from "../../../lib/db";
import { t } from "../../../lib/i18n";
import { IssueClock } from "./issue-clock";
import { ReopenButton } from "./reopen-button";

const severityClasses = {
  S1: "border-rani bg-rani text-sand",
  S2: "border-terracotta bg-terracotta text-charcoal",
  S3: "border-ochre bg-ochre text-charcoal",
  S4: "border-stone bg-sand text-charcoal",
} as const;

const eventLabels: Record<StatusEventType, Parameters<typeof t>[0]> = {
  SUBMITTED: "eventSubmitted",
  CORROBORATED: "eventCorroborated",
  ACKNOWLEDGED: "eventAcknowledged",
  INSPECTION_ORDERED: "eventInspectionOrdered",
  MARKED_UNFUNDED: "eventMarkedUnfunded",
  RESOLVED: "eventResolved",
  REOPENED: "eventReopened",
};

function uniquePhotoUrls(reports: { photo_url: string; photo_urls: string[] }[]) {
  return [...new Set(reports.flatMap((report) => report.photo_urls.length ? report.photo_urls : [report.photo_url]))];
}

function ReportPhoto({ url, index }: { url: string; index: number }) {
  if (url.startsWith("/placeholder/")) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded border-2 border-dashed border-stone bg-sand p-5 text-center text-sm font-semibold">
        {t("issuePhotoPlaceholder", { number: index + 1 })}
      </div>
    );
  }
  return <img src={url} alt={t("issuePhotoAlt", { number: index + 1 })} className="h-auto w-full rounded border-2 border-stone object-contain" />;
}

export default async function IssuePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const issue = await getIssueByCode(rawCode.toUpperCase());
  if (!issue) notFound();

  const [{ data: school, error: schoolError }, { data: reports, error: reportsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", issue.school_id).maybeSingle(),
    supabase.from("reports").select("*").eq("issue_id", issue.id).order("created_at", { ascending: true }),
    supabase.from("status_events").select("*").eq("issue_id", issue.id).order("created_at", { ascending: true }),
  ]);
  if (schoolError || reportsError || eventsError) throw new Error(schoolError?.message ?? reportsError?.message ?? eventsError?.message);
  if (!school || !reports?.length) notFound();

  const photos = uniquePhotoUrls(reports);
  const latestEvent = events?.at(-1)?.event_type;

  return (
    <main className="bg-sand px-4 py-8 text-charcoal sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl">
        <header className="border-b-2 border-indigo pb-6">
          <p className="font-mono text-sm font-bold tracking-wider text-indigo">{issue.code}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-indigo sm:text-4xl">{school.name_en}</h1>
          <p className="mt-2 font-semibold">{t("issueBlock", { block: school.block_name, district: school.district })}</p>
        </header>

        <div className="mt-6"><IssueClock createdAt={issue.created_at} statutoryLimitDays={issue.statutory_limit_days} /></div>

        {issue.status === "unfunded" ? (
          <section className="mt-6 border-l-8 border-rani bg-rani/10 p-5" aria-labelledby="unfunded-heading">
            <h2 id="unfunded-heading" className="text-xl font-black text-indigo">{t("issueUnfundedTitle")}</h2>
            <p className="mt-2 leading-6">{t("issueUnfundedBody")}</p>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="defect-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="defect-heading" className="text-2xl font-bold text-indigo">{t("issueDefect")}</h2>
            <span className={`rounded-full border-2 px-3 py-2 text-sm font-black ${severityClasses[issue.severity]}`}>{issue.severity}</span>
          </div>
          <p className="mt-4 text-lg leading-7">{reports[0].text_english_official}</p>
          <div className="mt-5 border-l-4 border-ochre p-4">
            <p className="text-sm font-black uppercase tracking-wide">{t("issueSeverityProvisional")}</p>
            <p className="mt-2 leading-6">{issue.severity_reasoning}</p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="photos-heading">
          <h2 id="photos-heading" className="text-2xl font-bold text-indigo">{t("issuePhotos")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{photos.map((url, index) => <ReportPhoto key={url} url={url} index={index} />)}</div>
        </section>

        <section className="mt-10 border-2 border-indigo" aria-labelledby="authorities-heading">
          <h2 id="authorities-heading" className="bg-indigo px-5 py-4 text-xl font-bold text-sand">{t("issueWhoAnswers")}</h2>
          <div className="grid md:grid-cols-2">
            <div className="border-b-2 border-indigo p-5 md:border-b-0 md:border-r-2"><h3 className="text-sm font-black uppercase tracking-wide text-indigo">{t("issueGrievanceAuthority")}</h3><p className="mt-2 text-lg font-bold leading-7">{issue.grievance_authority}</p></div>
            <div className="p-5"><h3 className="text-sm font-black uppercase tracking-wide text-indigo">{t("issueExecutionAuthority")}</h3><p className="mt-2 text-lg font-bold leading-7">{issue.execution_authority}</p></div>
          </div>
          <div className="border-t-2 border-indigo bg-ochre/15 p-5"><h3 className="text-sm font-black uppercase tracking-wide text-indigo">{t("issueFundingPathway")}</h3><p className="mt-2 text-lg leading-7">{issue.funding_pathway}</p></div>
        </section>

        {issue.status === "resolved" && issue.resolution_photo_url ? (
          <section className="mt-10" aria-labelledby="resolution-heading">
            <h2 id="resolution-heading" className="text-2xl font-bold text-indigo">{t("issueResolution")}</h2>
            <div className="mt-4"><ReportPhoto url={issue.resolution_photo_url} index={0} /></div>
            {latestEvent === "REOPENED" ? <p className="mt-4 border-l-4 border-rani p-3 font-bold">{t("issueAlreadyReopened")}</p> : <div className="mt-5"><ReopenButton code={issue.code} /></div>}
          </section>
        ) : null}

        <section className="mt-12" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="text-2xl font-bold text-indigo">{t("issueTimeline")}</h2>
          <p className="mt-2 text-sm">{t("issueTimelineAppendOnly")}</p>
          <ol className="mt-6 border-l-2 border-indigo pl-5">
            {(events ?? []).map((event) => (
              <li key={event.id} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[1.7rem] top-1 size-3 rounded-full border-2 border-indigo bg-sand" aria-hidden="true" />
                <time dateTime={event.created_at} className="text-sm font-bold">{new Date(event.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
                <h3 className="mt-1 text-lg font-black text-indigo">{t(eventLabels[event.event_type])}</h3>
                <p className="mt-1 text-sm font-bold">{event.actor_office}</p>
                <p className="mt-2 leading-6">{event.note}</p>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </main>
  );
}
