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

  const rawText = await response.text();
  let rawResponse: unknown = rawText;
  try {
    rawResponse = JSON.parse(rawText);
  } catch {
    // Keep a non-JSON error body verbatim for browser diagnostics.
  }
  if (!response.ok) {
    return { text: null, rawResponse, ok: false as const, status: response.status };
  }
  return { text: outputText(rawResponse), rawResponse, ok: true as const, status: response.status };
}

export async function extractSchoolSignboard(formData: FormData) {
  const image = formData.get("image");
  if (image instanceof File && image.size > 5_000_000) {
    return {
      ok: false as const,
      failureReason: "server_rejected_size",
      errorMessage: "Prepared signboard image exceeds the 5 MB server limit",
      rawResponses: [] as unknown[],
    };
  }
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return {
      ok: false as const,
      failureReason: "invalid_image",
      errorMessage: "Invalid signboard image",
      rawResponses: [] as unknown[],
    };
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
  const rawResponses: unknown[] = [];

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await requestExtraction(
        imageDataUrl,
        attempt === 1 ? "The previous response could not be parsed. Follow the schema exactly. " : "",
      );
      rawResponses.push(response.rawResponse);
      if (!response.ok) {
        throw new Error(`School signboard extraction failed with status ${response.status}`);
      }
      try {
        return {
          ok: true as const,
          extraction: extractionSchema.parse(JSON.parse(response.text ?? "")),
          rawResponses,
        };
      } catch (error) {
        if (attempt === 1) {
          throw error;
        }
      }
    }
  } catch (error) {
    return {
      ok: false as const,
      failureReason: rawResponses.length > 0 ? "invalid_model_response" : "model_error",
      errorMessage: error instanceof Error ? error.message : String(error),
      rawResponses,
    };
  }

  return {
    ok: false as const,
    failureReason: "invalid_model_response",
    errorMessage: "School signboard response was invalid",
    rawResponses,
  };
}
