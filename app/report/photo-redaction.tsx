"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CaptureProvenance } from "../../lib/db";
import { detectFacesOnDevice, isFaceDetectorReady, warmFaceDetector } from "../../lib/face-detector-client";
import type { FaceBox } from "../../lib/face-detector-client";
import { t } from "../../lib/i18n";
import { extractSchoolSignboard } from "./extract-signboard-action";
import { redactPhotoOnServer } from "./redact-photo-action";
import { useReportForm } from "./report-context";
import type { PhotoFailureReason, RedactionPath, ReportPhoto, SignboardPhoto } from "./report-context";

type Point = { x: number; y: number };
type RedactionResult = { photo: Blob; facesHidden: number; redactionPath: RedactionPath };
const MAX_IMAGE_EDGE = 1600;
const MAX_DEFECT_PHOTOS = 5;

class PhotoProcessingError extends Error {
  readonly reason: PhotoFailureReason;

  constructor(reason: PhotoFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

function isFailureStatus(status: ReportPhoto["status"]): status is PhotoFailureReason {
  return [
    "decode_failed",
    "mediapipe_unavailable",
    "server_rejected_size",
    "network_error",
    "request_timeout",
    "model_error",
    "model_returned_oversized_box",
  ].includes(status);
}

function failureText(reason: PhotoFailureReason) {
  const keys = {
    decode_failed: "photoFailureDecode",
    mediapipe_unavailable: "photoFailureMediaPipe",
    server_rejected_size: "photoFailureServerSize",
    network_error: "photoFailureNetwork",
    request_timeout: "photoFailureTimeout",
    model_error: "photoFailureModel",
    model_returned_oversized_box: "photoFailureOversizedBox",
  } as const;
  return t(keys[reason]);
}

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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Canvas rasterisation failed")),
    "image/jpeg", 0.9,
  ));
}

function copyCanvas(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width; copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  return copy;
}

function pixelateRegion(canvas: HTMLCanvasElement, box: FaceBox, expand = true) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const paddingX = expand ? box.width * 0.16 : 0;
  const paddingY = expand ? box.height * 0.2 : 0;
  const x = Math.max(0, Math.floor(box.originX - paddingX));
  const y = Math.max(0, Math.floor(box.originY - paddingY));
  const width = Math.min(canvas.width - x, Math.ceil(box.width + paddingX * 2));
  const height = Math.min(canvas.height - y, Math.ceil(box.height + paddingY * 2));
  if (width < 1 || height < 1) return;
  const pixels = document.createElement("canvas");
  pixels.width = Math.max(1, Math.floor(width / 18));
  pixels.height = Math.max(1, Math.floor(height / 18));
  const pixelContext = pixels.getContext("2d");
  if (!pixelContext) throw new Error("Pixelation canvas is unavailable");
  pixelContext.drawImage(canvas, x, y, width, height, 0, 0, pixels.width, pixels.height);
  context.save(); context.imageSmoothingEnabled = false;
  context.drawImage(pixels, 0, 0, pixels.width, pixels.height, x, y, width, height);
  context.restore();
}

function base64ToBlob(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: "image/jpeg" });
}

