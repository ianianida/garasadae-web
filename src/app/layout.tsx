import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가라사대 — 지금, 나에게 닿는 말씀",
  description: "마음에 걸리는 고민을 적고 말씀 한 구절을 만나보세요. 그 순간의 생각을 나만의 기록으로 남깁니다.",
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
