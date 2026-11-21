import { NextRequest, NextResponse } from "next/server";
import { aggregateFeeds } from "@/lib/fetch-feeds";
import { getCached, setCache, cacheKey } from "@/lib/cache";
import { assertPublicUrl } from "@/lib/ssrf";
import type { FeedSource, FeedsResponse, StreamCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let refreshing: Promise<FeedsResponse> | null = null;

async function loadFeeds(extra: FeedSource[] = []): Promise<FeedsResponse> {
  if (!refreshing) {
    refreshing = aggregateFeeds(extra)
      .then((data) => {
        setCache(cacheKey(["feeds", "v1"]), data);
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function parseExtraSources(req: NextRequest): Promise<FeedSource[]> {
  const raw = req.nextUrl.searchParams.get("custom");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FeedSource[];
    if (!Array.isArray(parsed)) return [];
    const out: FeedSource[] = [];
    for (const s of parsed.slice(0, 20)) {
      if (!s?.url || !s?.id || !s?.name) continue;
      try {
        const safe = await assertPublicUrl(String(s.url));
        out.push({
          id: String(s.id).slice(0, 80),
          name: String(s.name).slice(0, 120),
          url: safe.toString(),
          siteUrl: String(s.siteUrl || safe.origin).slice(0, 300),
          category: (["markets", "equity", "data", "ai"].includes(s.category)
            ? s.category
            : "markets") as StreamCategory,
          quality: typeof s.quality === "number" ? Math.min(1, Math.max(0, s.quality)) : 0.65,
          custom: true,
        });
      } catch {
        // skip unsafe custom sources
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category");
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const extra = await parseExtraSources(req);
    const key = cacheKey(["feeds", "v1", extra.map((e) => e.id).sort().join(",")]);

    const cached = getCached<FeedsResponse>(key);
    let data: FeedsResponse;

    if (cached && !cached.stale) {
      data = { ...cached.data, stale: false };
    } else if (cached && cached.stale) {
      // Stale-while-revalidate: return stale, refresh in background
      void loadFeeds(extra).then((fresh) => setCache(key, fresh));
      data = { ...cached.data, stale: true };
    } else {
      data = await loadFeeds(extra);
      setCache(key, data);
    }

    let articles = data.articles;

    if (category && category !== "all") {
      articles = articles.filter((a) => a.category === category);
    }

    if (q) {
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.sourceName.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return NextResponse.json(
      {
        ...data,
        articles,
      } satisfies FeedsResponse,
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[api/feeds]", err);
    return NextResponse.json(
      { error: "Failed to aggregate feeds", message: (err as Error).message },
      { status: 500 }
    );
  }
}