async function rasterise(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function redactCanvas(source: HTMLCanvasElement): Promise<RedactionResult> {
  if (isFaceDetectorReady()) {
    try {
      const boxes = await detectFacesOnDevice(await createImageBitmap(source));
      const processed = copyCanvas(source);
      boxes.forEach((box) => pixelateRegion(processed, box));
      return { photo: await canvasToBlob(processed), facesHidden: boxes.length, redactionPath: "device" };
    } catch (error) {
      console.warn("[photo redaction] mediapipe_unavailable", error);
    }
  } else {
    console.warn("[photo redaction] mediapipe_unavailable: detector is not ready");
  }
  const formData = new FormData();
  formData.append("image", await canvasToBlob(source), "report-photo.jpg");
  let result: Awaited<ReturnType<typeof redactPhotoOnServer>>;
  try {
    result = await redactPhotoOnServer(formData);
  } catch (error) {
    throw new PhotoProcessingError(
      "model_error",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!result.ok) {
    throw new PhotoProcessingError(result.failureReason, result.errorMessage);
  }
  return { photo: base64ToBlob(result.imageBase64), facesHidden: result.facesHidden, redactionPath: "server" };
}

function statusText(photo: ReportPhoto) {
  if (photo.status === "processing") return t("photoStatusProcessing");
  if (isFailureStatus(photo.status)) return t("photoStatusManual");
  if (photo.status === "manual_confirmed") return t("photoStatusManualComplete");
  return photo.facesHidden === 0 ? t("noFacesFound") : t("facesBlurred", { count: photo.facesHidden });
}

export function PhotoRedaction() {
  const { state, updateState, updatePhotos, updateSignboardPhoto } = useReportForm();
  const [previews, setPreviews] = useState<Record<string, Blob>>({});
  const sourcesRef = useRef(new Map<string, HTMLCanvasElement>());
  useEffect(() => warmFaceDetector(), []);

  function patchPhoto(id: string, updates: Partial<ReportPhoto>) {
    updatePhotos((photos) => photos.map((photo) => photo.id === id ? { ...photo, ...updates } : photo));
  }
  function patchSignboard(updates: Partial<SignboardPhoto>, id?: string) {
    updateSignboardPhoto((photo) => photo && (!id || photo.id === id) ? { ...photo, ...updates } : photo);
  }
  async function extractSignboard(photo: Blob, id: string) {
    patchSignboard({ extractionStatus: "processing", extractionFailureReason: null }, id);
    try {
      const formData = new FormData();
      formData.append("image", photo, "school-signboard.jpg");
      const result = await extractSchoolSignboard(formData);
      console.info("[signboard extraction] raw model response", result.rawResponses);
      if (!result.ok) {
        console.error("[signboard extraction] failed", result.failureReason, result.errorMessage);
        patchSignboard({
          extraction: null,
          extractionStatus: "complete",
          extractionFailureReason: `${result.failureReason}: ${result.errorMessage}`,
        }, id);
        return;
      }
      patchSignboard({
        extraction: result.extraction,
        extractionStatus: "complete",
        extractionFailureReason: null,
      }, id);
    } catch (error) {
      const reason = `action_error: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[signboard extraction] failed", error);
      patchSignboard({ extraction: null, extractionStatus: "complete", extractionFailureReason: reason }, id);
    }
  }

  async function processPhoto(file: File, provenance: CaptureProvenance, kind: "defect" | "signboard") {
    const id = crypto.randomUUID();
    const base: ReportPhoto = { id, photo: null, captureProvenance: provenance, status: "processing", failureReason: null, facesHidden: 0, redactionPath: null };
    if (kind === "defect") updatePhotos((photos) => [...photos, base].slice(0, MAX_DEFECT_PHOTOS));
    else updateSignboardPhoto(() => ({ ...base, extractionStatus: "idle", extraction: null, extractionFailureReason: null }));
    try {
      const source = await rasterise(file);
      file = undefined as never;
      sourcesRef.current.set(id, source);
      const preview = await canvasToBlob(source);
      setPreviews((current) => ({ ...current, [id]: preview }));
      try {
        const result = await redactCanvas(source);
        if (kind === "defect") patchPhoto(id, { ...result, status: "automatic" });
        else { patchSignboard({ ...result, status: "automatic" }, id); void extractSignboard(result.photo, id); }
      } catch (error) {
        const reason = error instanceof PhotoProcessingError ? error.reason : "model_error";
        console.error(`[photo redaction] ${reason}`, error);
        if (kind === "defect") patchPhoto(id, { status: reason, failureReason: reason });
        else patchSignboard({ status: reason, failureReason: reason }, id);
      }
    } catch (error) {
      const reason = "decode_failed" as const;
      console.error(`[photo redaction] ${reason}`, error);
      if (kind === "defect") patchPhoto(id, { status: reason, failureReason: reason });
      else patchSignboard({ status: reason, failureReason: reason }, id);
    }
  }

  function removePhoto(id: string, kind: "defect" | "signboard") {
    sourcesRef.current.delete(id);
    setPreviews((current) => { const next = { ...current }; delete next[id]; return next; });
    if (kind === "defect") updatePhotos((photos) => photos.filter((photo) => photo.id !== id));
    else updateSignboardPhoto(() => null);
  }

  function manualConfirmed(photo: ReportPhoto, processed: Blob, facesHidden: number, kind: "defect" | "signboard") {
    const updates = { photo: processed, facesHidden, redactionPath: "manual" as const, status: "manual_confirmed" as const };
    if (kind === "defect") patchPhoto(photo.id, updates);
    else { patchSignboard(updates, photo.id); void extractSignboard(processed, photo.id); }
  }

  if (state.step === 1) return (
    <section aria-labelledby="photo-heading">
      <h2 id="photo-heading" className="text-2xl font-bold text-indigo">{t("photoHeading")}</h2>
      <p className="mt-2 leading-6">{t("multiplePhotoHelp")}</p>
      <p className="mt-3 text-sm font-bold">{t("photoCount", { count: state.photos.length })}</p>
      {state.photos.length > 0 && <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{state.photos.map((photo) => <PhotoThumbnail key={photo.id} photo={photo} preview={previews[photo.id] ?? null} onRemove={() => removePhoto(photo.id, "defect")} />)}</div>}
      {state.photos.length < MAX_DEFECT_PHOTOS && <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PhotoInput label={t("takePhoto")} capture multiple onFiles={(files) => files.slice(0, MAX_DEFECT_PHOTOS - state.photos.length).forEach((item) => void processPhoto(item, "live", "defect"))} />
        <PhotoInput label={t("addPhotos")} multiple outline onFiles={(files) => files.slice(0, MAX_DEFECT_PHOTOS - state.photos.length).forEach((item) => void processPhoto(item, "upload", "defect"))} />
      </div>}
      <p className="mt-4 border-l-4 border-indigo bg-indigo/10 p-3 text-sm font-semibold">{t("redactionExplanation")}</p>
    </section>
  );
  if (state.step !== 2) return null;
  const totalFaces =
    state.photos.reduce((total, photo) => total + photo.facesHidden, 0) +
    (state.signboardPhoto?.facesHidden ?? 0);
  return (
    <section aria-labelledby="review-photo-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="review-photo-heading" className="text-lg font-bold text-indigo">{t("summaryPhotos")}</h2><button type="button" className="min-h-11 rounded border-2 border-indigo px-3 py-2 text-sm font-bold" onClick={() => updateState({ step: 1 })}>{t("editPhoto")}</button></div>
      <p className="mt-2 font-bold">{totalFaces === 0 ? t("noFacesFound") : t("totalFacesHidden", { count: totalFaces })}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">{state.photos.map((photo) => <ReviewPhoto key={photo.id} photo={photo} original={previews[photo.id] ?? null} source={sourcesRef.current.get(photo.id)} onConfirm={(blob, count) => manualConfirmed(photo, blob, count, "defect")} />)}</div>
    </section>
  );
}

function PhotoInput({ label, capture, multiple, outline, onFiles }: { label: string; capture?: boolean; multiple?: boolean; outline?: boolean; onFiles: (files: File[]) => void }) {
  return <label className={`flex min-h-12 cursor-pointer items-center justify-center rounded px-4 py-3 text-center font-bold ${outline ? "border-2 border-indigo" : "bg-indigo text-sand"}`}>{label}<input type="file" accept="image/*" capture={capture ? "environment" : undefined} multiple={multiple} className="sr-only" onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>;
}

function PhotoThumbnail({ photo, preview, onRemove }: { photo: ReportPhoto | SignboardPhoto; preview: Blob | null; onRemove: () => void }) {
  const url = useObjectUrl(preview ?? photo.photo);
  const extractionFailureReason =
    "extractionFailureReason" in photo ? photo.extractionFailureReason : null;
  return <div className="w-36 shrink-0 rounded border-2 border-stone p-2">{url && <img src={url} alt={t("photoPreview")} className="aspect-square w-full rounded object-cover" />}<p className="mt-2 text-xs font-bold">{statusText(photo)}</p>{photo.failureReason && <p className="mt-1 text-xs leading-4 text-charcoal">{failureText(photo.failureReason)}</p>}{extractionFailureReason && <p className="mt-1 text-xs leading-4 text-charcoal">{t("signboardExtractionFailure", { reason: extractionFailureReason })}</p>}<button type="button" className="mt-2 min-h-10 w-full rounded border-2 border-indigo px-2 text-sm font-bold" onClick={onRemove}>{t("removePhoto")}</button></div>;
}

function ReviewPhoto({ photo, original, source, onConfirm }: { photo: ReportPhoto; original: Blob | null; source?: HTMLCanvasElement; onConfirm: (blob: Blob, count: number) => void }) {
  const [showBefore, setShowBefore] = useState(false);
  const originalUrl = useObjectUrl(original); const processedUrl = useObjectUrl(photo.photo);
  if (isFailureStatus(photo.status) && source) return <ManualRedaction source={source} reason={photo.failureReason} onConfirm={onConfirm} />;
  if (photo.status === "processing") return <p className="border-l-4 border-indigo bg-indigo/10 p-3 font-bold">{t("processingPhoto")}</p>;
  const pathText = photo.redactionPath === "device"
    ? t("redactionDeviceComplete")
    : photo.redactionPath === "manual"
      ? t("manualRedactionConfirmed")
      : t("redactionServerComplete");
  return <div><p className="mb-2 text-sm font-bold">{pathText} · {statusText(photo)}</p>{processedUrl && <img src={showBefore && originalUrl ? originalUrl : processedUrl} alt={showBefore ? t("beforePhoto") : t("afterPhoto")} className="max-h-72 w-full rounded border-2 border-stone object-contain" />}{originalUrl && processedUrl && <button type="button" className="mt-2 min-h-10 rounded border-2 border-indigo px-3 text-sm font-bold" onClick={() => setShowBefore((value) => !value)}>{showBefore ? t("showAfter") : t("showBefore")}</button>}</div>;
}

function ManualRedaction({ source, reason, onConfirm }: { source: HTMLCanvasElement; reason: PhotoFailureReason | null; onConfirm: (blob: Blob, count: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const baseRef = useRef<HTMLCanvasElement>(copyCanvas(source)); const startRef = useRef<Point | null>(null); const [count, setCount] = useState(0);
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; canvas.width = source.width; canvas.height = source.height; canvas.getContext("2d")?.drawImage(baseRef.current, 0, 0); }, [source]);
  function point(event: ReactPointerEvent<HTMLCanvasElement>) { const bounds = event.currentTarget.getBoundingClientRect(); return { x: ((event.clientX - bounds.left) / bounds.width) * event.currentTarget.width, y: ((event.clientY - bounds.top) / bounds.height) * event.currentTarget.height }; }
  function finish(event: ReactPointerEvent<HTMLCanvasElement>) { const start = startRef.current; if (!start) return; const end = point(event); startRef.current = null; const box = { originX: Math.min(start.x, end.x), originY: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }; if (box.width >= 4 && box.height >= 4) { pixelateRegion(baseRef.current, box, false); canvasRef.current?.getContext("2d")?.drawImage(baseRef.current, 0, 0); setCount((value) => value + 1); } }
  return <div className="border-l-4 border-rani bg-rani/10 p-3"><p className="font-bold">{t("manualRedactionTitle")}</p><p className="mt-1 text-sm">{t("manualRedactionBody")}</p>{reason && <p className="mt-1 text-xs leading-4 text-charcoal">{failureText(reason)}</p>}<canvas ref={canvasRef} className="mt-3 h-auto w-full touch-none rounded border-2 border-rani" aria-label={t("manualRedactionCanvas")} onPointerDown={(event) => { startRef.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={finish} /><button type="button" className="mt-3 min-h-11 w-full rounded bg-indigo px-3 font-bold text-sand" onClick={() => void canvasToBlob(baseRef.current).then((blob) => onConfirm(blob, count))}>{t("confirmManualRedaction")}</button></div>;
}
