import assert from "node:assert/strict";
import test from "node:test";
import { selectVerse, matchesRule } from "../src/lib/selection";
import { rules, baseIds } from "../src/data/rules";
import { verses, verseId } from "../src/data/verses";
import { factKeys, type ConcernFacts, type CandidateRule } from "../src/lib/types";

function facts(domain: ConcernFacts["domain"], yes: string[] = []): ConcernFacts {
  return { domain, choices: [], unknowns: [], facts: factKeys.map(key => ({ key, state: yes.includes(key) ? "yes" : "unknown", evidence: yes.includes(key) ? "입력의 직접 근거" : "" })) };
}
const draw = (analysis: ConcernFacts, other: Partial<Parameters<typeof selectVerse>[0]> = {}) => selectVerse({ analysis, verses, rules, baseIds, recentIds: [], chooseIndex: () => 0, ...other });

test("같은 구절의 연결 사례가 많아도 확률이 늘어나지 않는다", () => {
  const a = verseId("MAT.6.34"), b = verseId("ECC.3.13");
  const duplicateRules: CandidateRule[] = [1, 2, 3].map(n => ({ id: String(n), domains: ["general"], verseIds: n === 1 ? [a, b] : [a], expansionIds: [], reviewCaseIds: [], rationale: "검증" }));
  const samples: string[] = [];
  for (let index = 0; index < 2; index++) {
    samples.push(draw(facts("general"), { rules: duplicateRules, chooseIndex: max => { assert.equal(max, 2); return index; } }).verse.id);
  }
  assert.deepEqual(samples, [a, b]);
});

test("다른 절 번호에 같은 본문이 있어도 독립적인 추첨 기회를 더 얻지 않는다", () => {
  const a=verses[0], b=verses[1], alias={...a,id:a.id+":alias",text:" "+a.text+" "};
  const rule: CandidateRule={id:"merged-test",domains:["general"],verseIds:[a.id,alias.id,b.id],expansionIds:[],reviewCaseIds:[],rationale:"합친 본문 중복"};
  const selected=[];
  for(let index=0;index<2;index++) selected.push(draw(facts("general"),{verses:[a,alias,b],rules:[rule],baseIds:[a.id,b.id],chooseIndex:max=>{assert.equal(max,2);return index;}}).verse.text);
  assert.deepEqual(selected,[a.text,b.text]);
});

test("재뽑기와 최근 회피는 절 번호가 다른 같은 본문에도 적용한다", () => {
  const a=verses[0], b=verses[1], alias={...a,id:a.id+":alias",text:" "+a.text+" "};
  const rule: CandidateRule={id:"merged-test",domains:["general"],verseIds:[a.id,alias.id,b.id],expansionIds:[],reviewCaseIds:[],rationale:"합친 본문 중복"};
  const options={verses:[a,alias,b],rules:[rule],baseIds:[a.id,b.id]};
  assert.equal(draw(facts("general"),{...options,previousId:alias.id}).verse.id,b.id);
  assert.equal(draw(facts("general"),{...options,recentIds:[alias.id]}).verse.id,b.id);
  // A stored draw can refer to an ID removed from a later catalog.
  assert.equal(draw(facts("general"),{...options,previousId:"retired-id",previousText:a.text}).verse.id,b.id);
});
test("새 고민에서는 최근 5번을 피하고 모두 최근이면 후보를 다시 허용한다", () => {
  const analysis = facts("schedule", ["deadline_today", "unfinished_duty"]);
  const a = verseId("MAT.6.34"), b = verseId("ECC.3.13");
  assert.deepEqual(draw(analysis, { recentIds: [a] }).candidateIds, [b]);
  assert.deepEqual(draw(analysis, { recentIds: [a, b] }).candidateIds, [a, b]);
});
test("재뽑기는 최근 후보밖에 없어도 직전 말씀을 다시 주지 않는다", () => {
  const a = verseId("MAT.6.34"), b = verseId("ECC.3.13");
  assert.equal(draw(facts("schedule", ["deadline_today", "unfinished_duty"]), { previousId: a, recentIds: [a, b] }).verse.id, b);
});
test("첫 후보가 하나뿐이면 재뽑기에서 검수한 확장 후보로 넓힌다", () => {
  const selected = draw(facts("schedule", ["misses_people"]), { previousId: verseId("LUK.12.34") });
  assert.equal(selected.stage, 1);
  assert(!selected.candidateIds.includes(verseId("LUK.12.34")));
  assert(selected.candidateIds.length > 0);
});
test("명시 조건을 찾지 못해도 다른 말씀을 뽑을 수 있다", () => {
  for (const previousId of baseIds) assert.notEqual(draw(facts("general"), { previousId }).verse.id, previousId);
});
test("실제 돈 기한과 거래 약속은 가격·속도 후보의 자격을 바꾼다", () => {
  const sale = rules.find(rule => rule.id === "sale-price-speed")!;
  assert(matchesRule(facts("sale", ["sell_faster"]), sale));
  assert(!matchesRule(facts("sale", ["sell_faster", "cash_deadline"]), sale));
  assert(!matchesRule(facts("sale", ["sell_faster", "prior_promise"]), sale));
});
test("이미 부드럽게 말해봤다면 첫 사과 후보로 반복해서 보내지 않는다", () => {
  const apology = rules.find(rule => rule.id === "relationship-apology")!;
  assert(!matchesRule(facts("relationship", ["regrets_words", "already_tried_gentle"]), apology));
});
test("본문이 없는 ID나 보류한 어려운 구절은 운영 후보에 들어가지 않는다", () => {
  const available = new Set(verses.map(verse => verse.id));
  const active = [...baseIds, ...rules.flatMap(rule => [...rule.verseIds, ...rule.expansionIds])];
  for (const id of active) assert(available.has(id));
  assert(!active.includes(verseId("PRO.20.18")));
  assert(!active.includes(verseId("PRO.25.15")));
});
