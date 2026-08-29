"use server";

import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";

const faceBoxSchema = z.object({
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
});

const faceDetectionSchema = z.object({
  faces: z.array(faceBoxSchema).max(100),
});

const MAX_FACE_AREA_RATIO = 0.4;

type ServerRedactionFailureReason =
  | "server_rejected_size"
  | "network_error"
  | "request_timeout"
  | "model_error"
  | "model_returned_oversized_box";

const OPENAI_TIMEOUT_MS = 30_000;
const OPENAI_NETWORK_RETRIES = 2;
const MAX_VISION_IMAGE_BYTES = 3_000_000;

class ServerRedactionError extends Error {
  readonly reason: ServerRedactionFailureReason;

  constructor(reason: ServerRedactionFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

const openAIResponseSchema = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        }),
      ).optional(),
    }),
  ),
});

const responseFormat = {
  type: "json_schema",
  name: "face_locations",
  strict: true,
  schema: {
    type: "object",
    properties: {
      faces: {
        type: "array",
        items: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
          required: ["x", "y", "width", "height"],
          additionalProperties: false,
        },
      },
    },
    required: ["faces"],
    additionalProperties: false,
  },
} as const;

function outputText(response: unknown) {
  const parsed = openAIResponseSchema.parse(response);
  return parsed.output
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestFaceBoxes(
  imageDataUrl: string,
  imageSizeBytes: number,
  retryInstruction?: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ServerRedactionError("model_error", "OPENAI_API_KEY is not configured");
  }

  const body = JSON.stringify({
    model: "gpt-5-nano",
    store: false,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${retryInstruction ?? ""}
Locate every visible human face and return a TIGHT box around facial identity only: hairline to chin vertically and ear to ear horizontally. Do not include the neck, shoulders, torso, the whole person, or empty space around the face. Include partially visible faces, but box only the visible facial area.

Use coordinates normalized from 0 to 1000 relative to the full image. Worked example: in a 1000 by 1000 portrait where the face extends from x=350 to x=650 and y=180 to y=530, return {"x":350,"y":180,"width":300,"height":350}. Do not return a larger head-and-torso or whole-person box.`,
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "high",
          },
        ],
      },
    ],
    text: { format: responseFormat },
  });

  for (let attempt = 0; attempt <= OPENAI_NETWORK_RETRIES; attempt += 1) {
    console.info("[server redaction] OpenAI request", {
      attempt: attempt + 1,
      imageSizeBytes,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServerRedactionError(
          "model_error",
          `OpenAI face detection failed with status ${response.status}`,
        );
      }

      const responseJson: unknown = await response.json();
      const rawOutput = outputText(responseJson);
      console.info("[server redaction diagnosis] raw model JSON", rawOutput);
      return rawOutput;
    } catch (error) {
      if (error instanceof ServerRedactionError) {
        throw error;
      }

      const timedOut = controller.signal.aborted;
      if (attempt === OPENAI_NETWORK_RETRIES) {
        throw new ServerRedactionError(
          timedOut ? "request_timeout" : "network_error",
          timedOut
            ? "OpenAI face detection timed out after 30 seconds"
            : `OpenAI face detection network request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await wait(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ServerRedactionError("network_error", "OpenAI face detection request failed");
}

async function detectFaceBoxes(imageDataUrl: string, imageSizeBytes: number) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await requestFaceBoxes(
      imageDataUrl,
      imageSizeBytes,
      attempt === 1
        ? "The prior response was invalid or a box covered too much of the image. Follow the JSON schema exactly. Every box must cover no more than 40% of the full image, and must be tightly limited to hairline-to-chin and ear-to-ear."
        : undefined,
    );
    try {
      const result = faceDetectionSchema.parse(JSON.parse(text ?? ""));
      const hasOversizedBox = result.faces.some(
        (face) => (face.width * face.height) / 1_000_000 > MAX_FACE_AREA_RATIO,
      );

      if (hasOversizedBox) {
        if (attempt === 1) {
          throw new ServerRedactionError(
            "model_returned_oversized_box",
            "Face bounding box exceeds 40% of the image area",
          );
        }
        continue;
      }

      return result;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
  throw new Error("Face box response was invalid");
}

async function performServerRedaction(formData: FormData) {
  const image = formData.get("image");
  if (image instanceof File && image.size > 5_000_000) {
    throw new ServerRedactionError(
      "server_rejected_size",
      "Prepared image exceeds the 5 MB server limit",
    );
  }
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    throw new Error("Invalid image");
  }

  const input = Buffer.from(await image.arrayBuffer());
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions are unavailable");
  }

  let visionInput = input;
  if (visionInput.length > MAX_VISION_IMAGE_BYTES) {
    const longestEdge = Math.max(metadata.width, metadata.height);
    let targetEdge = Math.max(640, Math.floor(longestEdge * 0.75));

    while (visionInput.length > MAX_VISION_IMAGE_BYTES && targetEdge >= 640) {
      visionInput = await sharp(input)
        .resize({
          width: targetEdge,
          height: targetEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      targetEdge = Math.floor(targetEdge * 0.75);
    }
  }

  const visionMetadata = await sharp(visionInput).metadata();
  const sharpInputMetadata = await sharp(input).metadata();
  console.info("[server redaction diagnosis] coordinate spaces", {
    modelCoordinateRange: { width: 1000, height: 1000 },
    modelCoordinateOrigin: "top-left (x increases right, y increases down)",
    modelImageDimensions: {
      width: visionMetadata.width,
      height: visionMetadata.height,
    },
    sourceImageDimensionsUsedForConversion: {
      width: metadata.width,
      height: metadata.height,
    },
    sharpOperatingBufferDimensions: {
      width: sharpInputMetadata.width,
      height: sharpInputMetadata.height,
    },
    visionBufferWasResized: visionInput !== input,
  });

  const imageDataUrl = `data:image/jpeg;base64,${visionInput.toString("base64")}`;
  const result = await detectFaceBoxes(imageDataUrl, visionInput.length);
  const overlays = await Promise.all(
    result.faces.map(async (face, index) => {
      const paddingX = face.width * 0.06;
      const paddingY = face.height * 0.08;
      const left = Math.min(
        metadata.width - 1,
        Math.max(0, Math.floor(((face.x - paddingX) / 1000) * metadata.width)),
      );
      const top = Math.min(
        metadata.height - 1,
        Math.max(0, Math.floor(((face.y - paddingY) / 1000) * metadata.height)),
      );
      const width = Math.max(
        1,
        Math.min(
          metadata.width - left,
          Math.ceil(((face.width + paddingX * 2) / 1000) * metadata.width),
        ),
      );
      const height = Math.max(
        1,
        Math.min(
          metadata.height - top,
          Math.ceil(((face.height + paddingY * 2) / 1000) * metadata.height),
        ),
      );
      console.info("[server redaction diagnosis] Sharp face box", {
        face: index + 1,
        rawModelBox: face,
        finalSharpExtract: { left, top, width, height },
        coordinateConversion: "normalized 0-1000 to source/Sharp buffer pixels",
        originMatch: "model and Sharp both use top-left",
      });
      const pixelsWide = Math.max(1, Math.floor(width / 18));
      const pixelsHigh = Math.max(1, Math.floor(height / 18));
      const originalPatch = await sharp(input).extract({ left, top, width, height }).toBuffer();
      const downscaled = await sharp(originalPatch)
        .resize(pixelsWide, pixelsHigh)
        .toBuffer();
      const pixelated = await sharp(downscaled)
        .resize(width, height, { kernel: "nearest" })
        .toBuffer();

      const originalHash = createHash("sha256").update(originalPatch).digest("hex");
      const pixelatedHash = createHash("sha256").update(pixelated).digest("hex");
      if (originalHash === pixelatedHash) {
        throw new Error("Face pixelation produced an unchanged patch");
      }

      return { input: pixelated, left, top };
    }),
  );

  const processed = await sharp(input).composite(overlays).jpeg({ quality: 90 }).toBuffer();
  return {
    imageBase64: processed.toString("base64"),
    facesHidden: result.faces.length,
  };
}

export async function redactPhotoOnServer(formData: FormData) {
  try {
    const result = await performServerRedaction(formData);
    return { ok: true as const, ...result };
  } catch (error) {
    const reason =
      error instanceof ServerRedactionError ? error.reason : "model_error";
    return {
      ok: false as const,
      failureReason: reason,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
