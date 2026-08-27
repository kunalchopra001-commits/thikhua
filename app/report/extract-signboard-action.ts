"use server";

import { z } from "zod";

const extractionSchema = z.object({
  school_name: z.string().nullable(),
  udise_code: z.string().nullable(),
  village_or_block: z.string().nullable(),
  managing_body: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const openAIResponseSchema = z.object({
  output: z.array(
    z.object({
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }).passthrough(),
  ),
});

const responseFormat = {
  type: "json_schema",
  name: "school_signboard",
  strict: true,
  schema: {
    type: "object",
    properties: {
      school_name: { type: ["string", "null"] },
      udise_code: { type: ["string", "null"] },
      village_or_block: { type: ["string", "null"] },
      managing_body: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: [
      "school_name",
      "udise_code",
      "village_or_block",
      "managing_body",
      "confidence",
    ],
    additionalProperties: false,
  },
} as const;

function outputText(response: unknown) {
  const parsed = openAIResponseSchema.parse(response);
  return parsed.output
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text;
}

async function requestExtraction(imageDataUrl: string, retryInstruction = "") {
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
              text: `${retryInstruction} Read this Indian school name board. Extract only text that is visibly supported. Preserve the school name in its visible script. Use null when a field is absent or unreadable. Confidence is for the extraction as a whole.`,
            },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      text: { format: responseFormat },
    }),
  });

  if (!response.ok) {
    throw new Error(`School signboard extraction failed with status ${response.status}`);
  }
  return outputText(await response.json());
}

export async function extractSchoolSignboard(formData: FormData) {
  const image = formData.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/") || image.size > 5_000_000) {
    throw new Error("Invalid signboard image");
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await requestExtraction(
      imageDataUrl,
      attempt === 1 ? "The previous response could not be parsed. Follow the schema exactly. " : "",
    );
    try {
      return extractionSchema.parse(JSON.parse(text ?? ""));
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error("School signboard response was invalid");
}
