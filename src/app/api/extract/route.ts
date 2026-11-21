import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extract";
import { assertPublicUrl } from "@/lib/ssrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

  const fallbackHtml = req.nextUrl.searchParams.get("fallback") || undefined;

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
  try {
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
    const result = await extractArticle(safe.toString(), body.fallbackHtml);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
