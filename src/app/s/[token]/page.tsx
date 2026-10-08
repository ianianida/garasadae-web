import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/supabase-server";
import type { Verse } from "@/lib/types";
import { verseReference } from "@/lib/verse-reference";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "말씀을 만난 순간 · 가라사대", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedRecord({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const { data, error } = await getAdminDb().from("garasadae_records").select("concern,verse_snapshot,thought,created_at").eq("share_token", token).maybeSingle();
  if (error) throw new Error("공유 기록을 불러오지 못했어요.");
  if (!data) notFound();
  const verse = data.verse_snapshot as Verse;
  return <><header className="site-header"><a className="wordmark" href="/">가라사대<span className="wordmark-dot" /></a><span className="small-caption">말씀을 만난 순간</span></header><main className="main-shell shared-shell"><div className="eyebrow"><span /> 누군가의 마음에 닿은 한 구절</div><h1>그날의 갈림길</h1><p className="shared-concern">{data.concern}</p><article className="verse-card"><span className="verse-ornament" aria-hidden="true">✳</span><blockquote>{verse.text}</blockquote><div className="verse-rule" /><a className="verse-reference" href={verse.sourceUrl} target="_blank" rel="noopener noreferrer">{verseReference(verse)}</a><span className="translation">개역한글 · 대한성서공회</span></article>{data.thought && <section className="shared-thought"><h2>말씀을 읽고 떠오른 생각</h2><p>{data.thought}</p></section>}<a href="/" className="primary shared-cta">나도 말씀 한 구절 만나기 →</a></main><footer className="site-footer"><span>가라사대</span><span>오늘의 말씀, 나의 이야기.</span><a href="/privacy">개인정보 안내</a></footer></>;
}
