import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extract";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { assertPublicUrl } from "@/lib/ssrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FALLBACK_CHARS = 200_000;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function rateLimited(req: NextRequest) {
  if (!allowRequest(clientKey(req, "extract"), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url query param required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = await assertPublicUrl(url);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Invalid url" },
      { status: 400 }
    );
  }

  let fallbackHtml = req.nextUrl.searchParams.get("fallback") || undefined;
  if (fallbackHtml && fallbackHtml.length > MAX_FALLBACK_CHARS) {
    fallbackHtml = fallbackHtml.slice(0, MAX_FALLBACK_CHARS);
  }

  try {
    const result = await extractArticle(parsed.toString(), fallbackHtml || undefined);

    if (!result.content && result.fallback) {
      return NextResponse.json(
        {
          ...result,
          error: result.error || "Extraction blocked or empty",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[api/extract]", err);
    return NextResponse.json(
      {
        url: parsed.toString(),
        title: "Unable to extract",
        content: "",
        fallback: true,
        error: (err as Error).message,
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_FALLBACK_CHARS + 8_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const body = (await req.json()) as { url?: string; fallbackHtml?: string };
    if (!body.url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    let safe: URL;
    try {
      safe = await assertPublicUrl(body.url);
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || "Invalid url" },
        { status: 400 }
      );
    }

    let fallback = body.fallbackHtml;
    if (fallback && fallback.length > MAX_FALLBACK_CHARS) {
      fallback = fallback.slice(0, MAX_FALLBACK_CHARS);
    }

    const result = await extractArticle(safe.toString(), fallback);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
