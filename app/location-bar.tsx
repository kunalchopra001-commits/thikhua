"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BlockCentroid } from "../data/seed";
import { getIssuesByBlock, getSchoolsByBlock } from "../lib/db";
import { t } from "../lib/i18n";
import type { Language } from "../lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { useLocation } from "./location-context";

function nearestBlock(blocks: readonly BlockCentroid[], latitude: number, longitude: number) {
  return blocks.reduce((nearest, block) => {
    const nearestDistance = (nearest.lat - latitude) ** 2 + (nearest.lng - longitude) ** 2;
    const distance = (block.lat - latitude) ** 2 + (block.lng - longitude) ** 2;
    return distance < nearestDistance ? block : nearest;
  });
}

export function LocationBar({ blocks, language }: { blocks: readonly BlockCentroid[]; language: Language }) {
  const { coordinates, setCoordinates, resolvedBlockId, setResolvedBlockId } = useLocation();
  const pathname = usePathname();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [resolutionFinished, setResolutionFinished] = useState(Boolean(resolvedBlockId));
  const [scopeCounts, setScopeCounts] = useState<{ schools: number; issues: number } | null>(null);
  const selectedBlock = blocks.find((block) => block.block_id === resolvedBlockId) ?? null;
  const departmentBlockId = pathname.match(/^\/dept\/([^/]+)/)?.[1] ?? null;

  useEffect(() => {
    if (departmentBlockId && blocks.some((block) => block.block_id === departmentBlockId)) {
      setResolvedBlockId(departmentBlockId);
      setResolutionFinished(true);
    }
  }, [blocks, departmentBlockId, setResolvedBlockId]);

  useEffect(() => {
    if (resolvedBlockId) {
      setResolutionFinished(true);
      return;
    }
    if (coordinates) {
      setResolvedBlockId(nearestBlock(blocks, coordinates.latitude, coordinates.longitude).block_id);
      setResolutionFinished(true);
      return;
    }
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setResolutionFinished(true);
        setShowPicker(true);
      }
    }, 8000);
    if (!("geolocation" in navigator)) {
      window.clearTimeout(timeout);
      setResolutionFinished(true);
      setShowPicker(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setResolvedBlockId(nearestBlock(blocks, coords.latitude, coords.longitude).block_id);
        setResolutionFinished(true);
      },
      () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          setResolutionFinished(true);
          setShowPicker(true);
        }
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );
    return () => window.clearTimeout(timeout);
  }, [blocks, coordinates, resolvedBlockId, setCoordinates, setResolvedBlockId]);

  useEffect(() => {
    if (!resolvedBlockId) {
      setScopeCounts(null);
      return;
    }
    let cancelled = false;
    setScopeCounts(null);
    void Promise.all([getSchoolsByBlock(resolvedBlockId), getIssuesByBlock(resolvedBlockId)])
      .then(([schools, issues]) => {
        if (!cancelled) {
          setScopeCounts({
            schools: schools.length,
            issues: issues.filter((issue) => issue.status !== "resolved").length,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setScopeCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedBlockId]);

  function chooseBlock(blockId: string) {
    setResolvedBlockId(blockId);
    setShowPicker(false);
    setResolutionFinished(true);
    if (departmentBlockId) router.push(`/dept/${blockId}`);
  }

  return (
    <section aria-label={t("locationBarLabel")} className="border-b border-stone bg-sand px-3 py-2 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        {!showPicker && selectedBlock ? (
          <>
            <p className="min-w-0 flex-1 truncate text-xs font-bold text-indigo sm:text-sm">
              {scopeCounts
                ? t("blockScopeSummary", {
                    block: selectedBlock.block_name,
                    schools: scopeCounts.schools,
                    issues: scopeCounts.issues,
                  })
                : t("blockScopeLoading", { block: selectedBlock.block_name })}
            </p>
            <button type="button" onClick={() => setShowPicker(true)} className="min-h-10 shrink-0 rounded-lg px-1.5 text-xs font-bold text-indigo underline decoration-ochre decoration-2 underline-offset-4">
              {t("changeBlockShort")}
            </button>
          </>
        ) : (
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("chooseBlock")}</span>
            <select className="min-h-10 w-full rounded-lg border border-indigo bg-sand px-2 py-1 text-xs font-bold text-charcoal sm:text-sm" value={resolvedBlockId ?? ""} onChange={(event) => chooseBlock(event.target.value)}>
              <option value="" disabled>{resolutionFinished ? t("chooseBlock") : t("locating")}</option>
              {blocks.map((block) => <option key={block.block_id} value={block.block_id}>{block.block_name} — {block.district}</option>)}
            </select>
          </label>
        )}
        <LanguageSwitcher language={language} />
      </div>
    </section>
  );
}
