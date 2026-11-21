/**
 * Extractive Key Takeaways — no LLM required.
 * Prefer sentence-like chunks with signal keywords; fall back to clipped summary.
 */

const SIGNAL_WORDS = [
  "because",
  "however",
  "therefore",
  "suggests",
  "implies",
  "expect",
  "increase",
  "decrease",
  "growth",
  "risk",
  "opportunity",
  "key",
  "important",
  "shows",
  "finds",
  "argues",
  "concludes",
  "versus",
  "compared",
  "forecast",
  "estimate",
  "valuation",
  "model",
  "data",
  "market",
  "rate",
  "ai",
  "learning",
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 280);
}

function scoreSentence(s: string, title: string): number {
  const lower = s.toLowerCase();
  let score = 0;
  for (const w of SIGNAL_WORDS) {
    if (lower.includes(w)) score += 1;
  }
  // Prefer sentences that share title tokens
  const titleTokens = title
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 4);
  for (const t of titleTokens.slice(0, 6)) {
    if (lower.includes(t)) score += 0.75;
  }
  // Mild preference for mid-length
  if (s.length >= 70 && s.length <= 180) score += 0.5;
  return score;
}

export function generateTakeaways(
  title: string,
  summary: string,
  contentEncoded?: string
): string[] {
  const corpus = stripHtml(
    [summary, contentEncoded || ""].filter(Boolean).join(". ")
  );
  const sentences = splitSentences(corpus);

  if (sentences.length === 0) {
    const clipped = stripHtml(summary || title)
      .slice(0, 160)
      .trim();
    if (!clipped) return [`Coverage on: ${title}`];
    return [
      clipped.endsWith(".") ? clipped : `${clipped}…`,
      "Open the full article for deeper context and charts.",
    ];
  }

  const ranked = sentences
    .map((s, i) => ({ s, i, score: scoreSentence(s, title) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const picked: string[] = [];
  const used = new Set<number>();

  for (const item of ranked) {
    if (picked.length >= 3) break;
    // Avoid near-duplicates
    const stem = item.s.slice(0, 48).toLowerCase();
    if ([...used].some((idx) => ranked[idx].s.slice(0, 48).toLowerCase() === stem)) {
      continue;
    }
    used.add(item.i);
    picked.push(item.s);
  }

  // Ensure 2–3 bullets
  while (picked.length < 2 && ranked.length > picked.length) {
    const next = ranked.find((r) => !used.has(r.i));
    if (!next) break;
    used.add(next.i);
    picked.push(next.s);
  }

  if (picked.length === 0) {
    picked.push(`Coverage on: ${title}`);
  }
  if (picked.length < 2) {
    picked.push("Open the full article for deeper context, charts, and source links.");
  }

  return picked.slice(0, 3);
}
