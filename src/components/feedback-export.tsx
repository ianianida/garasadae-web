"use client";
import { useState } from "react";
import { getBrowserDb } from "@/lib/supabase-browser";

export default function FeedbackExport() {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <><button className="primary" disabled={busy} onClick={async () => {
    setBusy(true); setMessage("");
    try {
      const session = (await getBrowserDb()?.auth.getSession())?.data.session;
      if (!session) throw new Error("먼저 첫 화면에서 운영자 계정으로 로그인해 주세요.");
      const feedback: unknown[] = [];
      for (let offset = 0; ; offset += 100) {
        const response = await fetch(`/api/admin/feedback?offset=${offset}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 404 ? "운영자 계정을 확인해 주세요." : data.error ?? "불러오지 못했어요.");
        feedback.push(...data.feedback); if (data.feedback.length < 100) break;
      }
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, source: "live_service", exportedAt: new Date().toISOString(), feedback }, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `garasadae-feedback-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
      setMessage(`${feedback.length}개의 실제 서비스 피드백을 내려받았어요.`);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }}>{busy ? "피드백을 모으는 중…" : "피드백 JSON 내려받기"}</button>{message && <p role="status">{message}</p>}</>;
}
