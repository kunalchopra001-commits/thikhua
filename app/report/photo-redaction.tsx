"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CaptureProvenance } from "../../lib/db";
import { t } from "../../lib/i18n";
import { useReportForm } from "./report-context";

type FaceBox = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const MAX_IMAGE_EDGE = 1600;
const DETECTION_TIMEOUT_MS = 8000;

function useObjectUrl(value: Blob | null) {
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas rasterisation failed"));
        }
      },
      "image/jpeg",
      0.9,
    );
  });
}

function copyCanvas(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  return copy;
}

function pixelateRegion(canvas: HTMLCanvasElement, box: FaceBox, expand = true) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  const paddingX = expand ? box.width * 0.16 : 0;
  const paddingY = expand ? box.height * 0.2 : 0;
  const x = Math.max(0, Math.floor(box.originX - paddingX));
  const y = Math.max(0, Math.floor(box.originY - paddingY));
  const width = Math.min(canvas.width - x, Math.ceil(box.width + paddingX * 2));
  const height = Math.min(canvas.height - y, Math.ceil(box.height + paddingY * 2));

  if (width < 1 || height < 1) {
    return;
  }

  const pixelCanvas = document.createElement("canvas");
  pixelCanvas.width = Math.max(1, Math.floor(width / 18));
  pixelCanvas.height = Math.max(1, Math.floor(height / 18));
  const pixelContext = pixelCanvas.getContext("2d");

  if (!pixelContext) {
    throw new Error("Pixelation canvas is unavailable");
  }

  pixelContext.imageSmoothingEnabled = true;
  pixelContext.drawImage(canvas, x, y, width, height, 0, 0, pixelCanvas.width, pixelCanvas.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(pixelCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height, x, y, width, height);
  context.restore();
}

function detectFaces(image: ImageBitmap): Promise<FaceBox[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/face-detector-worker.js", { type: "module" });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Face detection timed out"));
    }, DETECTION_TIMEOUT_MS);

    worker.addEventListener("message", (event) => {
      window.clearTimeout(timeout);
      worker.terminate();

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.boxes as FaceBox[]);
      }
    });
    worker.addEventListener("error", () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error("Face detector worker failed"));
    });
    worker.postMessage({ image }, [image]);
  });
}

