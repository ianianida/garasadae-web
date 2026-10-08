import type { Verse } from "./types";

export function verseReference(verse: Verse): string {
  const range = verse.verseEnd && verse.verseEnd > verse.verse ? `${verse.verse}–${verse.verseEnd}` : String(verse.verse);
  return `${verse.book} ${verse.chapter}:${range}`;
}
