"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

function nearestBlock(blocks: readonly BlockCentroid[], latitude: number, longitude: number) {
  return blocks.reduce((nearest, block) => {
    const nearestDistance =
      (nearest.lat - latitude) ** 2 + (nearest.lng - longitude) ** 2;
    const blockDistance = (block.lat - latitude) ** 2 + (block.lng - longitude) ** 2;
    return blockDistance < nearestDistance ? block : nearest;
  });
}

function daysElapsed(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

export function HomeView({ blocks }: HomeViewProps) {
  const { setCoordinates } = useLocation();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [issues, setIssues] = useState<HomeIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const manuallySelected = useRef(false);

  useEffect(() => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setShowPicker(true);
      }
    }, 8000);

    if (!("geolocation" in navigator)) {
      window.clearTimeout(timeout);
      setShowPicker(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (settled || manuallySelected.current) {
          return;
        }

        settled = true;
        window.clearTimeout(timeout);
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setSelectedBlockId(nearestBlock(blocks, coords.latitude, coords.longitude).block_id);
      },
      () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          setShowPicker(true);
        }
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );

    return () => window.clearTimeout(timeout);
  }, [blocks, setCoordinates]);

  useEffect(() => {
    if (!selectedBlockId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    async function loadBlock() {
      try {
        const [blockSchools, blockIssues] = await Promise.all([
          getSchoolsByBlock(selectedBlockId as string),
          getIssuesByBlock(selectedBlockId as string),
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
  }, [selectedBlockId]);

  const selectedBlock = blocks.find((block) => block.block_id === selectedBlockId) ?? null;
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

  function selectBlock(blockId: string) {
    manuallySelected.current = true;
    setSelectedBlockId(blockId);
    setShowPicker(true);
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-8 text-charcoal sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {selectedBlock ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-indigo sm:text-4xl">
                  {selectedBlock.block_name}
                </h1>
                <p className="mt-2 text-base">
                  {t("schoolsAndEnrollment", {
                    schools: schools.length,
                    enrolment: totalEnrolment.toLocaleString("en-IN"),
                  })}
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-indigo">
                {showPicker ? t("chooseBlock") : t("locating")}
              </p>
            )}
          </div>

          <label className="flex w-full flex-col gap-1 text-sm font-semibold sm:w-64">
            <span>{selectedBlock ? t("changeBlock") : t("chooseBlock")}</span>
            <select
              className="min-h-11 rounded border-2 border-indigo bg-sand px-3 py-2 text-base text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              value={selectedBlockId ?? ""}
              onChange={(event) => selectBlock(event.target.value)}
            >
              <option value="" disabled>
                {t("chooseBlock")}
              </option>
              {blocks.map((block) => (
                <option key={block.block_id} value={block.block_id}>
                  {block.block_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedBlock && (
          <>
            <section aria-labelledby="severity-summary" className="mb-10">
              <h2 id="severity-summary" className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo">
                {t("severitySummary")}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {(Object.keys(severityCounts) as Severity[]).map((severity) => (
                  <span
                    key={severity}
                    className={`rounded-full border-2 px-3 py-2 text-center text-sm font-bold ${severityClasses[severity]}`}
                  >
                    {t("severityCount", { severity, count: severityCounts[severity] })}
                  </span>
                ))}
              </div>
            </section>

            <div className="mb-8 flex flex-col gap-4 rounded border-2 border-rani bg-rani/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold">{t("homeReportPrompt")}</p>
              <Link
                href="/report"
                className="flex min-h-12 shrink-0 items-center justify-center rounded border-2 border-rani bg-sand px-5 py-3 font-bold text-charcoal ring-2 ring-inset ring-rani focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
              >
                {t("startReport")}
              </Link>
            </div>

            <section aria-labelledby="open-issues">
              <h2 id="open-issues" className="mb-4 text-2xl font-bold text-indigo">
                {t("openIssues")}
              </h2>

              {isLoading && <p>{t("loadingIssues")}</p>}
              {hasError && <p role="alert">{t("loadError")}</p>}

              {!isLoading && !hasError && issues.length === 0 && (
                <div className="rounded border-2 border-dashed border-ochre bg-ochre/10 p-8 text-center">
                  <p className="text-lg font-semibold">{t("emptyBlock")}</p>
                  <Link
                    href="/report"
                    className="mt-5 inline-flex min-h-11 items-center rounded bg-indigo px-5 py-3 font-bold text-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
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
                        className={`group rounded border-2 bg-sand p-5 text-charcoal transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo motion-reduce:transition-none ${
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
            </section>
          </>
        )}
      </div>
    </main>
  );
}
