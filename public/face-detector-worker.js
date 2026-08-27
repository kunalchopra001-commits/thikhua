import {
  FaceDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite";

let detectorPromise;

async function initialiseDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
    },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
}

detectorPromise = initialiseDetector();
detectorPromise.then(
  () => self.postMessage({ type: "ready" }),
  (error) =>
    self.postMessage({
      type: "initialization_error",
      error: error instanceof Error ? error.message : "Face detector initialization failed",
    }),
);

self.addEventListener("message", async (event) => {
  const id = event.data.id;
  const image = event.data.image;

  try {
    const detector = await detectorPromise;
    const result = detector.detect(image);
    const boxes = result.detections.map((detection) => {
      const box = detection.boundingBox;
      return {
        originX: box.originX,
        originY: box.originY,
        width: box.width,
        height: box.height,
      };
    });

    self.postMessage({ id, boxes });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Face detection failed",
    });
  } finally {
    image.close();
  }
});
