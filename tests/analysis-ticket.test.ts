import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { sanitizeAnalysis, fallbackAnalysis } from "../src/lib/concern-analysis";
import { issueTicket, verifyTicket, type TicketData } from "../src/lib/tickets";
import { verses } from "../src/data/verses";

test("원문에 없는 근거나 서로 충돌하는 조건을 확정하지 않는다", () => {
  const raw = fallbackAnalysis();
  raw.facts = [
    { key: "financial_shortage", state: "yes", evidence: "돈이 부족하다" },
    { key: "recent_purchase", state: "yes", evidence: "최근에도 옷을 샀다" },
    { key: "recent_purchase", state: "no", evidence: "최근에도 옷을 샀다" }
  ];
  const sanitized = sanitizeAnalysis(raw, "최근에도 옷을 샀다. 비싼 옷이 갖고 싶다.");
  assert.equal(sanitized.facts.find(f => f.key === "financial_shortage")!.state, "unknown");
  assert.equal(sanitized.facts.find(f => f.key === "recent_purchase")!.state, "unknown");
});
test("원문의 직접 부정과 미언급은 구분한다", () => {
  const raw = fallbackAnalysis();
  raw.facts = [{ key: "cash_deadline", state: "no", evidence: "당장 돈이 필요한 것은 아니다" }];
  const sanitized = sanitizeAnalysis(raw, "카메라를 팔까? 당장 돈이 필요한 것은 아니다.");
  assert.equal(sanitized.facts.find(f => f.key === "cash_deadline")!.state, "no");
  assert.equal(sanitized.facts.find(f => f.key === "financial_shortage")!.state, "unknown");
});

process.env.DRAW_SIGNING_SECRET = randomBytes(48).toString("base64url");
const ticketData = (date = new Date().toISOString()): TicketData => ({
  id: randomUUID(), concern: "QA 전용 가상 고민", verse: verses[0], createdAt: date, analysis: fallbackAnalysis(),
  metadata: { version: "test", candidateIds: [verses[0].id], matchedRuleIds: [], stage: 2, analysisMode: "test", model: null, durationMs: 0, inputTokens: 0, outputTokens: 0, commit: null }
});
test("브라우저용 티켓은 고민 조건을 평문으로 노출하지 않고 원본을 보존한다", () => {
  const data = ticketData(), token = issueTicket(data);
  assert.deepEqual(verifyTicket(token), data);
  assert(!Buffer.from(token.split(".")[1], "base64url").toString("utf8").includes(data.concern));
  assert.notEqual(issueTicket(data), token);
});
test("티켓을 바꾸거나 다른 비밀 키로 읽으면 저장·재뽑기에 사용하지 못한다", () => {
  const token = issueTicket(ticketData()), packed = Buffer.from(token.split(".")[1], "base64url");
  packed[32] ^= 1;
  assert.throws(() => verifyTicket(`v1.${packed.toString("base64url")}`), /INVALID_TICKET/);
  const secret = process.env.DRAW_SIGNING_SECRET;
  try { process.env.DRAW_SIGNING_SECRET = randomBytes(48).toString("base64url"); assert.throws(() => verifyTicket(token), /INVALID_TICKET/); }
  finally { process.env.DRAW_SIGNING_SECRET = secret; }
});
test("만료되거나 미래 날짜인 티켓을 거부한다", () => {
  assert.throws(() => verifyTicket(issueTicket(ticketData(new Date(Date.now() - 31 * 86400000).toISOString()))), /INVALID_TICKET/);
  assert.throws(() => verifyTicket(issueTicket(ticketData(new Date(Date.now() + 120000).toISOString()))), /INVALID_TICKET/);
});
