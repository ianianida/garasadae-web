import { z } from "zod";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const internalUrl = new URL(request.url);
  // Next can construct an internal URL with 0.0.0.0 behind a local/proxy server.
  // Host is the addressed site; forwarded host supplied by a client is never used.
  const host = request.headers.get("host") ?? internalUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? `${forwardedProtocol}:` : internalUrl.protocol;
  let expected: string;
  try { expected = new URL(`${protocol}//${host}`).origin; } catch { throw new Error("INVALID_ORIGIN"); }
  if (!origin || origin !== expected) throw new Error("INVALID_ORIGIN");
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("INVALID_INPUT");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > 32768) throw new Error("INVALID_INPUT");
  const raw = await request.text();
  if (raw.length > 32768) throw new Error("INVALID_INPUT");
  try { return schema.parse(JSON.parse(raw)); } catch { throw new Error("INVALID_INPUT"); }
}

export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "LOGIN_REQUIRED") return Response.json({ error: "로그인하면 기록을 이어갈 수 있어요." }, { status: 401 });
  if (code === "INVALID_INPUT" || code === "INVALID_REQUEST" || code === "INVALID_TICKET") return Response.json({ error: "입력 내용을 확인해 주세요. 오래된 결과라면 말씀을 다시 만나주세요." }, { status: 400 });
  if (code === "INVALID_ORIGIN") return Response.json({ error: "요청을 확인할 수 없어요." }, { status: 403 });
  if (code === "NOT_FOUND") return Response.json({ error: "기록을 찾을 수 없어요." }, { status: 404 });
  if (code === "RATE_LIMITED") return Response.json({ error: "잠시 숨을 고르고, 조금 뒤에 다시 만나주세요." }, { status: 429, headers: { "Retry-After": "60" } });
  // Never log concern text, tokens, provider responses or database credentials.
  console.error("garasadae_request_failed", code.startsWith("SERVICE_") ? code : "REQUEST_FAILED");
  return Response.json({ error: "연결이 잠시 어려워요. 조금 뒤에 다시 시도해 주세요." }, { status: 503 });
}
