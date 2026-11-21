import type { StreamCategory } from "./types";

const KEYWORD_MAP: Record<StreamCategory, string[]> = {
  markets: [
    "fed",
    "inflation",
    "rates",
    "gdp",
    "recession",
    "macro",
    "treasury",
    "yield",
    "liquidity",
    "monetary",
    "employment",
    "cpi",
    "fomc",
    "dollar",
    "commodity",
  ],
  equity: [
    "valuation",
    "earnings",
    "margin",
    "moat",
    "dcf",
    "multiple",
    "equity",
    "stock",
    "buyback",
    "dividend",
    "fundamental",
    "intrinsic",
    "capex",
    "roe",
    "buffett",
  ],
  data: [
    "data",
    "analytics",
    "sql",
    "pipeline",
    "dbt",
    "visualization",
    "statistics",
    "dashboard",
    "etl",
    "warehouse",
    "python",
    "r ",
    "pandas",
    "notebook",
    "feature",
  ],
  ai: [
    "ai",
    "llm",
    "model",
    "transformer",
    "gpt",
    "neural",
    "machine learning",
    "deep learning",
    "agent",
    "embedding",
    "inference",
    "training",
    "dataset",
    "openai",
    "anthropic",
  ],
};

const GENERIC_SIGNAL = [
  "analysis",
  "insight",
  "research",
  "framework",
  "thesis",
  "forecast",
  "strategy",
  "risk",
  "alpha",
  "signal",
];

export function autoTag(
  title: string,
  summary: string,
  category: StreamCategory
): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const tags = new Set<string>();

  // Always include stream category as a tag
  const categoryTag =
    category === "ai"
      ? "AI/ML"
      : category === "data"
        ? "Data Sci"
        : category === "equity"
          ? "Equity"
          : "Markets";
  tags.add(categoryTag);

  for (const [cat, words] of Object.entries(KEYWORD_MAP)) {
    for (const w of words) {
      if (text.includes(w)) {
        const label =
          cat === "ai"
            ? w === "llm" || w === "gpt" || w === "transformer"
              ? w.toUpperCase()
              : capitalize(w)
            : capitalize(w.trim());
        tags.add(label);
        if (tags.size >= 5) break;
      }
    }
    if (tags.size >= 5) break;
  }

  return Array.from(tags).slice(0, 5);
}

export function keywordDensity(
  title: string,
  summary: string,
  category: StreamCategory
): number {
  const text = `${title} ${summary}`.toLowerCase();
  const words = KEYWORD_MAP[category];
  let hits = 0;
  for (const w of words) {
    if (text.includes(w)) hits += 1;
  }
  for (const w of GENERIC_SIGNAL) {
    if (text.includes(w)) hits += 0.5;
  }
  // Title hits count more
  const titleLower = title.toLowerCase();
  for (const w of words) {
    if (titleLower.includes(w)) hits += 1;
  }
  return Math.min(1, hits / 8);
}

export function recencyScore(publishedAt: string, now = Date.now()): number {
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return 0.2;
  const ageHours = (now - t) / (1000 * 60 * 60);
  if (ageHours < 0) return 1;
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.9;
  if (ageHours <= 72) return 0.7;
  if (ageHours <= 168) return 0.45;
  if (ageHours <= 336) return 0.25;
  return 0.1;
}

/** Composite signal: 45% recency + 35% source quality + 20% keyword density */
export function computeSignalScore(
  publishedAt: string,
  sourceQuality: number,
  title: string,
  summary: string,
  category: StreamCategory
): number {
  const r = recencyScore(publishedAt);
  const q = Math.max(0, Math.min(1, sourceQuality));
  const k = keywordDensity(title, summary, category);
  const score = r * 0.45 + q * 0.35 + k * 0.2;
  return Math.round(score * 1000) / 1000;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
