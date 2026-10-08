import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;
export function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SERVICE_CONFIGURATION_MISSING");
  return admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function currentUser(request: Request, required = true) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) { if (required) throw new Error("LOGIN_REQUIRED"); return null; }
  const { data, error } = await getAdminDb().auth.getUser(token);
  if (error || !data.user) { if (required) throw new Error("LOGIN_REQUIRED"); return null; }
  return data.user;
}

export async function takeQuota(bucket: string, limit: number) {
  const { data, error } = await getAdminDb().rpc("garasadae_take_quota", { p_bucket: bucket, p_limit: limit });
  if (error) throw new Error("SERVICE_DATABASE_UNAVAILABLE");
  return data === true;
}
