"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, Copy, LogOut, Plus, RefreshCw, Share2, Sparkles, Trash2, X } from "lucide-react";
import { getBrowserDb } from "@/lib/supabase-browser";
import type { DrawResult, SavedRecord } from "@/lib/types";
import { verseReference } from "@/lib/verse-reference";

type FeedbackChoice = "enough" | "uncertain" | "miss";
type View = "draw" | "records";

async function request<T>(path: string, data?: unknown, session?: Session | null, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {})
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "잠시 후 다시 시도해 주세요.");
  return json;
}

export default function Garasadae() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("draw");
  const [concern, setConcern] = useState("");
  const [result, setResult] = useState<DrawResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thought, setThought] = useState("");
  const [afterword, setAfterword] = useState("");
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState<SavedRecord | null>(null);
  const [sharing, setSharing] = useState<SavedRecord | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackChoice | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const db = getBrowserDb();
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem("garasadae-draft-v1") ?? "null");
      if (draft && typeof draft.concern === "string") {
        setConcern(draft.concern.slice(0, 2000));
        if (draft.result?.id && draft.result?.verse?.text && draft.result?.ticket) setResult(draft.result);
        if (typeof draft.thought === "string") setThought(draft.thought.slice(0, 2000));
        if (typeof draft.afterword === "string") setAfterword(draft.afterword.slice(0, 3000));
      }
    } catch { /* A missing draft does not prevent drawing. */ }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem("garasadae-draft-v1", JSON.stringify({ concern, result, thought, afterword })); } catch { /* Private mode may disable browser storage. */ }
  }, [draftReady, concern, result, thought, afterword]);

  useEffect(() => {
    if (result && session) void request("/api/history", { ticket: result.ticket }, session).catch(() => {});
  }, [result, session]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("garasadae-recent-v1") ?? "[]");
      if (Array.isArray(stored)) setRecentIds(stored.filter(x => typeof x === "string").slice(0, 5));
    } catch { /* Missing local history does not prevent a draw. */ }
  }, []);

  const loadRecords = useCallback(async () => {
    if (!session) { setRecords([]); return; }
    setLoadingRecords(true);
    try { const page = await request<SavedRecord[]>("/api/records", undefined, session, "GET"); setRecords(page); setHasMoreRecords(page.length === 100); }
    catch (e) { setError((e as Error).message); }
    finally { setLoadingRecords(false); }
  }, [session]);

  useEffect(() => { if (view === "records") void loadRecords(); }, [view, loadRecords]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function draw(redraw = false) {
    if (busy || concern.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      const next = await request<DrawResult>("/api/draw", {
        concern: concern.trim(), recentIds,
        ...(redraw && result ? { previousTicket: result.ticket } : {})
      }, session);
      setResult(next); setThought(""); setAfterword(""); setSaved(false);
      setFeedback(null); setFeedbackNote(""); setFeedbackDone(false);
      const recent = [next.verse.id, ...recentIds].slice(0, 5);
      setRecentIds(recent);
      try { localStorage.setItem("garasadae-recent-v1", JSON.stringify(recent)); } catch { /* Draw remains usable. */ }
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveRecord() {
    if (!result) return;
    if (!session) { setAuthOpen(true); return; }
    setSaving(true); setError("");
    try {
      await request("/api/records", { ticket: result.ticket, thought, afterword }, session);
      setSaved(true); setNotice("이 순간을 기록했어요.");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function sendFeedback() {
    if (!result || !feedback || feedbackDone) return;
    setSaving(true); setError("");
    try {
      await request("/api/feedback", { ticket: result.ticket, experience: feedback, note: feedbackNote }, session);
      setFeedbackDone(true); setNotice("들려주셔서 고마워요.");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  function resetDraw() {
    setConcern(""); setResult(null); setThought(""); setAfterword(""); setError(""); setView("draw");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateRecord(record: SavedRecord, values: Record<string, unknown>) {
    setSaving(true); setError("");
    try {
      await request("/api/records", { id: record.id, ...values }, session, "PATCH");
      await loadRecords(); setEditing(null); setNotice("기록을 수정했어요.");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteRecord(record: SavedRecord) {
    if (!window.confirm("이 기록을 삭제할까요? 공유한 링크도 닫힙니다.")) return;
    try { await request("/api/records", { id: record.id }, session, "DELETE"); await loadRecords(); }
    catch (e) { setError((e as Error).message); }
  }

  return <>
    <header className="site-header">
      <button className="wordmark" onClick={resetDraw} aria-label="가라사대 첫 화면">가라사대<span className="wordmark-dot" /></button>
      <nav aria-label="메인 메뉴">
        <button className={view === "records" ? "nav-link active" : "nav-link"} onClick={() => { setView("records"); setError(""); }}><BookOpen size={16} /> 나의 기록</button>
        {session ? <button className="icon-button" aria-label="로그아웃" onClick={() => { void getBrowserDb()?.auth.signOut(); setNotice("로그아웃했어요."); }}><LogOut size={17} /></button>
          : <button className="nav-login" onClick={() => setAuthOpen(true)}>로그인</button>}
      </nav>
    </header>

    <main className="main-shell">
      {view === "draw" ? <>
        {!result && <section className="intro">
          <div className="eyebrow"><span /> 지금, 나에게 닿는 말씀</div>
          <h1>마음에 걸리는<br />갈림길이 있나요?</h1>
          <p>고민을 적고, 말씀 한 구절을 만나보세요.<br />생각지도 못한 실마리가 기다릴지 몰라요.</p>
          <div className="card-stack" aria-hidden="true"><div className="stack-paper paper-back" /><div className="stack-paper paper-mid" /><div className="stack-paper paper-front"><span className="paper-star">✳</span><span>오늘의 한 구절</span><span className="paper-line" /></div></div>
        </section>}

        {!result && <section className="concern-box">
          <label htmlFor="concern">지금 어떤 고민을 하고 있나요?</label>
          <textarea id="concern" placeholder="사고 싶은 옷이 있는데, 최근에도 옷을 사서 마음이 걸려요. 안 사면 아쉬울 것 같고요." maxLength={2000} value={concern} onChange={e => setConcern(e.target.value)} disabled={busy} />
          <div className="input-bottom"><span>짧게 적어도 괜찮아요.</span><span>{concern.length.toLocaleString()} / 2,000</span></div>
          <button className="primary draw-button" onClick={() => void draw()} disabled={concern.trim().length < 3 || busy}>{busy ? <><span className="loader" /> 말씀을 만나는 중</> : <>말씀 한 구절 뽑기 <ArrowRight size={19} /></>}</button>
          <p className="small-caption">가입 없이 바로 뽑을 수 있어요. <a href="/privacy" target="_blank" rel="noopener noreferrer">고민 처리 안내</a></p>
        </section>}

        {result && <section className="result-area" ref={resultRef} aria-live="polite">
          <div className="result-top"><span className="eyebrow"><span /> 오늘, 당신이 만난 말씀</span><time dateTime={result.createdAt}>{formatDate(result.createdAt)}</time></div>
          <article className="verse-card" key={result.id}>
            <span className="verse-ornament" aria-hidden="true">✳</span>
            <blockquote>{result.verse.text}</blockquote>
            <div className="verse-rule" />
            <a className="verse-reference" href={result.verse.sourceUrl} target="_blank" rel="noopener noreferrer">{verseReference(result.verse)} <ArrowDown size={13} className="external-arrow" /></a>
            <span className="translation">개역한글 · 대한성서공회</span>
          </article>
          <details className="original-concern"><summary>이 말씀을 만난 고민</summary><p>{result.concern}</p></details>

          <section className="thought-section">
            <label htmlFor="thought">어떤 생각이 닿았나요?</label><p>지금 떠오른 생각이나 결정을 한 줄 남겨보세요.</p>
            <textarea id="thought" value={thought} maxLength={2000} onChange={e => { setThought(e.target.value); setSaved(false); }} placeholder="이 말씀을 읽고 떠오른 내 생각…" rows={3} />
            <details className="afterword"><summary>나중의 이야기도 남기기 <Plus size={14} /></summary><textarea aria-label="후일담" value={afterword} maxLength={3000} onChange={e => { setAfterword(e.target.value); setSaved(false); }} placeholder="시간이 지난 뒤, 어떤 선택을 했고 어떻게 느꼈나요?" rows={3} /></details>
            <button className="primary" disabled={saving || saved} onClick={() => void saveRecord()}>{saved ? <><Check size={17} /> 기록했어요</> : saving ? "저장하는 중…" : <><BookOpen size={17} /> 이 순간 기록하기</>}</button>
            <p className="small-caption">기록은 나에게만 보여요. 로그인하면 다른 기기에서도 이어집니다.</p>
          </section>

          <section className="feedback-section">
            <h2>이 말씀, 지금의 나에게 어땠나요?</h2>
            {feedbackDone ? <p className="feedback-thanks"><Check size={16} /> 다음 만남을 위해 소중히 참고할게요.</p> : <>
              <div className="feedback-options" role="group" aria-label="말씀 경험 피드백">
                {([["enough", "실마리를 얻었어요"], ["uncertain", "조금 애매했어요"], ["miss", "연결이 어려웠어요"]] as const).map(([value, label]) => <button key={value} className={feedback === value ? "feedback-chip selected" : "feedback-chip"} aria-pressed={feedback === value} onClick={() => setFeedback(value)}>{label}</button>)}
              </div>
              {feedback && <div className="feedback-detail"><textarea aria-label="피드백 이유" maxLength={1500} rows={2} placeholder="그렇게 느낀 이유가 있다면 들려주세요. (선택)" value={feedbackNote} onChange={e => setFeedbackNote(e.target.value)} /><p>피드백을 보내면 이 고민과 말씀도 운영자에게 전달돼요.</p><button className="text-button" disabled={saving} onClick={() => void sendFeedback()}>피드백 보내기 <ArrowRight size={14} /></button></div>}
            </>}
          </section>
          <div className="result-actions"><button className="text-button" disabled={busy} onClick={() => void draw(true)}><RefreshCw size={15} className={busy ? "spinning" : ""} /> {busy ? "다른 말씀을 만나는 중…" : "다른 말씀 만나기"}</button><button className="text-button" disabled={busy} onClick={resetDraw}>새 고민 적기 <ArrowRight size={15} /></button></div>
        </section>}
      </> : <section className="records-area">
        <button className="text-button back-link" onClick={() => setView("draw")}><ArrowLeft size={15} /> 말씀 뽑으러 가기</button>
        <div className="eyebrow"><span /> 내 마음이 지나온 순간들</div><h1>나의 기록</h1><p className="records-subtitle">말씀을 만난 날, 마음에 남은 이야기를 다시 읽어요.</p>
        {!session ? <div className="empty-state"><BookOpen size={32} strokeWidth={1} /><h2>내 기록을 만나러 갈까요?</h2><p>로그인하면 기록을 저장하고<br />다른 기기에서도 이어볼 수 있어요.</p><button className="primary" onClick={() => setAuthOpen(true)}>로그인하고 이어보기 <ArrowRight size={17} /></button></div>
          : loadingRecords ? <p className="empty-state">기록을 불러오는 중…</p>
            : records.length === 0 ? <div className="empty-state"><Sparkles size={32} strokeWidth={1} /><h2>아직 첫 페이지가 비어 있어요.</h2><p>말씀을 뽑고 지금의 생각을 남겨보세요.</p><button className="primary" onClick={() => setView("draw")}>첫 말씀 만나기 <ArrowRight size={17} /></button></div>
              : <div className="record-list">{records.map(record => <article className="record-item" key={record.id}><time dateTime={record.createdAt}>{formatDate(record.createdAt)}</time><h2>{record.concern}</h2><blockquote>{record.verse.text}</blockquote><p className="record-reference">{verseReference(record.verse)}</p>{record.thought && <p className="record-thought">{record.thought}</p>}{record.afterword && <details><summary>그 후의 이야기</summary><p className="record-thought">{record.afterword}</p></details>}<div className="record-actions"><button className="text-button" onClick={() => setEditing(record)}>생각 수정</button><button className="text-button" onClick={() => setSharing(record)}><Share2 size={14} /> {record.shareToken ? "공유 관리" : "링크 공유"}</button><button className="icon-button" onClick={() => void deleteRecord(record)} aria-label="기록 삭제"><Trash2 size={15} /></button></div></article>)}</div>}
        {session && hasMoreRecords && <button className="text-button" disabled={loadingRecords} onClick={async () => {
          setLoadingRecords(true);
          try { const page = await request<SavedRecord[]>(`/api/records?offset=${records.length}`, undefined, session, "GET"); setRecords(old => [...old, ...page]); setHasMoreRecords(page.length === 100); }
          catch (e) { setError((e as Error).message); } finally { setLoadingRecords(false); }
        }}>이전 기록 더 보기</button>}
        {session && <button className="text-button export-link" onClick={async () => {
          try {
            const own: SavedRecord[] = [];
            for (let offset = 0; ; offset += 100) {
              const page = await request<SavedRecord[]>(`/api/records?offset=${offset}`, undefined, session, "GET");
              own.push(...page); if (page.length < 100) break;
            }
            downloadJson(own, "가라사대-나의기록.json"); setNotice("내 기록을 내려받았어요.");
          } catch (e) { setError((e as Error).message); }
        }}>내 기록 내려받기 <ArrowDown size={14} /></button>}
      </section>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </main>

    <footer className="site-footer"><span>가라사대</span><span>오늘의 말씀, 나의 이야기.</span><a href="/privacy">개인정보 안내</a></footer>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
    {authOpen && <AuthDialog close={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); setNotice("로그인했어요. 기록을 이어서 남겨보세요."); }} />}
    {editing && <EditDialog record={editing} saving={saving} close={() => setEditing(null)} submit={values => void updateRecord(editing, values)} />}
    {sharing && <ShareDialog record={sharing} session={session} close={() => setSharing(null)} onChanged={() => void loadRecords()} />}
  </>;
}

function Dialog({ children, title, close }: { children: React.ReactNode; title: string; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={close} aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={close}><X size={20} /></button></div>{children}</dialog>;
}

function AuthDialog({ close, onSuccess }: { close: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <Dialog close={close} title={mode === "login" ? "내 기록으로 이어가기" : "첫 기록을 위한 작은 시작"}>
    <p className="modal-intro">말씀을 만난 순간을, 나만의 기록으로.</p>
    <form onSubmit={async e => {
      e.preventDefault(); const db = getBrowserDb();
      if (!db) { setMessage("로그인 연결을 준비 중이에요. 잠시 후 다시 시도해 주세요."); return; }
      setBusy(true); setMessage("");
      try {
        const { data, error } = mode === "login" ? await db.auth.signInWithPassword({ email, password }) : await db.auth.signUp({ email, password });
        if (error) {
          if (error.code === "invalid_credentials") throw new Error("이메일과 비밀번호를 확인해 주세요.");
          if (error.code === "email_not_confirmed") throw new Error("가입 확인 메일을 먼저 열어 주세요.");
          if (error.code === "over_email_send_rate_limit" || error.code === "email_address_not_authorized") throw new Error("가입 메일 발송이 잠시 어려워요. 잠시 후 다시 시도해 주세요.");
          throw new Error("로그인을 완료하지 못했어요. 입력 내용을 확인해 주세요.");
        }
        if (data.session) onSuccess(); else setMessage("가입 확인 메일을 보냈어요. 이메일에서 확인한 뒤 로그인해 주세요.");
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="auth-email">이메일</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} />
      <label htmlFor="auth-password">비밀번호 {mode === "signup" && <small>8자 이상</small>}</label><input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={8} required maxLength={128} />
      {mode === "signup" && <label className="consent-label"><input type="checkbox" required /> <span><a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 안내</a>를 확인했어요.</span></label>}
      <button type="submit" className="primary" disabled={busy}>{busy ? "연결하는 중…" : mode === "login" ? "로그인" : "가입하고 기록 시작하기"}</button>
    </form>
    {message && <p className="form-message" role="status">{message}</p>}
    <button className="text-button auth-toggle" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "처음이라면, 회원가입" : "이미 계정이 있다면, 로그인"} <ArrowRight size={14} /></button>
  </Dialog>;
}

function EditDialog({ record, saving, close, submit }: { record: SavedRecord; saving: boolean; close: () => void; submit: (values: { thought: string; afterword: string }) => void }) {
  const [thought, setThought] = useState(record.thought); const [afterword, setAfterword] = useState(record.afterword);
  return <Dialog title="그 순간의 생각, 그 후의 이야기" close={close}><label htmlFor="edit-thought">당시 생각이나 결정</label><textarea id="edit-thought" rows={4} maxLength={2000} value={thought} onChange={e => setThought(e.target.value)} /><label htmlFor="edit-afterword">후일담 <small>선택</small></label><textarea id="edit-afterword" rows={4} maxLength={3000} value={afterword} onChange={e => setAfterword(e.target.value)} /><button className="primary" disabled={saving} onClick={() => submit({ thought, afterword })}>{saving ? "저장하는 중…" : "기록 수정하기"}</button></Dialog>;
}

function ShareDialog({ record, session, close, onChanged }: { record: SavedRecord; session: Session | null; close: () => void; onChanged: () => void }) {
  const [token, setToken] = useState(record.shareToken); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const url = token ? `${window.location.origin}/s/${token}` : "";
  async function change(enabled: boolean) {
    setBusy(true); setMessage("");
    try { const response = await request<{ shareToken: string | null }>("/api/share", { id: record.id, enabled }, session); setToken(response.shareToken); onChanged(); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog title="이 순간을 나누기" close={close}>
    <p className="modal-intro">링크를 가진 사람은 아래의 고민·말씀·생각을 볼 수 있어요. 후일담과 이메일은 공유하지 않아요.</p>
    <div className="share-preview"><small>공유될 내용</small><p>{record.concern}</p><blockquote>{record.verse.text}</blockquote>{record.thought && <p>{record.thought}</p>}</div>
    {token ? <><label htmlFor="share-link">공유 링크</label><input id="share-link" readOnly value={url} /><button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("링크를 복사했어요."); } catch { setMessage("위 링크를 선택해 복사해 주세요."); } }}><Copy size={16} /> 링크 복사</button><button className="text-button revoke-link" disabled={busy} onClick={() => void change(false)}>공유 링크 닫기</button></> : <button className="primary" disabled={busy} onClick={() => void change(true)}>{busy ? "링크를 만드는 중…" : <><Share2 size={16} /> 이 내용으로 공유 링크 만들기</>}</button>}
    {message && <p className="form-message" role="status">{message}</p>}
  </Dialog>;
}

function formatDate(date: string) { return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(date)); }
function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
