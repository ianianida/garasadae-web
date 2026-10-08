import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/http";
import { currentUser, getAdminDb } from "@/lib/supabase-server";
import { verifyTicket } from "@/lib/tickets";

export const dynamic = "force-dynamic";
const thoughts = { thought: z.string().max(2000), afterword: z.string().max(3000) };
const saveSchema = z.object({ ticket: z.string().max(25000), ...thoughts });
const updateSchema = z.object({ id: z.uuid(), ...thoughts });
const idSchema = z.object({ id: z.uuid() });

export async function GET(request: Request) {
  try {
    const user = (await currentUser(request))!;
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("INVALID_REQUEST");
    const { data, error } = await getAdminDb().from("garasadae_records").select("id,concern,verse_snapshot,created_at,thought,afterword,share_token").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(offset, offset + 99);
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json(data.map(row => ({ id: row.id, concern: row.concern, verse: row.verse_snapshot, createdAt: row.created_at, thought: row.thought, afterword: row.afterword, shareToken: row.share_token, ticket: "" })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = (await currentUser(request))!;
    const input = await readJson(request, saveSchema);
    const draw = verifyTicket(input.ticket);
    const { error } = await getAdminDb().from("garasadae_records").insert({
      id: draw.id, user_id: user.id, concern: draw.concern, verse_id: draw.verse.id,
      verse_snapshot: draw.verse, thought: input.thought, afterword: input.afterword,
      created_at: draw.createdAt, selection_version: draw.metadata.version,
      updated_at: new Date().toISOString()
    });
    if (error?.code === "23505") {
      // A ticket may be replayed. Only its existing owner may update the record.
      const updated = await getAdminDb().from("garasadae_records").update({
        thought: input.thought, afterword: input.afterword, updated_at: new Date().toISOString()
      }).eq("id", draw.id).eq("user_id", user.id).select("id").maybeSingle();
      if (updated.error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
      if (!updated.data) throw new Error("NOT_FOUND");
    } else if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json({ saved: true });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = (await currentUser(request))!;
    const input = await readJson(request, updateSchema);
    const { data, error } = await getAdminDb().from("garasadae_records").update({ thought: input.thought, afterword: input.afterword, updated_at: new Date().toISOString() }).eq("id", input.id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    if (!data) throw new Error("NOT_FOUND");
    return Response.json({ saved: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = (await currentUser(request))!;
    const input = await readJson(request, idSchema);
    const { data, error } = await getAdminDb().from("garasadae_records").delete().eq("id", input.id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    if (!data) throw new Error("NOT_FOUND");
    return Response.json({ deleted: true });
  } catch (error) { return apiError(error); }
}
