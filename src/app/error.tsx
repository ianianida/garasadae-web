"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="main-shell info-page"><a className="wordmark" href="/">가라사대</a><h1>잠시 연결이 어려워요.</h1><p>조금 뒤에 다시 열어 주세요.</p><button className="primary" onClick={reset}>다시 열기</button></main>;
}
