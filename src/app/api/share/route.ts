import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/http";
import { currentUser, getAdminDb } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = (await currentUser(request))!;
    const input = await readJson(request, z.object({ id: z.uuid(), enabled: z.boolean() }));
    const db = getAdminDb();
    const existing = await db.from("garasadae_records").select("share_token").eq("id", input.id).eq("user_id", user.id).maybeSingle();
    if (existing.error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    if (!existing.data) throw new Error("NOT_FOUND");
    const token = input.enabled ? (existing.data.share_token ?? randomBytes(24).toString("base64url")) : null;
    const { error } = await db.from("garasadae_records").update({ share_token: token }).eq("id", input.id).eq("user_id", user.id);
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json({ shareToken: token });
  } catch (error) { return apiError(error); }
}
