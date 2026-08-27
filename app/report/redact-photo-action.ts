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

async function requestFaceBoxes(imageDataUrl: string, retryInstruction?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI face detection failed with status ${response.status}`);
  }

  return outputText(await response.json());
}

async function detectFaceBoxes(imageDataUrl: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await requestFaceBoxes(
      imageDataUrl,
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
          throw new Error("Face bounding box exceeds 40% of the image area");
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

export async function redactPhotoOnServer(formData: FormData) {
  const image = formData.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/") || image.size > 5_000_000) {
    throw new Error("Invalid image");
  }

  const input = Buffer.from(await image.arrayBuffer());
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions are unavailable");
  }

  const imageDataUrl = `data:${image.type};base64,${input.toString("base64")}`;
  const result = await detectFaceBoxes(imageDataUrl);
  const overlays = await Promise.all(
    result.faces.map(async (face) => {
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
