export type TriState = "yes" | "no" | "unknown";

export type ConcernFacts = {
  domain: "purchase" | "schedule" | "sale" | "relationship" | "work" | "health" | "general";
  choices: { action: string; reasons: string[]; burdens: string[] }[];
  facts: {
    key: FactKey;
    state: TriState;
    evidence: string;
  }[];
  unknowns: string[];
};

export const factKeys = [
  "recent_purchase", "financial_shortage", "use_uncertain", "has_similar_item",
  "deadline_today", "future_worry", "unfinished_duty", "rare_opportunity",
  "cash_deadline", "waiting_fatigue", "sell_faster", "prior_promise", "higher_offer",
  "misses_people", "regrets_words", "already_tried_gentle", "repeated_breach",
  "unknown_other_situation", "fear_of_starting", "difficult_choice", "needs_rest"
] as const;
export type FactKey = typeof factKeys[number];

export type Verse = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
  text: string;
  translation: "개역한글";
  sourceUrl: string;
  context: string;
};

export type CandidateRule = {
  id: string;
  domains: ConcernFacts["domain"][];
  all?: FactKey[];
  any?: FactKey[];
  exclude?: FactKey[];
  verseIds: string[];
  expansionIds: string[];
  reviewCaseIds: string[];
  rationale: string;
};

export type DrawResult = {
  id: string;
  concern: string;
  verse: Verse;
  createdAt: string;
  ticket: string;
};

export type SavedRecord = DrawResult & {
  thought: string;
  afterword: string;
  shareToken: string | null;
};
