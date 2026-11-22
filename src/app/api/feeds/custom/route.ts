import { NextRequest, NextResponse } from "next/server";
import { discoverFeedUrl, validateAndProbeFeed } from "@/lib/fetch-feeds";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { assertPublicUrl } from "@/lib/ssrf";
import type { CustomFeedResponse, StreamCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  if (!allowRequest(clientKey(req, "feeds-custom"), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 16_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const body = (await req.json()) as {
      url?: string;
      name?: string;
      category?: StreamCategory;
    };

    const inputUrl = (body.url || "").trim();
    if (!inputUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = await assertPublicUrl(
        inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`
      );
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || "Invalid URL" },
        { status: 400 }
      );
    }

    const discovered = await discoverFeedUrl(parsed.toString());
    if (!discovered) {
      return NextResponse.json(
        {
          error:
            "Could not find a valid RSS/Atom feed. Try a direct /feed or /rss URL.",
        },
        { status: 404 }
      );
    }

    // Defense in depth: re-check before probe (discovery already validates)
    const safeDiscovered = await assertPublicUrl(discovered);
    const probe = await validateAndProbeFeed(safeDiscovered.toString());
    const category: StreamCategory =
      body.category && ["markets", "equity", "data", "ai"].includes(body.category)
        ? body.category
        : "markets";

    const name = (body.name || probe.title || parsed.hostname).trim().slice(0, 120);
    const id = `custom-${slugify(name)}-${Date.now().toString(36)}`;

    const response: CustomFeedResponse = {
      source: {
        id,
        name,
        url: safeDiscovered.toString(),
        siteUrl: parsed.origin,
        category,
        quality: 0.65,
        custom: true,
      },
      discoveredUrl: safeDiscovered.toString(),
      itemCount: probe.itemCount,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/feeds/custom]", err);
    return NextResponse.json(
      { error: "Failed to add custom feed", message: (err as Error).message },
      { status: 500 }
    );
  }
}
