import { createHmac } from "node:crypto";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/http";
import { getAdminDb, takeQuota } from "@/lib/supabase-server";
import { verifyTicket } from "@/lib/tickets";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readJson(request, z.object({ ticket: z.string().max(25000), experience: z.enum(["enough", "uncertain", "miss"]), note: z.string().max(1500) }));
    const draw = verifyTicket(input.ticket);
    const fingerprint = createHmac("sha256", process.env.DRAW_SIGNING_SECRET!).update(request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").digest("hex");
    if (!await takeQuota(`feedback:${fingerprint}:${Math.floor(Date.now()/60000)}`, 12)) throw new Error("RATE_LIMITED");
    const { error } = await getAdminDb().from("garasadae_feedback").insert({
      draw_id: draw.id, concern: draw.concern, verse_id: draw.verse.id, verse_snapshot: draw.verse,
      analysis: draw.analysis, selection_metadata: draw.metadata,
      experience: input.experience, note: input.note, drawn_at: draw.createdAt, source: "live_service"
    });
    if (error && error.code !== "23505") throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json({ received: true });
  } catch (error) { return apiError(error); }
}
