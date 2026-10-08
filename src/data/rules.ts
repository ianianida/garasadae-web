import type { CandidateRule } from "@/lib/types";
import { verseId } from "./verses";

const ids = (...values: string[]) => values.map(verseId);
// Launch proposal: approval and concern × verse evidence live in review-batches/launch-krv.md.
export const rules: CandidateRule[] = [
  { id: "purchase-recent", domains: ["purchase"], all: ["recent_purchase"], exclude: ["financial_shortage", "use_uncertain"], verseIds: ids("1TI.6.8", "PRO.25.16"), expansionIds: ids("ECC.3.13", "PRO.19.2"), reviewCaseIds: ["G01"], rationale: "최근 구매의 부담과 더 누리고 싶은 마음. 허용·절제의 두 개인적 연결을 열어둠." },
  { id: "purchase-use", domains: ["purchase"], all: ["use_uncertain"], verseIds: ids("PRO.19.2", "1TI.6.8"), expansionIds: ids("PRO.25.16", "PRO.14.15"), reviewCaseIds: ["G03", "R-purchase-discount"], rationale: "활용의 불확실함과 기회에 쫓기는 망설임을 대조." },
  { id: "purchase-shortage", domains: ["purchase"], all: ["financial_shortage"], verseIds: ids("1TI.6.8"), expansionIds: ids("PRO.19.2", "PRO.22.3", "PRO.14.15"), reviewCaseIds: ["G02"], rationale: "실제 돈 부족과 현재 가진 것의 대조. 조급함이 없는 입력에서는 잠언 19:2를 첫 후보로 확정하지 않음." },
  { id: "schedule-future", domains: ["schedule"], all: ["future_worry"], exclude: ["deadline_today", "unfinished_duty"], verseIds: ids("MAT.6.34", "ECC.3.13"), expansionIds: ids("MAT.11.28", "PRO.16.9"), reviewCaseIds: ["R003", "G04"], rationale: "다음날의 부담과 오늘의 기쁨. 오늘의 미완료 의무와 구별." },
  { id: "schedule-today", domains: ["schedule", "work"], all: ["deadline_today", "unfinished_duty"], verseIds: ids("MAT.6.34", "ECC.3.13"), expansionIds: ids("PRO.21.5", "ECC.7.8"), reviewCaseIds: ["R002", "G05"], rationale: "G05의 L·O 후보 유지 결정. 기한을 미루라는 해설을 생성하지 않음." },
  { id: "schedule-people", domains: ["schedule"], all: ["misses_people"], verseIds: ids("LUK.12.34"), expansionIds: ids("ECC.3.13", "PRO.16.9"), reviewCaseIds: ["R001", "G06"], rationale: "마음이 머무는 사람·장소와 이번 기회의 갈등." },
  { id: "sale-price-speed", domains: ["sale"], all: ["sell_faster"], exclude: ["cash_deadline", "prior_promise"], verseIds: ids("PRO.21.5", "ECC.7.8"), expansionIds: ids("PRO.16.9", "PSA.55.22"), reviewCaseIds: ["R004", "G07"], rationale: "가격과 속도의 갈등. 실제 돈 기한·이미 한 거래 약속을 다른 조합으로 구별." },
  { id: "sale-deadline", domains: ["sale"], all: ["cash_deadline"], exclude: ["prior_promise"], verseIds: ids("PRO.21.5"), expansionIds: ids("PRO.19.2", "PRO.14.15", "PRO.16.9"), reviewCaseIds: ["G08"], rationale: "기한을 보존하며 기존의 연결 반응을 검토. 본문의 조급함을 돈이 필요한 사정 자체로 단정하거나 판매 성공을 보장하지 않음." },
  { id: "sale-promise", domains: ["sale"], all: ["prior_promise", "higher_offer"], verseIds: ids("PRO.22.1", "MAT.5.37"), expansionIds: ids("PRO.14.15", "PRO.19.2"), reviewCaseIds: ["G09"], rationale: "추가 금액과 이미 한 약속 사이의 갈등." },
  { id: "relationship-apology", domains: ["relationship"], all: ["regrets_words"], exclude: ["repeated_breach", "already_tried_gentle"], verseIds: ids("PRO.12.18", "PRO.15.1"), expansionIds: ids("ROM.12.18", "JAS.1.19"), reviewCaseIds: ["G10"], rationale: "자신의 말이 마음에 걸리는 경우의 말과 관계 회복. 풀이가 필요했던 잠언 25:15는 첫 출시에서 보류." },
  { id: "relationship-repeat", domains: ["relationship"], all: ["repeated_breach"], verseIds: ids("PRO.22.3", "PRO.14.15"), expansionIds: ids("ROM.12.18", "PRO.18.13"), reviewCaseIds: ["G11"], rationale: "이미 시도한 행동과 반복된 위반을 보존. 무조건 참고 더 부드럽게 말하는 후보와 구별." },
  { id: "relationship-unknown", domains: ["relationship"], all: ["unknown_other_situation"], exclude: ["repeated_breach"], verseIds: ids("PRO.18.13"), expansionIds: ids("JAS.1.19", "PRO.14.15", "ROM.12.18"), reviewCaseIds: ["G12"], rationale: "상대의 사정을 모르는 상태에서 판단과 듣기의 망설임. 분노가 명시되지 않은 경우 야고보서 1:19는 확장으로 검토." },
  { id: "rest", domains: ["work", "health", "general"], all: ["needs_rest"], verseIds: ids("MAT.11.28", "PSA.55.22"), expansionIds: ids("PRO.16.9"), reviewCaseIds: ["G13", "G14"], rationale: "명시된 피로와 무거운 마음. 치료나 일을 중단하라는 서비스 결론은 없음." },
  { id: "starting", domains: ["work", "general"], all: ["fear_of_starting"], verseIds: ids("PRO.16.9"), expansionIds: ids("PRO.19.2", "PSA.55.22"), reviewCaseIds: ["G15"], rationale: "새 시도의 두려움과 계획·맡김. 전쟁 비유가 어려운 잠언 20:18는 보류." }
];

// Last expansion is deliberately small and separate from proven sufficient pairs.
export const baseIds = ids("PSA.55.22", "PRO.16.9", "MAT.11.28");
