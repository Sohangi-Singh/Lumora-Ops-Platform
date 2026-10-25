import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { PROMPT_BILL, PROMPT_HISTORY, SYSTEM } from "./prompts";
import { EXTRACTION_JSON_SCHEMA, ExtractedBillSchema, type ExtractedBill } from "./schema";

export type VisionInput = { bytes: Buffer; mimeType: string; kind: "BILL" | "HISTORY" };

const VISION_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type VisionImageType = (typeof VISION_IMAGE_TYPES)[number];

export function visionSupported(mimeType: string): boolean {
  return mimeType === "application/pdf" || (VISION_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  // SDK retries 408/409/429/5xx and connection errors with exponential backoff.
  client ??= new Anthropic({ apiKey: env.anthropic.apiKey, timeout: 90_000, maxRetries: 3 });
  return client;
}

/**
 * One structured-output call to Claude vision. PDFs go in as document blocks
 * (Claude sees each page as an image *and* text, which handles the garbled
 * Hindi text layer); photos/screenshots go in as image blocks.
 */
export async function extractWithClaude(input: VisionInput): Promise<ExtractedBill> {
  if (!env.anthropic.enabled) throw new AppError("NOT_CONFIGURED", "ANTHROPIC_API_KEY / ANTHROPIC_MODEL not set");
  if (!visionSupported(input.mimeType)) throw new AppError("FILE_TYPE", `Vision does not accept ${input.mimeType}`);

  const data = input.bytes.toString("base64");
  const fileBlock: Anthropic.ContentBlockParam =
    input.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: input.mimeType as VisionImageType, data } };

  // One extra attempt if the model's JSON fails our own validation.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().messages.create({
      model: env.anthropic.model!,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [fileBlock, { type: "text", text: input.kind === "BILL" ? PROMPT_BILL : PROMPT_HISTORY }],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new AppError("GENERIC", "Model declined to read this document");
    if (response.stop_reason === "max_tokens") {
      lastError = new Error("Output truncated");
      continue;
    }
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    try {
      return ExtractedBillSchema.parse(JSON.parse(text ?? ""));
    } catch (err) {
      lastError = err;
    }
  }
  throw new AppError("GENERIC", `Could not parse extraction: ${String(lastError)}`);
}
