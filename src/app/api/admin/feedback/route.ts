import { apiError } from "@/lib/http";
import { currentUser, getAdminDb } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = (await currentUser(request))!;
    const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
    const allowedIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
    // Auto-confirmed email signups do not prove ownership of the claimed address.
    if (!user.email || !allowedIds.includes(user.id) || !allowed.includes(user.email.toLowerCase())) throw new Error("NOT_FOUND");
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("INVALID_REQUEST");
    const { data, error } = await getAdminDb().from("garasadae_feedback").select("*").order("submitted_at", { ascending: false }).order("draw_id").range(offset, offset + 99);
    if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
    return Response.json({ schemaVersion: 1, source: "live_service", feedback: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
