"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOpenIssuesBySchool, getReportsByIssueIds, getSchoolsByBlock } from "../../lib/db";
import type { Issue, School } from "../../lib/db";
import { t } from "../../lib/i18n";
import { processReport } from "../actions/process-report";
import { submitProcessedReport } from "../actions/submit-report";
import { useLocation } from "../location-context";
import { PhotoRedaction } from "./photo-redaction";
import { useReportForm } from "./report-context";

type ProcessedReport = Extract<Awaited<ReturnType<typeof processReport>>, { ok: true }>;
type ExistingComplaint = { issue: Issue; defect: string };

function useObjectUrl(value: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!value) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(value);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);
  return url;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function daysElapsed(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export function ReportFlow() {
  const router = useRouter();
  const { state, updateState } = useReportForm();
  const { resolvedBlockId } = useLocation();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState(false);
  const [existingComplaints, setExistingComplaints] = useState<ExistingComplaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [processedReport, setProcessedReport] = useState<ProcessedReport | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingStartedAt = useRef(0);
  const processingGeneration = useRef(0);
  const submissionIdRef = useRef<string | null>(null);
  const audioUrl = useObjectUrl(state.audio);

  useEffect(() => {
    if (!resolvedBlockId) return;
    let cancelled = false;
    setSchoolsLoading(true);
    setSchoolsError(false);
    void getSchoolsByBlock(resolvedBlockId)
      .then((blockSchools) => {
        if (cancelled) return;
        setSchools(blockSchools);
        if (state.school && !blockSchools.some((school) => school.id === state.school?.id)) updateState({ school: null, step: 1 });
      })
      .catch(() => { if (!cancelled) setSchoolsError(true); })
      .finally(() => { if (!cancelled) setSchoolsLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedBlockId, updateState]);

  useEffect(() => {
    if (!state.school) { setExistingComplaints([]); return; }
    let cancelled = false;
    setComplaintsLoading(true);
    void (async () => {
      const issues = await getOpenIssuesBySchool(state.school!.id);
      const reports = await getReportsByIssueIds(issues.map((issue) => issue.id));
      const firstReport = new Map<string, string>();
      reports.forEach((report) => {
        if (!firstReport.has(report.issue_id)) firstReport.set(report.issue_id, report.text_english_official);
      });
      if (!cancelled) setExistingComplaints(issues.map((issue) => ({ issue, defect: firstReport.get(issue.id) ?? issue.severity_reasoning })));
    })()
      .catch(() => { if (!cancelled) setExistingComplaints([]); })
      .finally(() => { if (!cancelled) setComplaintsLoading(false); });
    return () => { cancelled = true; };
  }, [state.school]);

  const photosReady = state.photos.length > 0 && state.photos.every(
    (photo) => Boolean(photo.photo) && (photo.status === "automatic" || photo.status === "manual_confirmed"),
  );
  const hasDescription = Boolean(state.description.trim()) || Boolean(state.audio);
  const processingKey = useMemo(() => [
    state.school?.id ?? "",
    state.description.trim(),
    state.audio?.size ?? 0,
    state.audioDurationSeconds,
    ...state.photos.map((photo) => `${photo.id}:${photo.status}:${photo.photo?.size ?? 0}`),
  ].join("|"), [state.audio, state.audioDurationSeconds, state.description, state.photos, state.school?.id]);

  useEffect(() => {
    const generation = ++processingGeneration.current;
    setProcessedReport(null);
    setProcessingError(null);
    if (!state.school || !hasDescription || !photosReady || state.isRecording) { setProcessing(false); return; }
    const timeout = window.setTimeout(() => {
      setProcessing(true);
      const formData = new FormData();
      formData.set("school_id", state.school!.id);
      if (state.description.trim()) formData.set("text", state.description.trim());
      if (state.audio) formData.set("audio", state.audio, "voice-note.webm");
      state.photos.forEach((photo, index) => {
        if (photo.photo) formData.append("photos", photo.photo, `redacted-${index + 1}.jpg`);
      });
      void processReport(formData).then((result) => {
        if (processingGeneration.current !== generation) return;
        setProcessing(false);
        if (result.ok) setProcessedReport(result);
        else setProcessingError(result.error);
      });
    }, state.audio ? 0 : 700);
    return () => window.clearTimeout(timeout);
  }, [hasDescription, photosReady, processingKey, state.audio, state.description, state.isRecording, state.photos, state.school]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setRecordingError(null);
    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) { setRecordingError(t("microphoneUnavailable")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAt.current = Date.now();
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        updateState({ audio: new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }), isRecording: false });
      });
      updateState({ audio: null, audioDurationSeconds: 0, isRecording: true });
      recorder.start();
      timerRef.current = window.setInterval(() => updateState({ audioDurationSeconds: Math.floor((Date.now() - recordingStartedAt.current) / 1000) }), 1000);
    } catch { setRecordingError(t("microphoneDenied")); }
  }

  function stopRecording() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    updateState({ audioDurationSeconds: Math.floor((Date.now() - recordingStartedAt.current) / 1000) });
    recorderRef.current?.stop();
  }

  async function submit() {
    if (!processedReport || !state.school || !photosReady) return;
    setSubmitting(true);
    setSubmissionError(null);
    submissionIdRef.current ??= crypto.randomUUID();
    const record = processedReport.record;
    const formData = new FormData();
    formData.set("submission_id", submissionIdRef.current);
    formData.set("processed_record", JSON.stringify({
      school_id: record.school_id, detected_language: record.detected_language,
      text_original: record.text_original, text_hindi: record.text_hindi,
      text_english_official: record.text_english_official, category: record.category,
      severity: record.severity, severity_reasoning: record.severity_reasoning,
      rte_entitlement_violated: record.rte_entitlement_violated,
      estimated_scale: record.estimated_scale, location_within_premises: record.location_within_premises,
      grievance_authority: record.grievance_authority, execution_authority: record.execution_authority,
      funding_pathway: record.funding_pathway, statutory_limit_days: record.statutory_limit_days,
    }));
    formData.set("capture_provenance", state.photos[0].captureProvenance);
    state.photos.forEach((photo, index) => { if (photo.photo) formData.append("photos", photo.photo, `redacted-${index + 1}.jpg`); });
    const result = await submitProcessedReport(formData);
    if (!result.ok) { setSubmitting(false); setSubmissionError(result.error); return; }
    router.push(`/receipt/${result.code}`);
  }

  const canReview = state.photos.length > 0 && Boolean(state.school) && hasDescription && !state.isRecording;
  const quietProgress = processing || !photosReady;

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-8 text-charcoal sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-indigo sm:text-4xl">{state.step === 1 ? t("captureTitle") : t("reviewTitle")}</h1>
          <p className="mt-2 leading-7">{state.step === 1 ? t("captureIntro") : t("reviewIntro")}</p>
        </header>
        <div className="rounded-lg border-2 border-indigo bg-sand p-4 sm:p-6">
          <PhotoRedaction />
          {state.step === 1 && (
            <div className="mt-9 space-y-9 border-t-2 border-stone pt-8">
              <section aria-labelledby="description-heading">
                <h2 id="description-heading" className="text-2xl font-bold text-indigo">{t("describeHeading")}</h2>
                <p className="mt-2 leading-6">{t("describeHelp")}</p>
                <textarea className="mt-4 min-h-32 w-full rounded-lg border-2 border-indigo bg-sand p-3 text-base text-charcoal placeholder:text-stone" value={state.description} onChange={(event) => updateState({ description: event.target.value })} placeholder={t("describePlaceholder")} />
                <div className="mt-4">
                  {state.isRecording ? (
                    <div><p className="font-bold text-rani">{t("recordingNow")}</p><p className="mt-1 font-mono text-lg">{formatDuration(state.audioDurationSeconds)}</p><button type="button" className="mt-3 min-h-12 w-full rounded-lg bg-indigo px-5 py-3 font-bold text-sand sm:w-auto" onClick={stopRecording}>{t("stopRecording")}</button></div>
                  ) : state.audio && audioUrl ? (
                    <div><audio controls src={audioUrl} aria-label={t("playRecording")} className="w-full" /><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" className="min-h-12 rounded-lg bg-indigo px-4 py-3 font-bold text-sand" onClick={() => void startRecording()}>{t("rerecord")}</button><button type="button" className="min-h-12 rounded-lg border-2 border-indigo px-4 py-3 font-bold" onClick={() => updateState({ audio: null, audioDurationSeconds: 0 })}>{t("removeRecording")}</button></div></div>
                  ) : (
                    <button type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-indigo px-5 py-3 font-bold sm:w-auto" onClick={() => void startRecording()}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>{t("startRecording")}</button>
                  )}
                  {recordingError && <p className="mt-3 text-sm" role="alert">{recordingError}</p>}
                </div>
              </section>
              <section aria-labelledby="school-heading">
                <h2 id="school-heading" className="text-2xl font-bold text-indigo">{t("schoolHeading")}</h2>
                {!resolvedBlockId && <p className="mt-4">{t("findingSchools")}</p>}
                {schoolsLoading && <p className="mt-4">{t("loadingSchools")}</p>}
                {schoolsError && <p className="mt-4" role="alert">{t("schoolLoadError")}</p>}
                {resolvedBlockId && !schoolsLoading && !schoolsError && <><label className="mt-4 block font-bold text-indigo" htmlFor="school-select">{t("schoolDropdownLabel")}<select id="school-select" className="mt-2 min-h-12 w-full rounded-lg border-2 border-indigo bg-sand px-3 py-2 text-base text-charcoal" value={state.school?.id ?? ""} onChange={(event) => updateState({ school: schools.find((school) => school.id === event.target.value) ?? null })}><option value="">{t("schoolDropdownPlaceholder")}</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name_en} — {school.name_kn}</option>)}</select></label><p className="mt-2 text-sm leading-6 text-charcoal">{t("schoolDataLimitation")} <Link href="/about" className="font-bold text-indigo underline decoration-ochre decoration-2 underline-offset-4">{t("learnMore")}</Link></p></>}
                {state.school && <div className="mt-5 border-l-4 border-ochre pl-4"><h3 className="font-bold text-indigo">{t("existingComplaintsTitle")}</h3><p className="mt-1 text-sm leading-6">{t("existingComplaintsHelp")}</p>{complaintsLoading && <p className="mt-3 text-sm">{t("existingComplaintsLoading")}</p>}{!complaintsLoading && existingComplaints.length === 0 && <p className="mt-3 text-sm">{t("existingComplaintsNone")}</p>}{!complaintsLoading && existingComplaints.length > 0 && <div className="mt-3 grid gap-3">{existingComplaints.map(({ issue, defect }) => <article key={issue.id} className="rounded-lg border border-stone p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono font-bold text-indigo">{issue.code}</span><span className="rounded-full border-2 border-ochre px-2 py-1 text-xs font-bold">{issue.severity}</span></div><p className="mt-2 text-sm leading-6">{defect}</p><p className="mt-1 text-xs font-semibold">{t("duplicateAge", { days: daysElapsed(issue.created_at) })}</p></article>)}</div>}</div>}
              </section>
            </div>
          )}
          {state.step === 2 && <div className="mt-8 space-y-7 border-t-2 border-stone pt-7"><section><h2 className="text-lg font-bold text-indigo">{t("summarySchool")}</h2><p className="mt-2 font-bold">{state.school?.name_en}</p><p lang="kn" className="mt-1">{state.school?.name_kn}</p></section><section><h2 className="text-lg font-bold text-indigo">{t("summaryDescription")}</h2><p className="mt-2 whitespace-pre-wrap">{state.description.trim() || t("voiceNoteProvided")}</p>{state.audio && audioUrl && <audio controls src={audioUrl} aria-label={t("playRecording")} className="mt-3 w-full" />}</section>{(quietProgress || processingError) && <p className="border-l-2 border-indigo pl-3 text-sm" aria-live="polite">{processingError ? t("backgroundPreparationRetry") : t("backgroundPreparation")}</p>}{submissionError && <div className="border-l-4 border-rani bg-rani/10 p-4" role="alert"><p className="font-bold">{t("submissionFailed")}</p><p className="mt-1 text-sm">{submissionError}</p></div>}</div>}
        </div>
        <div className="sticky bottom-0 mt-6 flex gap-3 border-t-2 border-indigo bg-sand py-4">{state.step === 2 && <button type="button" className="min-h-12 flex-1 rounded-lg border-2 border-indigo px-5 py-3 font-bold" onClick={() => updateState({ step: 1 })}>{t("back")}</button>}{state.step === 1 ? <button type="button" className="min-h-12 flex-1 rounded-lg bg-rani px-5 py-3 font-bold text-sand disabled:opacity-50" disabled={!canReview} onClick={() => updateState({ step: 2 })}>{t("review")}</button> : <button type="button" className="min-h-12 flex-1 rounded-lg bg-rani px-5 py-3 font-bold text-sand disabled:opacity-50" disabled={!processedReport || !photosReady || submitting} onClick={() => void submit()}>{submitting ? t("submittingQuietly") : t("submitReport")}</button>}</div>
      </div>
    </main>
  );
}
