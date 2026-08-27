"use server";

import { z } from "zod";
import { deriveAuthorities } from "../../lib/authorities.ts";
import { supabase } from "../../lib/db.ts";

const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const CLASSIFICATION_MODEL = "gpt-5-nano";

const SYSTEM_PROMPT = `You are processing a citizen's report about a government school building in India.

Return ONLY a JSON object. No markdown, no code fences, no preamble.

Fields:
- \`detected_language\`: BCP-47 tag of the input.
- \`text_original\`: the report verbatim in its original language.
- \`text_hindi\`: a faithful Hindi rendering.
- \`text_english_official\`: rewritten in formal English suitable for an official municipal/education-department complaint. Factual, specific, no emotive language.
- \`category\`: one of \`structural\`, \`electrical\`, \`sanitation\`, \`water\`, \`furniture\`, \`accessibility\`, \`boundary\`, \`other\`.
- \`severity\`: one of \`S1\`, \`S2\`, \`S3\`, \`S4\`.
  - S1 — danger to life: unstable ceiling or beam, cracked load-bearing wall, exposed live wiring, unfenced well or tank.
  - S2 — health and safety: no drinking water, non-functional toilets, unsafe stairs, kitchen hazard.
  - S3 — entitlement violation under the RTE Act: no CWSN ramp, no separate girls' toilet, no electricity.
  - S4 — learning environment: broken furniture, leaking roof, blackboard, windows.
- \`severity_reasoning\`: one sentence naming the concrete indicator that set the tier.
- \`rte_entitlement_violated\`: boolean.
- \`estimated_scale\`: \`minor\` if plausibly within a school-level maintenance grant; \`major\` if it needs structural or civil work by an external agency.
- \`location_within_premises\`: e.g. "Room 3, north wall", or null if not stated.

Never invent details the reporter did not give. If severity is ambiguous, choose the lower tier and say so in the reasoning. Severity is provisional until inspected.`;

const inputSchema = z.object({
  schoolId: z.string().uuid(),
  text: z.string().trim().max(10_000).optional(),
});

const processedTextSchema = z.object({
  detected_language: z.string().min(1),
  text_original: z.string().min(1),
  text_hindi: z.string().min(1),
  text_english_official: z.string().min(1),
  category: z.enum([
    "structural",
    "electrical",
    "sanitation",
    "water",
    "furniture",
    "accessibility",
    "boundary",
    "other",
  ]),
  severity: z.enum(["S1", "S2", "S3", "S4"]),
  severity_reasoning: z.string().min(1),
  rte_entitlement_violated: z.boolean(),
  estimated_scale: z.enum(["minor", "major"]),
  location_within_premises: z.string().nullable(),
}).strict();

const openAIResponseSchema = z.object({
  output: z.array(
    z.object({
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        }),
      ).optional(),
    }).passthrough(),
  ),
});

const transcriptionResponseSchema = z.object({ text: z.string().min(1) });

const responseFormat = {
  type: "json_schema",
  name: "processed_school_report",
  strict: true,
  schema: {
    type: "object",
    properties: {
      detected_language: { type: "string" },
      text_original: { type: "string" },
      text_hindi: { type: "string" },
      text_english_official: { type: "string" },
      category: {
        type: "string",
        enum: [
          "structural",
          "electrical",
          "sanitation",
          "water",
          "furniture",
          "accessibility",
          "boundary",
          "other",
        ],
      },
      severity: { type: "string", enum: ["S1", "S2", "S3", "S4"] },
      severity_reasoning: { type: "string" },
      rte_entitlement_violated: { type: "boolean" },
      estimated_scale: { type: "string", enum: ["minor", "major"] },
      location_within_premises: { type: ["string", "null"] },
    },
    required: [
      "detected_language",
      "text_original",
      "text_hindi",
      "text_english_official",
      "category",
      "severity",
      "severity_reasoning",
      "rte_entitlement_violated",
      "estimated_scale",
      "location_within_premises",
    ],
    additionalProperties: false,
  },
} as const;

export type ProcessReportProgress = {
  stage: "validation" | "transcription" | "classification" | "authority_derivation";
  status: "complete" | "skipped" | "failed";
  latencyMs?: number;
};

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}

function outputText(response: unknown) {
  const parsed = openAIResponseSchema.parse(response);
  return parsed.output
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text;
}

