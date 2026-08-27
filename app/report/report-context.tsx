"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CaptureProvenance, School } from "../../lib/db";

export type ReportStep = 1 | 2 | 3 | 4;
export type PhotoProcessingStatus =
  | "idle"
  | "processing"
  | "automatic"
  | "manual_required"
  | "manual_confirmed";
export type RedactionPath = "device" | "server" | "manual" | null;

export type ReportPhoto = {
  id: string;
  photo: Blob | null;
  captureProvenance: CaptureProvenance;
  status: PhotoProcessingStatus;
  facesHidden: number;
  redactionPath: RedactionPath;
};

export type SignboardExtraction = {
  school_name: string | null;
  udise_code: string | null;
  village_or_block: string | null;
  managing_body: string | null;
  confidence: number;
};

export type SignboardPhoto = ReportPhoto & {
  extractionStatus: "idle" | "processing" | "complete";
  extraction: SignboardExtraction | null;
};

export type ReportFormState = {
  step: ReportStep;
  photos: ReportPhoto[];
  signboardPhoto: SignboardPhoto | null;
  school: School | null;
  description: string;
  audio: Blob | null;
  audioDurationSeconds: number;
  isRecording: boolean;
};

type ReportContextValue = {
  state: ReportFormState;
  updateState: (updates: Partial<ReportFormState>) => void;
  updatePhotos: (updater: (photos: ReportPhoto[]) => ReportPhoto[]) => void;
  updateSignboardPhoto: (updater: (photo: SignboardPhoto | null) => SignboardPhoto | null) => void;
};

const initialState: ReportFormState = {
  step: 1,
  photos: [],
  signboardPhoto: null,
  school: null,
  description: "",
  audio: null,
  audioDurationSeconds: 0,
  isRecording: false,
};

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const updateState = useCallback((updates: Partial<ReportFormState>) => {
    setState((current) => ({ ...current, ...updates }));
  }, []);
  const updatePhotos = useCallback((updater: (photos: ReportPhoto[]) => ReportPhoto[]) => {
    setState((current) => ({ ...current, photos: updater(current.photos) }));
  }, []);
  const updateSignboardPhoto = useCallback(
    (updater: (photo: SignboardPhoto | null) => SignboardPhoto | null) => {
      setState((current) => ({ ...current, signboardPhoto: updater(current.signboardPhoto) }));
    },
    [],
  );
  const value = useMemo(
    () => ({
      state,
      updateState,
      updatePhotos,
      updateSignboardPhoto,
    }),
    [state, updatePhotos, updateSignboardPhoto, updateState],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReportForm() {
  const value = useContext(ReportContext);

  if (!value) {
    throw new Error("useReportForm must be used within ReportProvider");
  }

  return value;
}
