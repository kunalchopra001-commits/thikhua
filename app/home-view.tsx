"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BlockCentroid } from "../data/seed";
import { getIssuesByBlock, getSchoolsByBlock, supabase } from "../lib/db";
import type { Issue, Report, School, Severity } from "../lib/db";
import { t } from "../lib/i18n";
import { useLocation } from "./location-context";

type HomeViewProps = {
  blocks: readonly BlockCentroid[];
};

type HomeIssue = Issue & {
  schoolName: string;
  defect: string;
};

const severityOrder: Record<Severity, number> = {
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4,
};

const severityClasses: Record<Severity, string> = {
  S1: "border-rani bg-rani/10",
  S2: "border-terracotta bg-terracotta/10",
  S3: "border-ochre bg-ochre/15",
  S4: "border-ochre bg-sand",
};

function daysElapsed(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

export function HomeView({ blocks }: HomeViewProps) {
  const { resolvedBlockId } = useLocation();
  const [schools, setSchools] = useState<School[]>([]);
  const [issues, setIssues] = useState<HomeIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    if (!resolvedBlockId) {
      return;
    }
    const blockId = resolvedBlockId;

    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    async function loadBlock() {
      try {
        const [blockSchools, blockIssues] = await Promise.all([
          getSchoolsByBlock(blockId),
          getIssuesByBlock(blockId),
        ]);
        const openIssues = blockIssues.filter((issue) => issue.status !== "resolved");
        let reports: Report[] = [];

        if (openIssues.length > 0) {
          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .in(
              "issue_id",
              openIssues.map((issue) => issue.id),
            )
            .order("created_at");

          if (error) {
            throw new Error(error.message);
          }

          reports = data;
        }

        if (cancelled) {
          return;
        }

        const schoolsById = new Map(blockSchools.map((school) => [school.id, school.name_en]));
        const reportsByIssue = new Map<string, Report>();
        reports.forEach((report) => {
          if (!reportsByIssue.has(report.issue_id)) {
            reportsByIssue.set(report.issue_id, report);
          }
        });

        setSchools(blockSchools);
        setIssues(
          openIssues
            .map((issue) => ({
              ...issue,
              schoolName: schoolsById.get(issue.school_id) ?? "",
              defect: reportsByIssue.get(issue.id)?.text_english_official ?? issue.severity_reasoning,
            }))
            .sort(
              (left, right) =>
                severityOrder[left.severity] - severityOrder[right.severity] ||
                new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
            ),
        );
      } catch {
        if (!cancelled) {
          setSchools([]);
          setIssues([]);
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBlock();

    return () => {
      cancelled = true;
    };
  }, [resolvedBlockId]);

  const selectedBlock = blocks.find((block) => block.block_id === resolvedBlockId) ?? null;
  const totalEnrolment = schools.reduce((total, school) => total + school.enrolment, 0);
  const severityCounts = useMemo(
    () =>
      ({
        S1: issues.filter((issue) => issue.severity === "S1").length,
        S2: issues.filter((issue) => issue.severity === "S2").length,
        S3: issues.filter((issue) => issue.severity === "S3").length,
        S4: issues.filter((issue) => issue.severity === "S4").length,
      }) satisfies Record<Severity, number>,
    [issues],
  );

  return (
    <main data-home-page className="min-h-[calc(100vh-8rem)] bg-sand text-charcoal">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-7 sm:px-6 sm:pb-20 sm:pt-12">
        <section aria-labelledby="welcome-heading" className="max-w-3xl py-2 sm:py-4">
          <h1 id="welcome-heading" className="max-w-3xl text-3xl font-black leading-[1.18] tracking-tight text-indigo sm:text-5xl sm:leading-[1.15]">
            {t("homeWelcomeTitle")}
          </h1>
          <div className="mt-6 max-w-2xl space-y-4 text-base leading-8 sm:mt-8 sm:text-lg sm:leading-9">
            <p>{t("homeWelcomeBodyOne")}</p>
            <p>{t("homeWelcomeBodyTwo")}</p>
            <p>{t("homeWelcomeBodyThree")}</p>
          </div>
          <p className="mt-9 text-xl font-bold text-indigo sm:mt-12 sm:text-2xl">{t("homeWelcomeSignoff")}</p>
        </section>

        <Link
          href="/report"
          className="mt-9 flex min-h-14 w-full max-w-md items-center justify-center rounded-lg bg-rani px-6 py-4 text-center text-lg font-black text-sand shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rani sm:mt-12 sm:text-xl"
        >
          {t("homePrimaryAction")}
        </Link>

        {selectedBlock && (
          <section aria-labelledby="open-issues" className="mt-16 border-t-2 border-indigo pt-7 sm:mt-24 sm:pt-9">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-terracotta">{t("localLedger")}</p>
                  <h2 id="open-issues" className="mt-2 text-2xl font-black leading-tight text-indigo sm:text-3xl">
                    {t("ledgerSummary", { schools: schools.length, issues: issues.length })}
                  </h2>
                  <p className="mt-2 text-sm">{t("enrolmentInBlock", { enrolment: totalEnrolment.toLocaleString("en-IN") })}</p>
                </div>
                <div aria-label={t("severitySummary")} className="flex flex-wrap gap-2">
                  {(Object.keys(severityCounts) as Severity[]).map((severity) => (
                    <span key={severity} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${severityClasses[severity]}`}>
                      {t("severityCount", { severity, count: severityCounts[severity] })}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-7 sm:mt-9">

              {isLoading && <p>{t("loadingIssues")}</p>}
              {hasError && <p role="alert">{t("loadError")}</p>}

              {!isLoading && !hasError && issues.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-ochre bg-ochre/10 p-8 text-center">
                  <p className="text-lg font-semibold">{t("emptyBlock")}</p>
                  <Link
                    href="/report"
                    className="mt-5 inline-flex min-h-11 items-center rounded-lg border-2 border-rani px-5 py-3 font-bold text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rani"
                  >
                    {t("reportIssue")}
                  </Link>
                </div>
              )}

              {!isLoading && !hasError && issues.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {issues.map((issue) => {
                    const isUnfunded = issue.status === "unfunded";

                    return (
                      <Link
                        key={issue.id}
                        href={`/issue/${issue.code}`}
                        aria-label={t("viewIssue", { school: issue.schoolName })}
                        className={`group rounded-lg border-2 bg-sand p-5 text-charcoal transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo motion-reduce:transition-none ${
                          isUnfunded ? "border-rani ring-2 ring-inset ring-rani" : "border-stone"
                        }`}
                      >
                        {isUnfunded && (
                          <div className="mb-4 border-l-4 border-rani bg-rani/10 p-3">
                            <p className="font-bold">{t("unfunded")}</p>
                            <p className="mt-1 text-sm">{t("unfundedExplanation")}</p>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-indigo group-hover:underline">
                            {issue.schoolName}
                          </h3>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="rounded-full border border-stone px-2 py-1 text-xs font-bold text-charcoal">
                              {t("inProgressMarker")}
                            </span>
                            <span
                              className={`rounded-full border-2 px-2.5 py-1 text-xs font-bold ${severityClasses[issue.severity]}`}
                            >
                              {issue.severity}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 leading-6">{issue.defect}</p>
                        <p className="mt-4 text-sm font-semibold">
                          {t("daysElapsed", { days: daysElapsed(issue.created_at) })}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
              </div>
            </section>
        )}
      </div>
    </main>
  );
}
