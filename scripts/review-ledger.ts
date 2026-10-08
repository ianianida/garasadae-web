import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const CRITERIA_VERSION = "garasadae-corpus-2026-10-08-v1";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.object({
  id: z.string(), code: z.string(), book: z.string(), chapter: z.number().int().positive(),
  verse: z.number().int().positive(), text: z.string(), textSha256: sha256,
  translation: z.literal("개역한글"), sourceUrl: z.string().url(), emptySlot: z.boolean()
});
const manifestSchema = z.object({
  corpusSha256: sha256, verseSlots: z.literal(31102), bookCount: z.literal(66),
  chapterCount: z.literal(1189), textEntries: z.literal(31089),
  books: z.array(z.object({ code: z.string(), book: z.string(), slots: z.number().int().positive() })).length(66)
});
const scenarioSchema = z.object({ id: z.string().min(1), concern: z.string().min(8), source: z.literal("synthetic") });
export const connectionSchema = z.object({
  scenarioId: z.string().min(1), clue: z.string().min(3), friction: z.string(),
  expectedEnough: z.enum(["yes", "uncertain", "no"])
});
export const entrySchema = z.object({
  id: z.string(), textSha256: sha256, status: z.enum(["candidate", "hold", "exclude"]),
  reason: z.string().min(8), contextNote: z.string().min(3),
  readability: z.enum(["clear", "thinkable", "needs_explanation"]),
  connections: z.array(connectionSchema)
});
const bookSchema = z.object({
  bookCode: z.string(), corpusSha256: sha256, criteriaVersion: z.literal(CRITERIA_VERSION),
  reviewer: z.string().min(3), method: z.literal("direct-codex-reading"), entries: z.array(z.unknown())
});
export type ReviewEntry = z.infer<typeof entrySchema>;
export type SourceVerse = z.infer<typeof sourceSchema>;

async function json(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")); }
export async function loadReviewLedger(root = process.cwd()) {
  const errors: string[] = [];
  const rawSource = await readFile(join(root, "data/source/krv-full.json"));
  const manifest = manifestSchema.parse(await json(join(root, "data/source/krv-manifest.json")));
  const source = z.array(sourceSchema).parse(JSON.parse(rawSource.toString("utf8")));
  if (hash(rawSource) !== manifest.corpusSha256) errors.push("작업용 본문 파일의 전체 해시가 manifest와 다름");
  const sourceById = new Map(source.map(item => [item.id, item]));
  if (source.length !== manifest.verseSlots || sourceById.size !== source.length) errors.push("원문 절 번호 수 또는 중복 불일치");
  for (const row of source) if (hash(row.text) !== row.textSha256) errors.push(`${row.id}: 원문 본문 해시 불일치`);
  const scenarios = new Map<string, z.infer<typeof scenarioSchema>>();
  const reviewRoot = join(root, "data/review");
  for (const filename of (await readdir(reviewRoot)).filter(name => /^scenarios(?:-.+)?\.json$/.test(name))) {
    const parsed = z.array(scenarioSchema).safeParse(await json(join(reviewRoot, filename)));
    if (!parsed.success) { errors.push(`${filename}: 생성 고민 형식 오류`); continue; }
    for (const item of parsed.data) {
      if (scenarios.has(item.id)) errors.push(`${filename}: 중복 생성 고민 ID ${item.id}`);
      scenarios.set(item.id, item);
    }
  }
  const entries = new Map<string, ReviewEntry>();
  const summaries = [];
  for (const book of manifest.books) {
    const counts = { candidate: 0, hold: 0, exclude: 0 };
    const seen = new Set<string>();
    let raw: unknown;
    try { raw = await json(join(reviewRoot, "books", `${book.code}.json`)); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) errors.push(`${book.code}: 원장을 읽을 수 없음`);
      summaries.push({ code: book.code, book: book.book, total: book.slots, stored: 0, pending: book.slots, ...counts });
      continue;
    }
    const parsed = bookSchema.safeParse(raw);
    if (!parsed.success || parsed.data.bookCode !== book.code || parsed.data.corpusSha256 !== manifest.corpusSha256) {
      errors.push(`${book.code}: 원장 메타데이터·판본 해시 오류`);
      summaries.push({ code: book.code, book: book.book, total: book.slots, stored: 0, pending: book.slots, ...counts });
      continue;
    }
    for (let index = 0; index < parsed.data.entries.length; index++) {
      const parsedEntry = entrySchema.safeParse(parsed.data.entries[index]);
      if (!parsedEntry.success) { errors.push(`${book.code} 항목 ${index + 1}: 개별 판단 형식 오류`); continue; }
      const entry = parsedEntry.data;
      const original = sourceById.get(entry.id);
      let valid = true;
      const fail = (reason: string) => { valid = false; errors.push(`${entry.id}: ${reason}`); };
      if (!original || original.code !== book.code) fail("배정 책의 원문 절 번호가 아님");
      if (seen.has(entry.id) || entries.has(entry.id)) fail("중복 판정");
      seen.add(entry.id);
      if (original && entry.textSha256 !== original.textSha256) fail("검수한 본문 해시가 현재 원문과 다름");
      if (original?.emptySlot && entry.status !== "exclude") fail("본문 없는 절은 도입 불가");
      if (entry.connections.some(pair => !scenarios.has(pair.scenarioId))) fail("존재하지 않는 구체 고민 연결");
      if (entry.status === "candidate" && !entry.connections.some(pair => pair.expectedEnough === "yes")) fail("충분할 것으로 판단한 구체 고민 연결이 없음");
      if (valid) { entries.set(entry.id, entry); counts[entry.status]++; }
    }
    const stored = Object.values(counts).reduce((sum, count) => sum + count, 0);
    summaries.push({ code: book.code, book: book.book, total: book.slots, stored, pending: book.slots - stored, ...counts });
  }
  return { manifest, source, sourceById, scenarios, entries, summaries, errors };
}

// These checks establish ledger consistency, not whether a reviewer really read
// a passage or whether a real person will be satisfied. Those require review.
