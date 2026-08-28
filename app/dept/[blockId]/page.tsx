import Link from "next/link";
import { notFound } from "next/navigation";
import { SCHOOLS } from "../../../data/seed";
import { getIssuesByBlock, getReportsByIssueIds, supabase } from "../../../lib/db";
import type { Severity } from "../../../lib/db";
import { t } from "../../../lib/i18n";
import { IssueActions } from "./issue-actions";

const severityOrder: Record<Severity, number> = { S1: 1, S2: 2, S3: 3, S4: 4 };
const severityClasses = { S1: "border-rani bg-rani text-sand", S2: "border-terracotta bg-terracotta text-charcoal", S3: "border-ochre bg-ochre text-charcoal", S4: "border-stone bg-sand text-charcoal" } as const;
const openStatuses = new Set(["submitted", "in_progress", "overdue", "unfunded"]);

function daysElapsed(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export default async function DepartmentPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const seedSchools = SCHOOLS.filter((school) => school.block_id === blockId);
  if (!seedSchools.length) notFound();

  const allIssues = await getIssuesByBlock(blockId);
  const openIssues = allIssues.filter((issue) => openStatuses.has(issue.status)).sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const reports = await getReportsByIssueIds(openIssues.map((issue) => issue.id));
  const firstReport = new Map<string, string>();
  reports.forEach((report) => { if (!firstReport.has(report.issue_id)) firstReport.set(report.issue_id, report.text_english_official); });
  const issueIds = allIssues.map((issue) => issue.id);
  const { data: events, error } = issueIds.length ? await supabase.from("status_events").select("*").in("issue_id", issueIds).order("created_at", { ascending: true }) : { data: [], error: null };
  if (error) throw new Error(error.message);
  const issueById = new Map(allIssues.map((issue) => [issue.id, issue]));
  const acknowledgedWithinSla = new Set((events ?? []).filter((event) => { const issue = issueById.get(event.issue_id); return event.event_type === "ACKNOWLEDGED" && issue && new Date(event.created_at).getTime() <= new Date(issue.created_at).getTime() + issue.statutory_limit_days * 86_400_000; }).map((event) => event.issue_id)).size;
  const inspections = new Set((events ?? []).filter((event) => event.event_type === "INSPECTION_ORDERED").map((event) => event.issue_id)).size;
  const unfunded = new Set((events ?? []).filter((event) => event.event_type === "MARKED_UNFUNDED").map((event) => event.issue_id)).size;

  return (
    <main className="bg-sand px-4 py-8 text-charcoal sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="border-l-8 border-rani bg-rani/10 p-4 font-bold" role="note">{t("deptSimulationBanner")}</div>
        <header className="mt-8 border-b-2 border-indigo pb-6">
          <p className="text-sm font-bold uppercase tracking-wider text-rani">{seedSchools[0].block_name}</p>
          <h1 lang="hi" className="mt-2 text-3xl font-black leading-tight text-indigo sm:text-4xl">{t("deptCareHeader", { schools: seedSchools.length, children: seedSchools.reduce((sum, school) => sum + school.enrolment, 0) })}</h1>
          <p className="mt-3 max-w-3xl leading-6">{t("deptCareIntro")}</p>
        </header>

        <section className="mt-8" aria-labelledby="record-heading">
          <h2 id="record-heading" className="text-2xl font-bold text-indigo">{t("deptYourRecord")}</h2>
          <p className="mt-2">{t("deptYourRecordIntro")}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded border-2 border-green p-4"><dt className="text-sm font-bold">{t("deptAcknowledgedSla")}</dt><dd className="mt-2 font-mono text-3xl font-black text-indigo">{acknowledgedWithinSla}</dd></div>
            <div className="rounded border-2 border-ochre p-4"><dt className="text-sm font-bold">{t("deptInspectionsCount")}</dt><dd className="mt-2 font-mono text-3xl font-black text-indigo">{inspections}</dd></div>
            <div className="rounded border-2 border-rani p-4"><dt className="text-sm font-bold">{t("deptUnfundedCount")}</dt><dd className="mt-2 font-mono text-3xl font-black text-indigo">{unfunded}</dd></div>
          </dl>
        </section>

        <section className="mt-10" aria-labelledby="queue-heading">
          <div className="flex items-end justify-between gap-3"><div><h2 id="queue-heading" className="text-2xl font-bold text-indigo">{t("deptOpenQueue")}</h2><p className="mt-1 text-sm">{t("deptQueueOrder")}</p></div><span className="font-mono text-2xl font-black text-indigo">{openIssues.length}</span></div>
          <div className="mt-5 space-y-4">
            {openIssues.map((issue) => {
              const school = seedSchools.find((candidate) => candidate.id === issue.school_id);
              const days = daysElapsed(issue.created_at);
              return (
                <details key={issue.id} className="rounded border-2 border-stone p-4 open:border-indigo sm:p-5">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold text-rani">{issue.code}</p><h3 className="mt-1 text-lg font-bold text-indigo">{school?.name_en}</h3></div><span className={`rounded-full border-2 px-3 py-1 text-sm font-black ${severityClasses[issue.severity]}`}>{issue.severity}</span></div>
                    <p className="mt-3 leading-6">{firstReport.get(issue.id) ?? issue.severity_reasoning}</p>
                    <p className="mt-3 font-mono text-sm font-bold">{t("deptElapsedLimit", { days, limit: issue.statutory_limit_days })}</p>
                    <p className="mt-2 text-sm font-bold text-indigo">{t("deptExpandActions")}</p>
                  </summary>
                  <IssueActions blockId={blockId} issueId={issue.id} />
                  <Link href={`/issue/${issue.code}`} className="mt-4 inline-flex min-h-11 items-center font-bold text-indigo underline">{t("deptViewPublicRecord")}</Link>
                </details>
              );
            })}
            {!openIssues.length ? <p className="rounded border-2 border-dashed border-stone p-8 text-center font-bold">{t("deptQueueEmpty")}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
