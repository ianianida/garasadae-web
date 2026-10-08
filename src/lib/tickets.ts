import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { ConcernFacts, Verse } from "./types";

export type TicketData = {
  id: string;
  concern: string;
  verse: Verse;
  createdAt: string;
  analysis: ConcernFacts;
  metadata: { version: string; candidateIds: string[]; matchedRuleIds: string[]; stage: number; analysisMode: string; model: string | null; durationMs: number; inputTokens: number; outputTokens: number; commit: string | null };
};

function signingSecret() {
  const secret = process.env.DRAW_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error("SERVICE_CONFIGURATION_MISSING");
  return secret;
}
function encryptionKey() { return createHash("sha256").update(signingSecret()).digest(); }
export function issueTicket(data: TicketData) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(data)));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
}
export function verifyTicket(ticket: string): TicketData {
  if (ticket.length > 25000) throw new Error("INVALID_TICKET");
  const [version, payload, extra] = ticket.split(".");
  if (version !== "v1" || !payload || extra) throw new Error("INVALID_TICKET");
  try {
    const packed = Buffer.from(payload, "base64url");
    if (packed.toString("base64url") !== payload) throw new Error();
    if (packed.length < 29) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const compressed = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
    const data = JSON.parse(inflateRawSync(compressed, { maxOutputLength: 131072 }).toString("utf8")) as TicketData;
    const age = Date.now() - new Date(data.createdAt).getTime();
    if (!Number.isFinite(age) || age < -60000 || age > 30 * 86400000) throw new Error();
    return data;
  } catch { throw new Error("INVALID_TICKET"); }
}
