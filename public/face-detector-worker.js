import {
  FaceDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite";

self.addEventListener("message", async (event) => {
  const image = event.data.image;
  let detector;

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });

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

    self.postMessage({ boxes });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Face detection failed" });
  } finally {
    image.close();
    detector?.close();
  }
});
