import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/http";
import { currentUser, getAdminDb, takeQuota } from "@/lib/supabase-server";
import { analyzeConcern } from "@/lib/concern-analysis";
import { selectVerse } from "@/lib/selection";
import { issueTicket, verifyTicket, type TicketData } from "@/lib/tickets";
import { rules, baseIds } from "@/data/rules";
import { verses } from "@/data/verses";

export const runtime = "nodejs";
export const maxDuration = 30;
const schema = z.object({ concern: z.string().trim().min(3).max(2000), recentIds: z.array(z.string().max(50)).max(5), previousTicket: z.string().max(25000).optional() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readJson(request, schema);
    const secret = process.env.DRAW_SIGNING_SECRET;
    if (!secret || secret.length < 32) throw new Error("SERVICE_CONFIGURATION_MISSING");
    const fingerprint = createHmac("sha256", secret).update(request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").digest("hex");
    if (!await takeQuota(`draw:${fingerprint}:${Math.floor(Date.now()/60000)}`, 8)) throw new Error("RATE_LIMITED");
    const user = await currentUser(request, false);
    let recentIds = input.recentIds;
    if (user) {
      const history = await getAdminDb().from("garasadae_history").select("verse_id").eq("user_id", user.id).order("displayed_at", { ascending: false }).limit(5);
      if (history.error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
      if (history.data.length) recentIds = history.data.map(row => row.verse_id);
    }
    const previous = input.previousTicket ? verifyTicket(input.previousTicket) : null;
    if (previous && previous.concern !== input.concern) throw new Error("INVALID_INPUT");
    let analyzed;
    if (previous) {
      analyzed = { analysis: previous.analysis, analysisMode: previous.metadata.analysisMode, model: previous.metadata.model, durationMs: 0, inputTokens: 0, outputTokens: 0 };
    } else {
      const configuredLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT ?? "200");
      const limit = Number.isInteger(configuredLimit) && configuredLimit >= 0 ? configuredLimit : 0;
      const allowAI = limit > 0 && await takeQuota(`ai-day:${new Date().toISOString().slice(0, 10)}`, limit);
      analyzed = await analyzeConcern(input.concern, allowAI);
    }
    const selected = selectVerse({ analysis: analyzed.analysis, verses, rules, baseIds, recentIds, previousId: previous?.verse.id, previousText: previous?.verse.text });
    const createdAt = new Date().toISOString();
    const data: TicketData = {
      id: randomUUID(), concern: input.concern, verse: selected.verse, createdAt, analysis: analyzed.analysis,
      metadata: {
        version: selected.version, candidateIds: selected.candidateIds, matchedRuleIds: selected.matchedRuleIds, stage: selected.stage,
        analysisMode: analyzed.analysisMode, model: analyzed.model, durationMs: analyzed.durationMs,
        inputTokens: analyzed.inputTokens, outputTokens: analyzed.outputTokens, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null
      }
    };
    // Only the actual verse is presented. No AI interpretation, verdict or fit score.
    return Response.json({ id: data.id, concern: data.concern, verse: { ...data.verse, context: "" }, createdAt, ticket: issueTicket(data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