export function PhotoRedaction() {
  const { state, updateState } = useReportForm();
  const [originalPreview, setOriginalPreview] = useState<Blob | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [manualRectangles, setManualRectangles] = useState(0);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const processingGenerationRef = useRef(0);
  const originalUrl = useObjectUrl(originalPreview);
  const processedUrl = useObjectUrl(state.photo);

  useEffect(() => {
    if (state.step !== 4 || state.photoProcessingStatus !== "manual_required") {
      return;
    }

    const source = sourceCanvasRef.current;
    const visible = manualCanvasRef.current;
    if (!source || !visible) {
      return;
    }

    const base = copyCanvas(source);
    manualBaseCanvasRef.current = base;
    visible.width = base.width;
    visible.height = base.height;
    visible.getContext("2d")?.drawImage(base, 0, 0);
    setManualRectangles(0);
  }, [state.photoProcessingStatus, state.step]);

  async function processPhoto(file: File | undefined, provenance: CaptureProvenance) {
    if (!file) {
      return;
    }

    const generation = processingGenerationRef.current + 1;
    processingGenerationRef.current = generation;
    updateState({
      photoSelected: true,
      photo: null,
      captureProvenance: provenance,
      photoProcessingStatus: "processing",
      facesBlurred: 0,
    });
    setOriginalPreview(null);
    setShowBefore(false);
    setManualRectangles(0);

    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      file = undefined;
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
      const source = document.createElement("canvas");
      source.width = Math.max(1, Math.round(bitmap.width * scale));
      source.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = source.getContext("2d");

      if (!context) {
        bitmap.close();
        throw new Error("Image canvas is unavailable");
      }

      context.drawImage(bitmap, 0, 0, source.width, source.height);
      sourceCanvasRef.current = source;
      setOriginalPreview(await canvasToBlob(source));

      const detectionBitmap = await createImageBitmap(source);
      bitmap.close();

      try {
        const boxes = await detectFaces(detectionBitmap);
        if (processingGenerationRef.current !== generation) {
          return;
        }
        const processed = copyCanvas(source);
        boxes.forEach((box) => pixelateRegion(processed, box));
        updateState({
          photo: await canvasToBlob(processed),
          photoProcessingStatus: "automatic",
          facesBlurred: boxes.length,
        });
      } catch {
        if (processingGenerationRef.current !== generation) {
          return;
        }
        updateState({
          photo: null,
          photoProcessingStatus: "manual_required",
          facesBlurred: 0,
        });
      }
    } catch {
      if (processingGenerationRef.current !== generation) {
        return;
      }
      updateState({
        photo: null,
        photoProcessingStatus: "manual_required",
        facesBlurred: 0,
      });
    }
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function drawManualPreview(end: Point) {
    const start = dragStartRef.current;
    const base = manualBaseCanvasRef.current;
    const visible = manualCanvasRef.current;
    if (!start || !base || !visible) {
      return;
    }

    const context = visible.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, visible.width, visible.height);
    context.drawImage(base, 0, 0);
    context.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-rani")
      .trim();
    context.lineWidth = Math.max(3, visible.width / 300);
    context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  }

  function finishManualRectangle(event: ReactPointerEvent<HTMLCanvasElement>) {
    const start = dragStartRef.current;
    const base = manualBaseCanvasRef.current;
    if (!start || !base) {
      return;
    }

    const end = canvasPoint(event);
    dragStartRef.current = null;
    const box = {
      originX: Math.min(start.x, end.x),
      originY: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };

    if (box.width >= 4 && box.height >= 4) {
      pixelateRegion(base, box, false);
      setManualRectangles((count) => count + 1);
    }
    const visible = manualCanvasRef.current;
    if (visible) {
      const context = visible.getContext("2d");
      context?.clearRect(0, 0, visible.width, visible.height);
      context?.drawImage(base, 0, 0);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resetManualRedactions() {
    const source = sourceCanvasRef.current;
    const visible = manualCanvasRef.current;
    if (!source || !visible) {
      return;
    }

    const base = copyCanvas(source);
    manualBaseCanvasRef.current = base;
    visible.getContext("2d")?.drawImage(base, 0, 0);
    setManualRectangles(0);
  }

  async function confirmManualRedaction() {
    const base = manualBaseCanvasRef.current;
    if (!base) {
      return;
    }

    updateState({
      photo: await canvasToBlob(base),
      photoProcessingStatus: "manual_confirmed",
      facesBlurred: manualRectangles,
    });
    setShowBefore(false);
  }

  function removePhoto() {
    processingGenerationRef.current += 1;
    updateState({
      photoSelected: false,
      photo: null,
      captureProvenance: null,
      photoProcessingStatus: "idle",
      facesBlurred: 0,
    });
    setOriginalPreview(null);
    setShowBefore(false);
    sourceCanvasRef.current = null;
    manualBaseCanvasRef.current = null;
    setManualRectangles(0);
  }

  const processed =
    state.photoProcessingStatus === "automatic" ||
    state.photoProcessingStatus === "manual_confirmed";
  const faceCountText =
    state.facesBlurred === 0
      ? t("noFacesFound")
      : state.facesBlurred === 1
        ? t("oneFaceBlurred")
        : t("facesBlurred", { count: state.facesBlurred });

  if (state.step === 1) {
    return (
      <section aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="text-2xl font-bold text-indigo">
          {t("photoHeading")}
        </h2>
        <p className="mt-2 leading-6">{t("photoHelp")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded bg-indigo px-4 py-3 text-center font-bold text-sand focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo">
          {t("takePhoto")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={state.photoProcessingStatus === "processing"}
            onChange={(event) => {
              void processPhoto(event.target.files?.[0], "live");
              event.target.value = "";
            }}
          />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded border-2 border-indigo px-4 py-3 text-center font-bold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo">
          {t("uploadPhoto")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={state.photoProcessingStatus === "processing"}
            onChange={(event) => {
              void processPhoto(event.target.files?.[0], "upload");
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <p className="mt-4 border-l-4 border-indigo bg-indigo/10 p-3 text-sm font-semibold">
        {t("redactionExplanation")}
      </p>

      {originalUrl && (
        <div className="mt-6">
          <img
            src={originalUrl}
            alt={t("photoPreview")}
            className="max-h-96 w-full rounded border-2 border-stone object-contain"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {state.captureProvenance === "live" ? t("liveCapture") : t("uploadedCapture")}
            </p>
            <button
              type="button"
              className="min-h-11 rounded border-2 border-indigo px-4 py-2 font-bold"
              onClick={removePhoto}
            >
              {t("removePhoto")}
            </button>
          </div>
        </div>
      )}
      </section>
    );
  }

  if (state.step !== 4) {
    return null;
  }

  return (
    <section aria-labelledby="review-photo-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="review-photo-heading" className="text-lg font-bold text-indigo">
          {t("summaryPhoto")}
        </h2>
        <button
          type="button"
          className="min-h-11 rounded border-2 border-indigo px-3 py-2 text-sm font-bold"
          onClick={() => updateState({ step: 1 })}
        >
          {t("editPhoto")}
        </button>
      </div>

      {state.photoProcessingStatus === "processing" && (
        <p className="mt-3 border-l-4 border-indigo bg-indigo/10 p-3 font-bold" role="status">
          {t("processingPhoto")}
        </p>
      )}

      {state.photoProcessingStatus === "manual_required" && (
        <div className="mt-3">
          <div className="border-l-4 border-rani bg-rani/10 p-4" role="alert">
            <h3 className="font-bold">{t("manualRedactionTitle")}</h3>
            <p className="mt-1 text-sm leading-5">{t("manualRedactionBody")}</p>
          </div>
          <canvas
            ref={manualCanvasRef}
            className="mt-4 h-auto w-full touch-none rounded border-2 border-rani"
            aria-label={t("manualRedactionCanvas")}
            onPointerDown={(event) => {
              dragStartRef.current = canvasPoint(event);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (dragStartRef.current) {
                drawManualPreview(canvasPoint(event));
              }
            }}
            onPointerUp={finishManualRectangle}
            onPointerCancel={(event) => {
              dragStartRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              resetManualRedactions();
            }}
          />
          <p className="mt-3 text-sm font-semibold">
            {t("manualRectangleCount", { count: manualRectangles })}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="min-h-12 rounded border-2 border-indigo px-4 py-3 font-bold"
              onClick={resetManualRedactions}
            >
              {t("resetRedactions")}
            </button>
            <button
              type="button"
              className="min-h-12 rounded bg-indigo px-4 py-3 font-bold text-sand"
              onClick={() => void confirmManualRedaction()}
            >
              {t("confirmManualRedaction")}
            </button>
          </div>
        </div>
      )}

      {processed && processedUrl && (
        <div className="mt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">
                {state.photoProcessingStatus === "automatic"
                  ? t("automaticRedactionComplete")
                  : t("manualRedactionConfirmed")}
              </p>
              <p className="mt-1 text-sm">{faceCountText}</p>
            </div>
            {originalUrl && (
              <div className="flex rounded border-2 border-indigo p-1">
                <button
                  type="button"
                  className={`min-h-10 rounded px-3 py-2 text-sm font-bold ${
                    showBefore ? "bg-indigo text-sand" : "bg-sand text-charcoal"
                  }`}
                  aria-pressed={showBefore}
                  onClick={() => setShowBefore(true)}
                >
                  {t("showBefore")}
                </button>
                <button
                  type="button"
                  className={`min-h-10 rounded px-3 py-2 text-sm font-bold ${
                    showBefore ? "bg-sand text-charcoal" : "bg-indigo text-sand"
                  }`}
                  aria-pressed={!showBefore}
                  onClick={() => setShowBefore(false)}
                >
                  {t("showAfter")}
                </button>
              </div>
            )}
          </div>
          <img
            src={showBefore && originalUrl ? originalUrl : processedUrl}
            alt={showBefore ? t("beforePhoto") : t("afterPhoto")}
            className="max-h-72 w-full rounded border-2 border-stone object-contain"
          />
        </div>
      )}
    </section>
  );
}
