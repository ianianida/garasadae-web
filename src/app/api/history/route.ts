import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/http";
import { currentUser, getAdminDb } from "@/lib/supabase-server";
import { verifyTicket } from "@/lib/tickets";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request, false);
    if (!user) return Response.json({ saved: false });
    const { ticket } = await readJson(request, z.object({ ticket: z.string().max(25000) }));
    const draw = verifyTicket(ticket);
    const { error } = await getAdminDb().from("garasadae_history").upsert({ draw_id: draw.id, user_id: user.id, verse_id: draw.verse.id }, { onConflict: "draw_id", ignoreDuplicates: true });
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json({ saved: true });
  } catch (error) { return apiError(error); }
}
