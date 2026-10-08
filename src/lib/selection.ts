import { randomInt } from "node:crypto";
import type { CandidateRule, ConcernFacts, FactKey, Verse } from "./types";

export const SELECTION_VERSION = "rules-2026-10-08-v2";

export function verseFingerprint(text: string): string {
  return text.normalize("NFC").replace(/[\s\p{P}]/gu, "");
}

export function confirmedFacts(analysis: ConcernFacts): Set<FactKey> {
  return new Set(analysis.facts.filter(f => f.state === "yes" && f.evidence.length > 0).map(f => f.key));
}

export function matchesRule(analysis: ConcernFacts, rule: CandidateRule): boolean {
  if (!rule.domains.includes(analysis.domain)) return false;
  const facts = confirmedFacts(analysis);
  return (rule.all?.every(k => facts.has(k)) ?? true)
    && (rule.any?.some(k => facts.has(k)) ?? true)
    && !(rule.exclude?.some(k => facts.has(k)) ?? false);
}

export function selectVerse(options: {
  analysis: ConcernFacts;
  verses: Verse[];
  rules: CandidateRule[];
  baseIds: string[];
  recentIds: string[];
  previousId?: string;
  previousText?: string;
  chooseIndex?: (max: number) => number;
}) {
  const { analysis, verses, rules, recentIds, previousId, previousText, baseIds } = options;
  const available = new Map(verses.map(v => [v.id, v]));
  const priorText = previousText ?? (previousId ? available.get(previousId)?.text : undefined);
  const priorFingerprint = priorText === undefined ? undefined : verseFingerprint(priorText);
  const matched = rules.filter(r => matchesRule(analysis, r));
  const primary = matched.flatMap(r => r.verseIds);
  const expanded = matched.flatMap(r => r.expansionIds);
  const stages = [primary, [...primary, ...expanded], baseIds];
  let pool: string[] = [];
  let stage = 0;
  for (let index = 0; index < stages.length; index++) {
    const seenText = new Set<string>();
    const distinct = [...new Set(stages[index])].filter(id => {
      const verse = available.get(id);
      if (!verse || id === previousId) return false;
      const fingerprint = verseFingerprint(verse.text);
      if (fingerprint === priorFingerprint || seenText.has(fingerprint)) return false;
      seenText.add(fingerprint);
      return true;
    });
    if (distinct.length) { pool = distinct; stage = index; break; }
  }
  if (!pool.length) throw new Error("Reviewed candidate pool must contain another distinct verse.");
  // Recent avoidance happens after eligibility. Redraw's previous verse never returns.
  const recent = new Set(recentIds.slice(0, 5));
  const recentText = new Set([...recent].flatMap(id => {
    const verse = available.get(id);
    return verse ? [verseFingerprint(verse.text)] : [];
  }));
  const unseen = pool.filter(id => !recent.has(id) && !recentText.has(verseFingerprint(available.get(id)!.text)));
  if (unseen.length) pool = unseen;
  const chosen = (options.chooseIndex ?? randomInt)(pool.length);
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= pool.length) throw new Error("Invalid random index.");
  return {
    verse: available.get(pool[chosen])!,
    candidateIds: pool,
    matchedRuleIds: matched.map(r => r.id),
    stage,
    version: SELECTION_VERSION
  };
}
