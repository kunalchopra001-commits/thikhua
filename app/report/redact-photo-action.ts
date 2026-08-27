"use server";

import sharp from "sharp";
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
              text: `${retryInstruction ?? ""} Locate every visible human face. Return each bounding box using coordinates normalized from 0 to 1000 relative to the full image. Include partially visible faces.`,
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
      attempt === 1 ? "The prior response could not be parsed. Follow the JSON schema exactly." : undefined,
    );
    try {
      return faceDetectionSchema.parse(JSON.parse(text ?? ""));
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
      const paddingX = face.width * 0.16;
      const paddingY = face.height * 0.2;
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
      const pixelated = await sharp(input)
        .extract({ left, top, width, height })
        .resize(pixelsWide, pixelsHigh)
        .resize(width, height, { kernel: "nearest" })
        .toBuffer();
      return { input: pixelated, left, top };
    }),
  );

  const processed = await sharp(input).composite(overlays).jpeg({ quality: 90 }).toBuffer();
  return {
    imageBase64: processed.toString("base64"),
    facesHidden: result.faces.length,
  };
}