function audioFilename(audio: File) {
  const extensionByType: Record<string, string> = {
    "audio/flac": "flac",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mpga": "mpga",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  const existingExtension = audio.name.split(".").pop();
  return existingExtension && existingExtension !== audio.name
    ? audio.name
    : `voice-note.${extensionByType[audio.type] ?? "webm"}`;
}

async function transcribe(audio: File) {
  const body = new FormData();
  body.append("model", TRANSCRIPTION_MODEL);
  body.append("response_format", "json");
  body.append("file", audio, audioFilename(audio));

  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getApiKey()}` },
      body,
    });
  } finally {
    console.info("[process report] transcription latency", {
      latencyMs: Math.round(performance.now() - startedAt),
      model: TRANSCRIPTION_MODEL,
    });
  }
  const latencyMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new Error(`Transcription failed with status ${response.status}`);
  }

  return {
    text: transcriptionResponseSchema.parse(await response.json()).text,
    latencyMs,
  };
}

async function classify(sourceText: string, stricterInstruction = "") {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFICATION_MODEL,
        store: false,
        instructions: SYSTEM_PROMPT,
        input: `${stricterInstruction}${sourceText}`,
        text: { format: responseFormat },
      }),
    });
  } finally {
    console.info("[process report] classification latency", {
      latencyMs: Math.round(performance.now() - startedAt),
      model: CLASSIFICATION_MODEL,
    });
  }
  const latencyMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new Error(`Report classification failed with status ${response.status}`);
  }

  return { text: outputText(await response.json()), latencyMs };
}

export async function processReport(formData: FormData) {
  const progress: ProcessReportProgress[] = [];
  let activeStage: ProcessReportProgress["stage"] = "validation";

  try {
    const input = inputSchema.parse({
      schoolId: formData.get("school_id"),
      text: typeof formData.get("text") === "string" ? formData.get("text") : undefined,
    });
    const audio = formData.get("audio");
    const photos = formData.getAll("photos");
    const redactedPhotos = photos.filter(
      (photo): photo is File => photo instanceof File && photo.type.startsWith("image/"),
    );

    if (photos.length !== redactedPhotos.length || redactedPhotos.length < 1 || redactedPhotos.length > 5) {
      throw new Error("Provide between one and five valid redacted photos");
    }
    if (audio !== null && (!(audio instanceof File) || !audio.type.startsWith("audio/"))) {
      throw new Error("Audio must be a valid audio file");
    }
    if (!input.text && !(audio instanceof File)) {
      throw new Error("Provide report text, an audio note, or both");
    }
    progress.push({ stage: "validation", status: "complete" });

    let transcription: string | null = null;
    if (audio instanceof File) {
      activeStage = "transcription";
      const result = await transcribe(audio);
      transcription = result.text;
      progress.push({ stage: "transcription", status: "complete", latencyMs: result.latencyMs });
    } else {
      progress.push({ stage: "transcription", status: "skipped" });
    }

    const sourceText = [
      input.text ? `Citizen's written report:\n${input.text}` : null,
      transcription ? `Citizen's transcribed voice note:\n${transcription}` : null,
    ].filter(Boolean).join("\n\n");

    let processedText: z.infer<typeof processedTextSchema> | null = null;
    let classificationLatencyMs = 0;
    let lastValidationError: unknown = null;

    activeStage = "classification";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await classify(
        sourceText,
        attempt === 1
          ? "The previous response failed validation. Follow the strict JSON schema exactly, include every required field, and add no other fields.\n\n"
          : "",
      );
      classificationLatencyMs += result.latencyMs;
      try {
        processedText = processedTextSchema.parse(JSON.parse(result.text ?? ""));
        break;
      } catch (error) {
        lastValidationError = error;
      }
    }

    if (!processedText) {
      progress.push({
        stage: "classification",
        status: "failed",
        latencyMs: classificationLatencyMs,
      });
      throw new Error(
        `Report classification returned invalid structured data after one retry: ${
          lastValidationError instanceof Error ? lastValidationError.message : "unknown validation error"
        }`,
      );
    }
    progress.push({
      stage: "classification",
      status: "complete",
      latencyMs: classificationLatencyMs,
    });

    activeStage = "authority_derivation";
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("*")
      .eq("id", input.schoolId)
      .maybeSingle();
    if (schoolError) {
      throw new Error(`School lookup failed: ${schoolError.message}`);
    }
    if (!school) {
      throw new Error("School was not found");
    }

    const authorities = deriveAuthorities(
      school.is_urban,
      school.block_name,
      school.district,
      school.name_en,
      processedText.estimated_scale,
    );
    progress.push({ stage: "authority_derivation", status: "complete" });

    return {
      ok: true as const,
      status: "complete" as const,
      progress,
      models: {
        transcription: audio instanceof File ? TRANSCRIPTION_MODEL : null,
        classification: CLASSIFICATION_MODEL,
      },
      record: {
        school_id: school.id,
        source_text: sourceText,
        transcription,
        ...processedText,
        ...authorities,
        statutory_limit_days: 90,
        redacted_photos: redactedPhotos.map((photo) => ({
          name: photo.name,
          type: photo.type,
          size: photo.size,
        })),
      },
    };
  } catch (error) {
    if (!progress.some((item) => item.stage === activeStage && item.status === "failed")) {
      progress.push({ stage: activeStage, status: "failed" });
    }
    return {
      ok: false as const,
      status: "failed" as const,
      progress,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
