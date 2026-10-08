import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { verifyTicket } from "../src/lib/tickets";
import { GET as exportFeedback } from "../src/app/api/admin/feedback/route";
import { ANALYSIS_VERSION } from "../src/lib/concern-analysis";

const origin = process.env.VERIFY_SITE_URL ?? "http://localhost:3000";
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(dbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const checks: string[] = [];
const users: {id:string;email:string;password:string;token:string}[] = [];
let drawId: string | undefined;
const retain = process.argv.includes("--retain-users");
let completed = false;
async function api(path: string, method = "GET", data?: unknown, token?: string) {
  const response = await fetch(origin + path, { method, headers: { Origin: origin, "Content-Type":"application/json", ...(token ? {Authorization:`Bearer ${token}`} : {}) }, ...(data === undefined ? {} : {body:JSON.stringify(data)}) });
  const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return {status:response.status,body};
}
function checked(name: string) { checks.push(name); console.log(JSON.stringify({check:name,passed:true})); }

async function main() {
  try {
    for (const suffix of ["a","b"]) {
      const email = `garasadae-qa-${randomUUID()}-${suffix}@example.com`, password = randomBytes(30).toString("base64url");
      const created = await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{qa_only:true}});
      if (created.error || !created.data.user) throw new Error("QA_USER_CREATE_FAILED");
      const client = createClient(dbUrl, publicKey, {auth:{persistSession:false,autoRefreshToken:false}});
      const signed = await client.auth.signInWithPassword({email,password});
      if (signed.error || !signed.data.session) throw new Error("QA_LOGIN_FAILED");
      users.push({id:created.data.user.id,email,password,token:signed.data.session.access_token});
    }
    checked("실제 이메일·비밀번호 인증");
    const first = await api("/api/draw", "POST", {concern:"평소 관심 없던 헤드폰이 오늘까지만 할인한다. 이미 쓰는 헤드폰이 있는데 새것을 자주 쓸지는 모르겠다. 할인을 놓치기는 아깝다.",recentIds:[]}, users[0].token);
    assert.equal(first.status, 200);
    const draw = first.body; drawId = draw.id;
    const data = verifyTicket(draw.ticket);
    assert.equal(data.metadata.analysisMode, ANALYSIS_VERSION);
    assert(data.analysis.facts.some(f => f.key === "use_uncertain" && f.state === "yes"));
    assert(data.metadata.candidateIds.includes(draw.verse.id));
    assert(!JSON.stringify(draw).includes("matchedRuleIds"));
    checked("실제 AI 해석 → 검수 후보 → 말씀 결과");
    const redraw = await api("/api/draw", "POST", {concern:draw.concern,recentIds:[draw.verse.id],previousTicket:draw.ticket}, users[0].token);
    assert.equal(redraw.status, 200); assert.notEqual(redraw.body.verse.id, draw.verse.id);
    assert.equal(verifyTicket(redraw.body.ticket).metadata.inputTokens, 0);
    checked("재뽑기의 다른 말씀과 AI 재호출 생략");
    const saved = await api("/api/records", "POST", {ticket:draw.ticket,thought:"QA: 잠시 미루기로 했다.",afterword:"QA: 공개하지 않을 후일담"}, users[0].token);
    assert.equal(saved.status, 200);
    const own = await api("/api/records", "GET", undefined, users[0].token);
    assert(own.body.some((r: {id:string}) => r.id === draw.id));
    checked("본인 계정 기록 저장·동기화");
    const other = await api("/api/records", "GET", undefined, users[1].token);
    assert(!other.body.some((r: {id:string}) => r.id === draw.id));
    const theft = await api("/api/records", "POST", {ticket:draw.ticket,thought:"다른 계정",afterword:""}, users[1].token);
    assert.equal(theft.status, 404);
    const otherPatch = await api("/api/records", "PATCH", {id:draw.id,thought:"변조",afterword:""}, users[1].token);
    assert.equal(otherPatch.status, 404);
    checked("다른 계정 조회·수정·티켓 재사용 차단");
    const anonymous = createClient(dbUrl, publicKey, {auth:{persistSession:false,autoRefreshToken:false}});
    const anonymousRecords = await anonymous.from("garasadae_records").select("id");
    assert(anonymousRecords.error || anonymousRecords.data?.length === 0);
    const outsider = createClient(dbUrl, publicKey, {auth:{persistSession:false,autoRefreshToken:false}});
    await outsider.auth.signInWithPassword({email:users[1].email,password:users[1].password});
    const rls = await outsider.from("garasadae_records").select("id").eq("id", draw.id);
    assert(!rls.error); assert.equal(rls.data.length, 0);
    const hiddenFeedback = await outsider.from("garasadae_feedback").select("draw_id");
    assert(hiddenFeedback.error || hiddenFeedback.data?.length === 0);
    checked("Supabase 직접 접근의 RLS·피드백 비공개");
    const share = await api("/api/share", "POST", {id:draw.id,enabled:true}, users[0].token);
    assert.equal(share.status, 200);
    const token = share.body.shareToken;
    assert.equal(typeof token, "string");
    const publicPage = await api(`/s/${token}`);
    assert.equal(publicPage.status, 200); assert(publicPage.body.includes("QA: 잠시 미루기로 했다."));
    assert(!publicPage.body.includes("공개하지 않을 후일담"));
    assert(!publicPage.body.includes(users[0].email)); assert(!publicPage.body.includes(draw.ticket));
    const otherShare = await api("/api/share", "POST", {id:draw.id,enabled:false}, users[1].token);
    assert.equal(otherShare.status, 404);
    checked("선택 기록 공개·후일담과 이메일 제외·다른 계정 공유 변경 차단");
    const closed = await api("/api/share", "POST", {id:draw.id,enabled:false}, users[0].token);
    assert.equal(closed.status, 200); assert.equal((await api(`/s/${token}`)).status, 404);
    checked("공유 취소 즉시 접근 차단");
    assert.equal((await api("/api/feedback", "POST", {ticket:draw.ticket,experience:"enough",note:"QA_ONLY_DELETE_BEFORE_LAUNCH"})).status,200);
    const nonAdmin = await api("/api/admin/feedback", "GET", undefined, users[1].token);
    assert.equal(nonAdmin.status,404);
    // Positive export guard is tested in this isolated process, never widening the running site's whitelist.
    const actualAdminEmails = process.env.ADMIN_EMAILS;
    const actualAdminIds = process.env.ADMIN_USER_IDS;
    process.env.ADMIN_EMAILS = users[0].email;
    process.env.ADMIN_USER_IDS = users[0].id;
    try {
      const exported = await exportFeedback(new Request(origin + "/api/admin/feedback", {headers:{authorization:`Bearer ${users[0].token}`}}));
      assert.equal(exported.status,200);
      const payload = await exported.json();
      assert(JSON.stringify(payload).includes(draw.id));
    } finally { process.env.ADMIN_EMAILS = actualAdminEmails; process.env.ADMIN_USER_IDS = actualAdminIds; }
    checked("피드백 수집·비관리자 차단·관리자 내보내기 처리");
    const untrustedOrigin = await fetch(origin+"/api/records", {method:"DELETE",headers:{Origin:"https://example.org","Content-Type":"application/json",Authorization:`Bearer ${users[0].token}`},body:JSON.stringify({id:draw.id})});
    assert.equal(untrustedOrigin.status,403);
    assert.equal((await api("/api/records", "DELETE", {id:draw.id}, users[0].token)).status,200);
    checked("외부 Origin 변경 요청 차단·본인 기록 삭제");
    await mkdir(".local/verification",{recursive:true});
    if (retain) await writeFile(".local/verification/qa-users.json", JSON.stringify(users.map(({token,...u})=>u)));
    await writeFile(".local/verification/service-checks.json", JSON.stringify({at:new Date().toISOString(),origin,checks,syntheticOnly:true},null,2));
    completed = true;
  } finally {
    if (drawId) { const cleaned = await admin.from("garasadae_feedback").delete().eq("draw_id",drawId); if (cleaned.error) throw new Error("QA_FEEDBACK_CLEANUP_FAILED"); }
    if (!retain || !completed) for (const user of users) { const deleted = await admin.auth.admin.deleteUser(user.id); if (deleted.error) throw new Error("QA_USER_CLEANUP_FAILED"); }
  }
}
main().catch(error=>{console.error(JSON.stringify({check:"service",passed:false,message:error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.message : "unknown"}));process.exitCode=1;});
