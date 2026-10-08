import type { Metadata } from "next";
import FeedbackExport from "@/components/feedback-export";
export const metadata: Metadata = { title: "운영 피드백 · 가라사대", robots: { index: false, follow: false } };
export default function Admin() {
  return <main className="main-shell info-page"><a className="wordmark" href="/">가라사대</a><h1>운영 피드백</h1><p>사용자가 직접 보낸 고민·말씀·반응과 추첨 정보를 내려받습니다. 운영자 계정만 자료를 받을 수 있습니다.</p><p>파일을 Codex에 전달해 함께 개선안을 검토하고, 승인한 데이터·규칙을 Git으로 배포하세요. 사전 예상과 실제 반응은 구분합니다.</p><FeedbackExport /></main>;
}
