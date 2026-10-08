import { readFile } from "node:fs/promises";
import { z } from "zod";
import { verses } from "../src/data/verses";
import { baseIds, rules } from "../src/data/rules";
import { verseFingerprint } from "../src/lib/selection";
import { CRITERIA_VERSION, connectionSchema, loadReviewLedger } from "./review-ledger";

const finalSchema = z.object({
  corpusSha256: z.string(), criteriaVersion: z.literal(CRITERIA_VERSION),
  reviewer: z.literal("Codex integration review"), method: z.literal("direct-codex-reading"),
  decisions: z.array(z.object({
    id: z.string(), textSha256: z.string(), status: z.enum(["candidate", "hold", "exclude"]),
    reason: z.string().min(8), counterexampleNote: z.string().min(8), connections: z.array(connectionSchema)
  }))
});
const releaseSchema = z.object({
  corpusSha256: z.string(), criteriaVersion: z.literal(CRITERIA_VERSION),
  activeVerseIds: z.array(z.string()).min(2),
  sourceChecks: z.array(z.object({
    id: z.string(), textSha256: z.string(), verifiedUrl: z.string().url(),
    checkedAt: z.string().datetime(), method: z.literal("publisher-attributed-whole-verse-comparison")
  })),
  ruleChecks: z.array(z.object({ ruleId: z.string(), caseIds: z.array(z.string()).min(1), reason: z.string().min(8) })),
  baseCaseIds: z.array(z.string()).min(1)
});
async function main() {
  const state = await loadReviewLedger();
  const errors = [...state.errors];
  const mergedBySlot = new Map<string,{id:string;end:number}>();
  try {
    const publisher=JSON.parse(await readFile("data/source/krv-publisher-audit.json","utf8"));
    if(publisher.corpusSha256!==state.manifest.corpusSha256 || publisher.verseSlots!==state.manifest.verseSlots || publisher.chapterCount!==state.manifest.chapterCount || publisher.chapters.length!==state.manifest.chapterCount) errors.push("공식 개역한글 전체 원문 대조 기록 불일치");
    for (const passage of publisher.mergedPassages) for (const id of passage.slotIds) mergedBySlot.set(id,{id:passage.id,end:passage.end});
  } catch {errors.push("공식 개역한글 전체 원문 대조 기록 누락");}
  if(new Set(verses.map(verse=>verseFingerprint(verse.text))).size!==verses.length) errors.push("도입 목록에서 다른 절 번호의 동일 본문이 중복 후보가 됨");
  for (const verse of verses) {
    const merged = mergedBySlot.get(verse.id);
    if (merged && (merged.id!==verse.id || merged.end!==verse.verseEnd)) errors.push(`${verse.id}: 공식 합친 절 범위 표기 불일치`);
    if (!merged && verse.verseEnd!==undefined && verse.verseEnd!==verse.verse) errors.push(`${verse.id}: 공식 원문에 없는 합친 절 범위`);
  }
  if (state.entries.size !== state.manifest.verseSlots) errors.push(`개별 검수 미완료: ${state.entries.size}/${state.manifest.verseSlots}`);
  let final: z.infer<typeof finalSchema> | undefined;
  let release: z.infer<typeof releaseSchema> | undefined;
  try { final = finalSchema.parse(JSON.parse(await readFile("data/review/final-decisions.json", "utf8"))); }
  catch { errors.push("후보·보류 재검토 원장이 없거나 형식이 맞지 않음"); }
  try { release = releaseSchema.parse(JSON.parse(await readFile("data/review/release-manifest.json", "utf8"))); }
  catch { errors.push("도입 본문·규칙 확인 기록이 없거나 형식이 맞지 않음"); }
  if (final) {
    if (final.corpusSha256 !== state.manifest.corpusSha256) errors.push("재검토 판본 해시 불일치");
    const byId = new Map(final.decisions.map(item => [item.id, item]));
    if (byId.size !== final.decisions.length) errors.push("재검토 중복 ID");
    for (const entry of state.entries.values()) {
      if (entry.status === "exclude") continue;
      const decision = byId.get(entry.id);
      if (!decision || decision.textSha256 !== entry.textSha256) errors.push(`${entry.id}: 후보·보류 재검토 누락 또는 본문 불일치`);
    }
    for (const decision of final.decisions) {
      const original = state.sourceById.get(decision.id);
      if (!original || original.textSha256 !== decision.textSha256) errors.push(`${decision.id}: 재검토 원문 불일치`);
      if (decision.connections.some(pair => !state.scenarios.has(pair.scenarioId))) errors.push(`${decision.id}: 재검토의 구체 고민 누락`);
      if (decision.status === "candidate" && !decision.connections.some(pair => pair.expectedEnough === "yes")) errors.push(`${decision.id}: 재검토의 충분한 연결 없음`);
    }
  }
  if (release && final) {
    if (release.corpusSha256 !== state.manifest.corpusSha256) errors.push("도입 확인 판본 해시 불일치");
    const active = new Set(release.activeVerseIds);
    const finalById = new Map(final.decisions.map(item => [item.id, item]));
    const sources = new Map(release.sourceChecks.map(item => [item.id, item]));
    if (active.size !== release.activeVerseIds.length || sources.size !== release.sourceChecks.length) errors.push("도입 목록·출처 확인 중복 ID");
    for (const verse of verses) {
      const original = state.sourceById.get(verse.id);
      const decision = finalById.get(verse.id);
      const source = sources.get(verse.id);
      if (!active.has(verse.id) || decision?.status !== "candidate") errors.push(`${verse.id}: 최종 도입 후보가 아님`);
      if (!original || verse.text !== original.text || verse.translation !== original.translation) errors.push(`${verse.id}: 실제 서비스 본문이 작업용 전체 절과 다름`);
      if (!source || source.textSha256 !== original?.textSha256 || source.verifiedUrl !== verse.sourceUrl) errors.push(`${verse.id}: 도입 본문 출처 재확인 누락`);
    }
    if (active.size !== verses.length || [...active].some(id => !verses.some(v => v.id === id))) errors.push("도입 확인 목록과 실제 서비스 목록 불일치");
    const used = new Set([...baseIds, ...rules.flatMap(rule => [...rule.verseIds, ...rule.expansionIds])]);
    for (const id of used) if (!active.has(id)) errors.push(`${id}: 규칙이 미검수 말씀을 참조함`);
    for (const id of active) if (!used.has(id)) errors.push(`${id}: 채택된 도입 말씀이 추첨 규칙에 연결되지 않음`);
    const checkedRules = new Map(release.ruleChecks.map(item => [item.ruleId, item]));
    for (const rule of rules) {
      const checked = checkedRules.get(rule.id);
      if (!checked || checked.caseIds.some(id => !state.scenarios.has(id))) errors.push(`${rule.id}: 구체 고민을 대조한 규칙 검수 누락`);
    }
    if (release.baseCaseIds.some(id => !state.scenarios.has(id))) errors.push("최종 확장 후보의 구체 고민 검수 누락");
  }
  if (errors.length) {
    console.error(`출시 검사 미통과 (${errors.length}개):`);
    for (const error of errors.slice(0, 20)) console.error(`- ${error}`);
    process.exitCode = 1;
  } else console.log(`전 ${state.entries.size}절 검수 기록·재검토·도입 본문·추첨 자료 일치 확인. 실제 사용자 만족은 별도 피드백으로 검증.`);
}
void main().catch(error => { console.error("출시 검사 실패", error instanceof Error ? error.message : "unknown"); process.exitCode = 1; });
