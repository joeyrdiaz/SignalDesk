import Parser from "rss-parser";
import { CURATED_FEEDS } from "./feeds";
import { computeSignalScore, autoTag } from "./scoring";
import { generateTakeaways } from "./takeaways";
import { assertPublicUrl } from "./ssrf";
import type {
  Article,
  FeedSource,
  FeedsResponse,
  StreamCategory,
} from "./types";

type CustomItem = {
  content?: string;
  contentEncoded?: string;
  "content:encoded"?: string;
  summary?: string;
  description?: string;
  author?: string;
  creator?: string;
  media?: { $?: { url?: string } };
  enclosure?: { url?: string };
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  timeout: 12000,
  headers: {
    "User-Agent": "SignalDesk/1.0 (+https://signaldesk.app; aggregator)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "media"],
      ["media:thumbnail", "media"],
    ],
  },
});

const FEED_TIMEOUT_MS = 10000;
const MAX_ITEMS_PER_FEED = 12;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout fetching ${label}`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(item: CustomItem & { content?: string }): string | undefined {
  if (item.enclosure?.url && /\.(jpg|jpeg|png|webp|gif)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }
  const mediaUrl = item.media?.$?.url;
  if (mediaUrl) return mediaUrl;
  const html = item.contentEncoded || item["content:encoded"] || item.content || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function articleId(sourceId: string, guid: string, link: string, title: string): string {
  const raw = guid || link || title;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `${sourceId}-${Math.abs(hash).toString(36)}`;
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    // Strip common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"].forEach(
      (p) => url.searchParams.delete(p)
    );
    return url.toString().replace(/\/$/, "");
  } catch {
    return u.trim();
  }
}

async function fetchOneFeed(source: FeedSource): Promise<Article[]> {
  try {
    const feed = await withTimeout(
      parser.parseURL(source.url),
      FEED_TIMEOUT_MS,
      source.name
    );
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);
    return items
      .map((item) => {
        const title = (item.title || "Untitled").trim();
        const link = item.link || item.guid || "";
        if (!link && !title) return null;

        const contentEncoded =
          item.contentEncoded ||
          item["content:encoded"] ||
          undefined;
        const rawSummary =
          item.contentSnippet ||
          item.summary ||
          item.description ||
          item.content ||
          "";
        const summary = stripHtml(String(rawSummary)).slice(0, 400);
        const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
        const guid = String(item.guid || link || title);

        const score = computeSignalScore(
          publishedAt,
          source.quality,
          title,
          summary,
          source.category
        );
        const tags = autoTag(title, summary, source.category);
        const takeaways = generateTakeaways(title, summary, contentEncoded);

        const article: Article = {
          id: articleId(source.id, guid, link, title),
          title,
          link: link || source.siteUrl,
          author: item.creator || item.author || undefined,
          publishedAt: new Date(publishedAt).toISOString(),
          summary,
          contentSnippet: summary,
          contentEncoded: contentEncoded ? String(contentEncoded) : undefined,
          imageUrl: extractImage(item),
          sourceId: source.id,
          sourceName: source.name,
          category: source.category,
          tags,
          signalScore: score,
          takeaways,
          guid,
        };
        return article;
      })
      .filter((a): a is Article => a !== null);
  } catch (err) {
    console.warn(`[feeds] ${source.id} failed:`, (err as Error).message);
    return [];
  }
}

function dedupe(articles: Article[]): Article[] {
  const byLink = new Map<string, Article>();
  for (const a of articles) {
    const key = normalizeUrl(a.link) || a.id;
    const existing = byLink.get(key);
    if (!existing || a.signalScore > existing.signalScore) {
      byLink.set(key, a);
    }
  }
  return Array.from(byLink.values());
}

export async function aggregateFeeds(
  extraSources: FeedSource[] = []
): Promise<FeedsResponse> {
  const sources = [...CURATED_FEEDS, ...extraSources];
  const batches = await Promise.all(sources.map((s) => fetchOneFeed(s)));
  let articles = dedupe(batches.flat());

  articles.sort((a, b) => b.signalScore - a.signalScore);

  const topicCounts: Record<StreamCategory, number> = {
    markets: 0,
    equity: 0,
    data: 0,
    ai: 0,
  };
  const feedCounts = new Map<string, { sourceName: string; count: number }>();

  for (const a of articles) {
    topicCounts[a.category] += 1;
    const prev = feedCounts.get(a.sourceId) || {
      sourceName: a.sourceName,
      count: 0,
    };
    prev.count += 1;
    feedCounts.set(a.sourceId, prev);
  }

  return {
    articles,
    sources,
    cachedAt: new Date().toISOString(),
    stale: false,
    topicMix: (Object.keys(topicCounts) as StreamCategory[]).map((category) => ({
      category,
      count: topicCounts[category],
    })),
    feedActivity: Array.from(feedCounts.entries())
      .map(([sourceId, v]) => ({
        sourceId,
        sourceName: v.sourceName,
        count: v.count,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function discoverFeedUrl(inputUrl: string): Promise<string | null> {
  let base: URL;
  try {
    base = await assertPublicUrl(
      inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`
    );
  } catch {
    return null;
  }

  const candidates = [
    base.toString(),
    new URL("/feed", base.origin).toString(),
    new URL("/rss", base.origin).toString(),
    new URL("/feed.xml", base.origin).toString(),
    new URL("/rss.xml", base.origin).toString(),
    new URL("/atom.xml", base.origin).toString(),
    new URL("/index.xml", base.origin).toString(),
    // Substack-style
    `${base.origin}/feed`,
    // Blogspot
    `${base.origin}/feeds/posts/default?alt=rss`,
  ];

  // Deduplicate candidates
  const unique = [...new Set(candidates)];

  for (const candidate of unique) {
    try {
      const feed = await withTimeout(
        parser.parseURL(candidate),
        FEED_TIMEOUT_MS,
        candidate
      );
      if (feed.items && feed.items.length > 0) {
        return candidate;
      }
    } catch {
      // try next
    }
  }

  // Try HTML auto-discovery
  try {
    const res = await withTimeout(
      fetch(base.toString(), {
        headers: { "User-Agent": "SignalDesk/1.0" },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      }),
      FEED_TIMEOUT_MS,
      "html"
    );
    const html = await res.text();
    const linkMatch = html.match(
      /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*href=["']([^"']+)["']/i
    ) || html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]*type=["']application\/(rss|atom)\+xml["']/i
    );
    if (linkMatch) {
      const href = linkMatch[2] || linkMatch[1];
      const absolute = new URL(href, base).toString();
      const feed = await withTimeout(
        parser.parseURL(absolute),
        FEED_TIMEOUT_MS,
        absolute
      );
      if (feed.items && feed.items.length > 0) return absolute;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function validateAndProbeFeed(feedUrl: string): Promise<{
  title: string;
  itemCount: number;
}> {
  const feed = await withTimeout(parser.parseURL(feedUrl), FEED_TIMEOUT_MS, feedUrl);
  return {
    title: feed.title || "Custom Feed",
    itemCount: feed.items?.length || 0,
  };
}
