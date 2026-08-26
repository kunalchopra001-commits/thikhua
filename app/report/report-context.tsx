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

export type ReportFormState = {
  step: ReportStep;
  photoSelected: boolean;
  photo: Blob | null;
  captureProvenance: CaptureProvenance | null;
  photoProcessingStatus: PhotoProcessingStatus;
  facesBlurred: number;
  school: School | null;
  description: string;
  audio: Blob | null;
  audioDurationSeconds: number;
  isRecording: boolean;
};

type ReportContextValue = {
  state: ReportFormState;
  updateState: (updates: Partial<ReportFormState>) => void;
};

const initialState: ReportFormState = {
  step: 1,
  photoSelected: false,
  photo: null,
  captureProvenance: null,
  photoProcessingStatus: "idle",
  facesBlurred: 0,
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
  const value = useMemo(
    () => ({
      state,
      updateState,
    }),
    [state, updateState],
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
