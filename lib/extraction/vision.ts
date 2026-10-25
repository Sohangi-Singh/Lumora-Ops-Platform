import "server-only";
import { env } from "@/lib/env";
import { extractWithClaude, visionSupported as claudeSupports, type VisionInput } from "./claude";
import { extractWithGemini, geminiSupports } from "./gemini";
import type { ExtractedBill } from "./schema";

/** Picks the configured vision provider: Claude if set, else Gemini. */
export const visionProvider = (): "claude" | "gemini" | null => (env.anthropic.enabled ? "claude" : env.gemini.enabled ? "gemini" : null);

export function visionAvailable(mimeType: string): boolean {
  const p = visionProvider();
  return p === "claude" ? claudeSupports(mimeType) : p === "gemini" ? geminiSupports(mimeType) : false;
}

export function extractWithVision(input: VisionInput): Promise<ExtractedBill> {
  return visionProvider() === "claude" ? extractWithClaude(input) : extractWithGemini(input);
}
