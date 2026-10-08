import type { ConcernFacts, FactKey } from "@/lib/types";

export type ReviewCase = { id: string; concern: string; domain: ConcernFacts["domain"]; yes: FactKey[]; unknown: FactKey[] };
export const reviewCases: ReviewCase[] = [
  { id: "G01", concern: "사고 싶은 자켓이 있고 쓸 돈도 따로 모아뒀다. 자주 입을 것 같지만 최근에도 옷을 샀다는 생각 때문에 마음이 걸린다. 안 사면 아쉬울 것 같다.", domain: "purchase", yes: ["recent_purchase"], unknown: ["financial_shortage", "rare_opportunity"] },
  { id: "G02", concern: "같은 자켓이 갖고 싶지만 이번 달 생활비가 부족하다. 사면 다른 지출을 줄여야 하고, 이번에 놓치면 언제 다시 살 수 있을지도 모르겠다.", domain: "purchase", yes: ["financial_shortage"], unknown: ["rare_opportunity", "use_uncertain"] },
  { id: "G03", concern: "평소 관심 없던 헤드폰이 오늘까지만 할인한다. 이미 쓰는 헤드폰이 있는데 새것을 자주 쓸지는 모르겠다. 할인을 놓치기는 아깝다.", domain: "purchase", yes: ["use_uncertain", "has_similar_item", "deadline_today"], unknown: ["financial_shortage"] },
  { id: "G04", concern: "주말 콘서트가 보고 싶다. 오늘 할 일은 마쳤지만 다녀오면 내일 출근할 때 피곤할까 걱정된다. 이번을 놓치면 다시 볼 기회는 모른다.", domain: "schedule", yes: ["future_worry"], unknown: ["rare_opportunity", "deadline_today"] },
  { id: "G05", concern: "오늘 콘서트에 가고 싶은데 오늘 마감인 보고서를 아직 못 끝냈다. 다녀오면 작성 시간이 거의 남지 않는다. 표가 아깝고 공연도 보고 싶다.", domain: "schedule", yes: ["deadline_today", "unfinished_duty"], unknown: ["future_worry"] },
  { id: "G06", concern: "연휴에 부모님을 뵐지 오늘만 열리는 축제에 갈지 고민이다. 부모님은 다음 달에도 뵐 수 있지만 지금 보고 싶기도 하다. 축제는 이번을 놓치면 다시 열릴지 모른다.", domain: "schedule", yes: ["misses_people", "rare_opportunity"], unknown: ["unfinished_duty"] },
  { id: "G07", concern: "카메라를 높은 가격에 올려뒀다. 당장 돈이 필요한 것은 아니지만 연락을 계속 기다리고 확인하는 게 지친다. 가격을 낮춰 빨리 정리할지, 지금 가격으로 더 기다릴지 고민이다.", domain: "sale", yes: ["sell_faster", "waiting_fatigue"], unknown: ["prior_promise"] },
  { id: "G08", concern: "카메라를 팔아 이번 주에 필요한 돈을 마련해야 해. 높은 가격을 기다릴지, 가격을 낮춰 빨리 팔 가능성을 높일지 고민돼. 어느 가격에도 팔린다는 보장은 없어.", domain: "sale", yes: ["cash_deadline", "sell_faster"], unknown: ["prior_promise", "waiting_fatigue"] },
  { id: "G09", concern: "카메라를 낮은 가격에 사겠다는 사람과 이미 거래를 약속했다. 그 뒤 더 높은 가격을 주겠다는 연락이 왔다. 돈은 더 받고 싶지만 먼저 한 약속이 마음에 걸린다.", domain: "sale", yes: ["prior_promise", "higher_offer"], unknown: ["cash_deadline"] },
  { id: "G10", concern: "친구와 다투면서 내가 먼저 심하게 말했다. 사과하고 싶은데 민망해서 먼저 말을 걸지 못하고 있다. 친구가 받아줄지도 모르겠다.", domain: "relationship", yes: ["regrets_words"], unknown: ["already_tried_gentle", "repeated_breach"] },
  { id: "G11", concern: "친구가 약속을 반복해서 어긴다. 이미 부드럽게 말해봤지만 달라지지 않았다. 또 넘어갈지, 이번에는 거리를 둘지 고민이다.", domain: "relationship", yes: ["already_tried_gentle", "repeated_breach"], unknown: ["regrets_words"] },
  { id: "G12", concern: "친구가 하루째 답장을 하지 않는다. 바쁜 건지 나에게 화가 난 건지 모르겠다. 다시 연락할지 조금 기다릴지 고민이다.", domain: "relationship", yes: ["unknown_other_situation"], unknown: ["repeated_breach", "regrets_words"] },
  { id: "G13", concern: "시험 준비를 더 하고 싶은데 며칠째 잠을 적게 자서 너무 피곤하다. 오늘 밤에도 공부할지 일찍 쉬고 내일 다시 시작할지 고민이다.", domain: "work", yes: ["needs_rest"], unknown: ["deadline_today"] },
  { id: "G14", concern: "치료를 계속 받고 있는데 몸도 마음도 지친다. 계속할지 다른 선택을 찾아볼지 고민이다. 지금 결과가 어떨지는 모르겠다.", domain: "health", yes: ["needs_rest"], unknown: ["deadline_today", "financial_shortage"] },
  { id: "G15", concern: "해보고 싶던 동아리 운영에 지원하려는데 처음 하는 일이라 잘할 수 있을지 두렵다. 도전해볼지 지금 하던 일만 할지 고민이다.", domain: "work", yes: ["fear_of_starting"], unknown: ["deadline_today"] },
  { id: "G16", concern: "둘 중 무엇을 골라야 할지 마음을 정하지 못하겠어.", domain: "general", yes: ["difficult_choice"], unknown: ["financial_shortage", "cash_deadline", "deadline_today", "misses_people"] }
];
