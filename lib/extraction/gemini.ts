import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { PROMPT_BILL, PROMPT_HISTORY, SYSTEM } from "./prompts";
import { EXTRACTION_JSON_SCHEMA, ExtractedBillSchema, type ExtractedBill } from "./schema";
import type { VisionInput } from "./claude";

/**
 * Gemini vision via the Generative Language REST API. Same prompt, same JSON
 * schema and the same Zod validation as the Claude path, so the rest of the
 * pipeline (cross-checks, confidence, admin review) is provider-agnostic.
 */

const GEMINI_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const geminiSupports = (mime: string) => GEMINI_TYPES.includes(mime);

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(body: unknown): Promise<{ status: number; json: GeminiResponse }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini.model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.gemini.apiKey! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as GeminiResponse };
}

export async function extractWithGemini(input: VisionInput): Promise<ExtractedBill> {
  if (!env.gemini.enabled) throw new AppError("NOT_CONFIGURED", "GEMINI_API_KEY not set");
  if (!geminiSupports(input.mimeType)) throw new AppError("FILE_TYPE", `Gemini does not accept ${input.mimeType}`);

  const base = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: input.mimeType, data: input.bytes.toString("base64") } },
          { text: `${input.kind === "BILL" ? PROMPT_BILL : PROMPT_HISTORY}\nReturn JSON matching this schema exactly:\n${JSON.stringify(EXTRACTION_JSON_SCHEMA)}` },
        ],
      },
    ],
  };
  // Reading a bill needs accuracy, not deep reasoning: keep thinking low for latency.
  let generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseJsonSchema: EXTRACTION_JSON_SCHEMA,
    thinkingConfig: { thinkingLevel: "low" },
  };

  let lastError = "unknown error";
  for (let attempt = 0; attempt < 4; attempt++) {
    const { status, json } = await call({ ...base, generationConfig });
    if (status === 400 && generationConfig.thinkingConfig && /thinking/i.test(json.error?.message ?? "")) {
      // Model without thinking levels.
      const { thinkingConfig: _t, ...rest } = generationConfig;
      generationConfig = rest;
      continue;
    }
    if (status === 400 && generationConfig.responseJsonSchema && /schema/i.test(json.error?.message ?? "")) {
      // Model without JSON-schema support: keep JSON mode, rely on the prompt + Zod.
      const { responseJsonSchema: _s, ...rest } = generationConfig;
      generationConfig = rest;
      continue;
    }
    if (status === 429 || status >= 500) {
      lastError = json.error?.message ?? `HTTP ${status}`;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (status !== 200) throw new AppError("GENERIC", `Gemini ${status}: ${json.error?.message ?? "request failed"}`);
    if (json.promptFeedback?.blockReason) throw new AppError("GENERIC", `Gemini blocked the request (${json.promptFeedback.blockReason})`);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return ExtractedBillSchema.parse(JSON.parse(text));
    } catch (err) {
      lastError = `invalid JSON: ${String(err).slice(0, 200)}`;
    }
  }
  throw new AppError("GENERIC", `Gemini extraction failed: ${lastError}`);
}
