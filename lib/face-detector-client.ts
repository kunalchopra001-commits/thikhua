export type FaceBox = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type PendingDetection = {
  resolve: (boxes: FaceBox[]) => void;
  reject: (error: Error) => void;
  timeout: number;
};

const DEVICE_TIMEOUT_MS = 20_000;

let worker: Worker | null = null;
let workerState: "idle" | "loading" | "ready" | "failed" = "idle";
let initializationTimeout: number | null = null;
let nextRequestId = 1;
const pendingDetections = new Map<number, PendingDetection>();

function failWorker(error: Error) {
  workerState = "failed";
  worker?.terminate();
  worker = null;
  if (initializationTimeout !== null) {
    window.clearTimeout(initializationTimeout);
    initializationTimeout = null;
  }
  pendingDetections.forEach((pending) => {
    window.clearTimeout(pending.timeout);
    pending.reject(error);
  });
  pendingDetections.clear();
}

export function warmFaceDetector() {
  if (workerState !== "idle") {
    return;
  }

  workerState = "loading";
  worker = new Worker("/face-detector-worker.js", { type: "module" });
  initializationTimeout = window.setTimeout(() => {
    failWorker(new Error("Face detector initialization timed out"));
  }, DEVICE_TIMEOUT_MS);

  worker.addEventListener("message", (event) => {
    if (event.data.type === "ready") {
      workerState = "ready";
      if (initializationTimeout !== null) {
        window.clearTimeout(initializationTimeout);
        initializationTimeout = null;
      }
      return;
    }

    if (event.data.type === "initialization_error") {
      failWorker(new Error(event.data.error));
      return;
    }

    const pending = pendingDetections.get(event.data.id);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeout);
    pendingDetections.delete(event.data.id);
    if (event.data.error) {
      pending.reject(new Error(event.data.error));
    } else {
      pending.resolve(event.data.boxes as FaceBox[]);
    }
  });
  worker.addEventListener("error", () => {
    failWorker(new Error("Face detector worker failed"));
  });
}

export function isFaceDetectorReady() {
  return workerState === "ready";
}

export function detectFacesOnDevice(image: ImageBitmap): Promise<FaceBox[]> {
  if (!worker || workerState !== "ready") {
    image.close();
    return Promise.reject(new Error("Face detector is not ready"));
  }

  const id = nextRequestId;
  nextRequestId += 1;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingDetections.delete(id);
      reject(new Error("On-device face detection timed out"));
    }, DEVICE_TIMEOUT_MS);
    pendingDetections.set(id, { resolve, reject, timeout });
    worker?.postMessage({ id, image }, [image]);
  });
}
