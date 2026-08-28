"use client";

import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";

const SECOND = 1_000;
const DAY = 86_400_000;

function elapsedParts(createdAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / SECOND));
  const days = Math.floor(elapsedSeconds / 86_400);
  const hours = Math.floor((elapsedSeconds % 86_400) / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;
  return { days, hours, minutes, seconds };
}

function clockClass(days: number) {
  if (days >= 180) return "border-rani bg-rani text-sand";
  if (days >= 90) return "border-terracotta bg-terracotta text-charcoal";
  if (days >= 45) return "border-ochre bg-ochre text-charcoal";
  return "border-stone bg-sand text-charcoal";
}

export function IssueClock({ createdAt, statutoryLimitDays }: { createdAt: string; statutoryLimitDays: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setNow(Date.now()), SECOND);
    return () => window.clearInterval(interval);
  }, []);

  const elapsed = elapsedParts(createdAt, now);

  return (
    <section className={`rounded border-2 p-5 ${clockClass(elapsed.days)}`} aria-label={t("issueClockLabel")}>
      <p className="font-mono text-2xl font-black leading-tight sm:text-3xl">
        {t("issueClockStatutory", { day: elapsed.days, limit: statutoryLimitDays })}
      </p>
      <p className="mt-3 font-mono text-base font-bold tabular-nums sm:text-lg" aria-live="off">
        {t("issueClockElapsed", {
          days: elapsed.days,
          hours: String(elapsed.hours).padStart(2, "0"),
          minutes: String(elapsed.minutes).padStart(2, "0"),
          seconds: String(elapsed.seconds).padStart(2, "0"),
        })}
      </p>
    </section>
  );
}
