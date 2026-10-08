import { mkdir, writeFile } from "node:fs/promises";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { ANALYSIS_SYSTEM, ANALYSIS_VERSION, concernSchema, sanitizeAnalysis } from "../src/lib/concern-analysis";
import { reviewCases } from "../src/data/review-cases";

async function main() {
  const item = reviewCases.find(row => row.id === process.argv[2]);
  if (!item || !process.env.OPENAI_API_KEY) throw new Error("Choose an existing synthetic case with a configured key.");
  const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await generateText({
    model: provider.responses(process.env.OPENAI_MODEL ?? "gpt-6-luna"), system: ANALYSIS_SYSTEM,
    prompt: JSON.stringify({ concern: item.concern }), output: Output.object({ schema: concernSchema }),
    providerOptions: { openai: { store: false, reasoningEffort: "none", reasoningSummary: null } },
    maxOutputTokens: 1600, maxRetries: 1, abortSignal: AbortSignal.timeout(10000)
  });
  const raw = response.output, sanitized = sanitizeAnalysis(raw, item.concern);
  await mkdir(".local/verification", { recursive: true });
  await writeFile(`.local/verification/analysis-raw-${item.id}.json`, JSON.stringify({ source: "synthetic_prelaunch", version: ANALYSIS_VERSION, concern: item.concern, raw, sanitized }, null, 2));
  console.log(JSON.stringify({ caseId: item.id, rawFacts: raw.facts, lostFacts: raw.facts.filter(fact => fact.state !== "unknown" && sanitized.facts.find(row => row.key === fact.key)?.state === "unknown") }));
}
void main().catch(error => { console.error("Synthetic analysis inspection failed", error instanceof Error ? error.name : "unknown"); process.exitCode = 1; });
