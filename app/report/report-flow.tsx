"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "../location-context";
import { supabase } from "../../lib/db";
import type { School } from "../../lib/db";
import { t } from "../../lib/i18n";
import { useReportForm } from "./report-context";
import type { ReportStep } from "./report-context";
import { PhotoRedaction } from "./photo-redaction";

const stepNames = [t("stepPhoto"), t("stepSchool"), t("stepDescribe")];

function useObjectUrl(value: Blob | File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);

  return url;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function distanceSquared(school: School, latitude: number, longitude: number) {
  return (school.lat - latitude) ** 2 + (school.lng - longitude) ** 2;
}

function normalizeSchoolText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\bgovt\.?\b/gu, "government")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshtein(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function nameSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeSchoolText(left);
  const normalizedRight = normalizeSchoolText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  return 1 - levenshtein(normalizedLeft, normalizedRight) / Math.max(normalizedLeft.length, normalizedRight.length);
}

export function ReportFlow() {
  const { state, updateState } = useReportForm();
  const { coordinates, setCoordinates } = useLocation();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState(false);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingStartedAt = useRef(0);
  const mountedRef = useRef(true);
  const audioUrl = useObjectUrl(state.audio);

  useEffect(() => {
    let cancelled = false;

    async function loadSchools() {
      const { data, error } = await supabase.from("schools").select("*").order("name_en");

      if (cancelled) {
        return;
      }

      if (error) {
        setSchoolsError(true);
      } else {
        setSchools(data);
      }
      setSchoolsLoading(false);
    }

    void loadSchools();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (coordinates) {
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationUnavailable(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
      },
      () => setLocationUnavailable(true),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );
  }, [coordinates, setCoordinates]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const nearestSchools = useMemo(() => {
    if (!coordinates) {
      return [];
    }

    return [...schools]
      .sort(
        (left, right) =>
          distanceSquared(left, coordinates.latitude, coordinates.longitude) -
          distanceSquared(right, coordinates.latitude, coordinates.longitude),
      )
      .slice(0, 5);
  }, [coordinates, schools]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) {
      return coordinates ? [] : schools;
    }

    return schools.filter((school) =>
      [school.name_en, school.name_kn, school.block_name]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [coordinates, schools, search]);

  const signboardSuggestion = useMemo(() => {
    const extraction = state.signboardPhoto?.extraction;
    if (!extraction) return null;
    const udise = extraction.udise_code ? normalizeSchoolText(extraction.udise_code) : "";
    if (udise) {
      const exact = schools.find((school) => normalizeSchoolText(school.udise_code) === udise);
      if (exact) return exact;
    }
    if (!extraction.school_name) return null;
    const ranked = schools
      .map((school) => ({
        school,
        score: Math.max(
          nameSimilarity(extraction.school_name ?? "", school.name_en),
          nameSimilarity(extraction.school_name ?? "", school.name_kn),
        ),
      }))
      .sort((left, right) => right.score - left.score);
    return ranked[0]?.score >= 0.45 ? ranked[0].school : null;
  }, [schools, state.signboardPhoto?.extraction]);

  async function startRecording() {
    setRecordingError(null);

    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError(t("microphoneUnavailable"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAt.current = Date.now();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;

        if (mountedRef.current) {
          updateState({
            audio: new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }),
            isRecording: false,
          });
        }
      });

      updateState({ audio: null, audioDurationSeconds: 0, isRecording: true });
      recorder.start();
      timerRef.current = window.setInterval(() => {
        updateState({
          audioDurationSeconds: Math.floor((Date.now() - recordingStartedAt.current) / 1000),
        });
      }, 1000);
    } catch {
      setRecordingError(t("microphoneDenied"));
      updateState({ isRecording: false });
    }
  }

  function stopRecording() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    updateState({
      audioDurationSeconds: Math.floor((Date.now() - recordingStartedAt.current) / 1000),
    });
    recorderRef.current?.stop();
  }

  const currentStepForProgress = Math.min(state.step, 3);
  const canContinue =
    (state.step === 1 && state.photos.length > 0) ||
    (state.step === 2 && Boolean(state.school)) ||
    (state.step === 3 &&
      !state.isRecording &&
      (Boolean(state.description.trim()) || Boolean(state.audio)));

  function goBack() {
    updateState({ step: (state.step === 4 ? 3 : Math.max(1, state.step - 1)) as ReportStep });
  }

  function goNext() {
    if (canContinue && state.step < 4) {
      updateState({ step: (state.step + 1) as ReportStep });
    }
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-8 text-charcoal sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo sm:text-4xl">
            {state.step === 4 ? t("summaryTitle") : t("reportTitle")}
          </h1>
          <p className="mt-2 leading-6">
            {state.step === 4 ? t("summaryIntro") : t("reportIntro")}
          </p>
        </header>

        <ol
          className="mb-8 grid grid-cols-3 gap-2"
          aria-label={t("stepProgress", {
            current: currentStepForProgress,
            name: stepNames[currentStepForProgress - 1],
          })}
        >
          {stepNames.map((name, index) => {
            const step = index + 1;
            const isCurrent = state.step === step;
            const isComplete = state.step > step;
            return (
              <li key={name} className="min-w-0 text-center">
                <div
                  className={`mx-auto flex size-9 items-center justify-center rounded-full border-2 font-bold ${
                    isCurrent || isComplete
                      ? "border-indigo bg-indigo text-sand"
                      : "border-stone bg-sand text-charcoal"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {step}
                </div>
                <span className="mt-1 block truncate text-xs font-semibold sm:text-sm">{name}</span>
              </li>
            );
          })}
        </ol>

        <div className="rounded border-2 border-indigo bg-sand p-4 sm:p-6">
          <PhotoRedaction />

          {state.step === 2 && (
            <section aria-labelledby="school-heading">
              <h2 id="school-heading" className="text-2xl font-bold text-indigo">
                {t("schoolHeading")}
              </h2>
              <p className="mt-2 leading-6">{t("schoolHelp")}</p>

              {schoolsLoading && <p className="mt-6">{t("loadingSchools")}</p>}
              {schoolsError && <p className="mt-6" role="alert">{t("schoolLoadError")}</p>}

              {!schoolsLoading && !schoolsError && signboardSuggestion && (
                <div className="mt-6 border-l-4 border-rani bg-rani/10 p-3">
                  <p className="mb-2 font-bold">{t("signboardSuggestion")}</p>
                  <SchoolCard
                    school={signboardSuggestion}
                    selected={state.school?.id === signboardSuggestion.id}
                    suggested
                    onSelect={() => updateState({ school: signboardSuggestion })}
                  />
                  <p className="mt-2 text-sm">
                    {t("signboardReadText", {
                      text: [
                        state.signboardPhoto?.extraction?.school_name,
                        state.signboardPhoto?.extraction?.udise_code,
                        state.signboardPhoto?.extraction?.village_or_block,
                        state.signboardPhoto?.extraction?.managing_body,
                      ].filter(Boolean).join(" · "),
                    })}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("signboardConfidence", {
                      confidence: Math.round(
                        (state.signboardPhoto?.extraction?.confidence ?? 0) * 100,
                      ),
                    })}
                  </p>
                </div>
              )}

              {!schoolsLoading && !schoolsError && coordinates && (
                <div className="mt-6">
                  <h3 className="font-bold text-indigo">{t("nearestSchools")}</h3>
                  <div className="mt-3 grid gap-3">
                    {nearestSchools.map((school) => (
                      <SchoolCard
                        key={school.id}
                        school={school}
                        selected={state.school?.id === school.id}
                        onSelect={() => updateState({ school })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!coordinates && locationUnavailable && (
                <p className="mt-6 border-l-4 border-ochre bg-ochre/10 p-3">
                  {t("locationUnavailable")}
                </p>
              )}
              {!coordinates && !locationUnavailable && !schoolsLoading && (
                <p className="mt-6">{t("findingSchools")}</p>
              )}

              {!schoolsLoading && !schoolsError && (
                <div className="mt-8">
                  <label className="block font-bold text-indigo" htmlFor="school-search">
                    {t("schoolSearch")}
                  </label>
                  <input
                    id="school-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("schoolSearchPlaceholder")}
                    className="mt-2 min-h-12 w-full rounded border-2 border-indigo bg-sand px-3 py-2 text-base text-charcoal placeholder:text-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                  />

                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-bold text-indigo">{t("schoolSearchResults")}</h3>
                      <div className="mt-3 grid gap-3">
                        {searchResults.map((school) => (
                          <SchoolCard
                            key={school.id}
                            school={school}
                            selected={state.school?.id === school.id}
                            onSelect={() => updateState({ school })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {search.trim() && searchResults.length === 0 && (
                    <p className="mt-4">{t("noSchoolMatches")}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {state.step === 3 && (
            <section aria-labelledby="describe-heading">
              <h2 id="describe-heading" className="text-2xl font-bold text-indigo">
                {t("describeHeading")}
              </h2>
              <p className="mt-2 leading-6">{t("describeHelp")}</p>

              <textarea
                className="mt-6 min-h-40 w-full rounded border-2 border-indigo bg-sand p-3 text-base text-charcoal placeholder:text-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
                value={state.description}
                onChange={(event) => updateState({ description: event.target.value })}
                placeholder={t("describePlaceholder")}
              />

              <div className="mt-6 border-t-2 border-stone pt-6">
                <h3 className="font-bold text-indigo">{t("voiceRecording")}</h3>
                {state.isRecording ? (
                  <div className="mt-3">
                    <p className="font-bold text-rani">{t("recordingNow")}</p>
                    <p className="mt-1 font-mono text-lg">
                      {t("recordingDuration", {
                        duration: formatDuration(state.audioDurationSeconds),
                      })}
                    </p>
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded bg-indigo px-5 py-3 font-bold text-sand sm:w-auto"
                      onClick={stopRecording}
                    >
                      <span className="size-3 bg-sand" aria-hidden="true" />
                      {t("stopRecording")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    {state.audio && audioUrl ? (
                      <>
                        <p className="font-semibold">
                          {t("recordedDuration", {
                            duration: formatDuration(state.audioDurationSeconds),
                          })}
                        </p>
                        <audio
                          controls
                          src={audioUrl}
                          aria-label={t("playRecording")}
                          className="mt-3 w-full"
                        />
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            className="min-h-12 rounded bg-indigo px-4 py-3 font-bold text-sand"
                            onClick={() => void startRecording()}
                          >
                            {t("rerecord")}
                          </button>
                          <button
                            type="button"
                            className="min-h-12 rounded border-2 border-indigo px-4 py-3 font-bold"
                            onClick={() => updateState({ audio: null, audioDurationSeconds: 0 })}
                          >
                            {t("removeRecording")}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded bg-indigo px-5 py-3 font-bold text-sand sm:w-auto"
                        onClick={() => void startRecording()}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5 fill-none stroke-current"
                          strokeWidth="2"
                        >
                          <rect x="9" y="3" width="6" height="11" rx="3" />
                          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
                        </svg>
                        {t("startRecording")}
                      </button>
                    )}
                  </div>
                )}
                {recordingError && <p className="mt-3" role="alert">{recordingError}</p>}
              </div>
            </section>
          )}

          {state.step === 4 && (
            <section className="space-y-6">
              <SummarySection title={t("summarySchool")} editLabel={t("editSchool")} onEdit={() => updateState({ step: 2 })}>
                {state.school && (
                  <div>
                    <p className="font-bold">{state.school.name_en}</p>
                    <p lang="kn" className="mt-1">{state.school.name_kn}</p>
                    <p className="mt-1 text-sm">{state.school.block_name}</p>
                  </div>
                )}
              </SummarySection>
              <SummarySection title={t("summaryDescription")} editLabel={t("editDescription")} onEdit={() => updateState({ step: 3 })}>
                <p className="whitespace-pre-wrap">
                  {state.description.trim() || t("noWrittenDescription")}
                </p>
              </SummarySection>
              <div>
                <h2 className="text-lg font-bold text-indigo">{t("summaryVoice")}</h2>
                {state.audio && audioUrl ? (
                  <audio
                    controls
                    src={audioUrl}
                    aria-label={t("playRecording")}
                    className="mt-3 w-full"
                  />
                ) : (
                  <p className="mt-2">{t("noVoiceRecording")}</p>
                )}
              </div>
            </section>
          )}
        </div>

        <nav className="sticky bottom-0 mt-6 flex gap-3 border-t-2 border-indigo bg-sand py-4" aria-label={t("reportTitle")}>
          {state.step > 1 && (
            <button
              type="button"
              className="min-h-12 flex-1 rounded border-2 border-indigo px-5 py-3 font-bold"
              onClick={goBack}
            >
              {t("back")}
            </button>
          )}
          {state.step < 4 && (
            <button
              type="button"
              className="min-h-12 flex-1 rounded bg-indigo px-5 py-3 font-bold text-sand disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canContinue}
              onClick={goNext}
            >
              {state.step === 3 ? t("review") : t("next")}
            </button>
          )}
          {state.step === 4 && (
            <button
              type="button"
              className="min-h-12 flex-1 rounded bg-rani px-5 py-3 font-bold text-sand disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !state.photos.every(
                  (photo) => photo.status === "automatic" || photo.status === "manual_confirmed",
                ) ||
                Boolean(
                  state.signboardPhoto &&
                    state.signboardPhoto.status !== "automatic" &&
                    state.signboardPhoto.status !== "manual_confirmed",
                )
              }
            >
              {state.photos.some((photo) => photo.status === "processing") ||
              state.signboardPhoto?.status === "processing"
                ? t("processingPhoto")
                : t("submitReport")}
            </button>
          )}
        </nav>
      </div>
    </main>
  );
}

function SchoolCard({
  school,
  selected,
  onSelect,
  suggested = false,
}: {
  school: School;
  selected: boolean;
  onSelect: () => void;
  suggested?: boolean;
}) {
  return (
    <button
      type="button"
      className={`min-h-24 rounded border-2 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo ${
        selected
          ? "border-indigo bg-indigo text-sand"
          : suggested
            ? "border-rani bg-sand text-charcoal"
            : "border-stone bg-sand text-charcoal"
      }`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="block font-bold">{school.name_en}</span>
      <span lang="kn" className="mt-1 block">{school.name_kn}</span>
      <span className="mt-2 block text-sm">{school.block_name}</span>
      {selected && <span className="mt-2 block text-sm font-bold">{t("selectedSchool")}</span>}
    </button>
  );
}

function SummarySection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-indigo">{title}</h2>
        <button
          type="button"
          className="min-h-11 rounded border-2 border-indigo px-3 py-2 text-sm font-bold"
          onClick={onEdit}
        >
          {editLabel}
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
