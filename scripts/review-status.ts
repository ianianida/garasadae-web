import { loadReviewLedger } from "./review-ledger";

async function main() {
  const state = await loadReviewLedger();
  const total = state.summaries.reduce((sum, row) => sum + row.stored, 0);
  const counts = { candidate: 0, hold: 0, exclude: 0 };
  for (const row of state.summaries) for (const key of ["candidate", "hold", "exclude"] as const) counts[key] += row[key];
  console.log(JSON.stringify({ scope: state.manifest.verseSlots, storedValidJudgments: total, pending: state.manifest.verseSlots - total, ...counts, formatIssues: state.errors.length, note: "저장 원장의 형식·해시 확인. 의미 검수와 실제 사용자 만족의 증명은 아님." }, null, 2));
  for (const row of state.summaries.filter(row => row.stored > 0)) console.log(JSON.stringify(row));
  for (const issue of state.errors.slice(0, 15)) console.error(issue);
  if (state.errors.length) process.exitCode = 1;
}
void main().catch(error => { console.error("검수 원장을 확인하지 못함", error instanceof Error ? error.message : "unknown"); process.exitCode = 1; });
