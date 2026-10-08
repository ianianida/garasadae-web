import { mkdir, writeFile } from "node:fs/promises";
import { analyzeConcern } from "../src/lib/concern-analysis";
import { reviewCases } from "../src/data/review-cases";

async function main() {
const limit = Number(process.argv[2] ?? "2");
if (!Number.isInteger(limit) || limit < 1 || limit > reviewCases.length) throw new Error("Choose 1–16 cases.");
const report = [];
const selected = process.argv[3]?.split(",");
for (const item of reviewCases.slice(0, limit).filter(item => !selected || selected.includes(item.id))) {
  const result = await analyzeConcern(item.concern, true);
  const byKey = new Map(result.analysis.facts.map(f => [f.key, f]));
  const failures = [
    ...(result.analysisMode.startsWith("fallback") ? ["model_call_failed"] : []),
    ...(result.analysis.domain !== item.domain ? [`domain:${result.analysis.domain}`] : []),
    ...item.yes.filter(key => byKey.get(key)?.state !== "yes").map(key => `missing:${key}`),
    ...item.unknown.filter(key => byKey.get(key)?.state !== "unknown").map(key => `invented:${key}`)
  ];
  report.push({ caseId: item.id, ...result, failures });
  console.log(JSON.stringify({ caseId: item.id, model: result.model, mode: result.analysisMode, ms: result.durationMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, failures }));
}
await mkdir(".local/verification", { recursive: true });
const output = JSON.stringify({ checkedAt: new Date().toISOString(), source: "synthetic_prelaunch", cases: report }, null, 2);
await writeFile(".local/verification/luna-analysis.json", output);
await writeFile(`.local/verification/luna-analysis-${Date.now()}.json`, output);
if (report.some(item => item.failures.length)) process.exitCode = 1;
}
void main().catch(error => { console.error("Evaluation failed", error instanceof Error ? error.name : "unknown"); process.exitCode = 1; });
