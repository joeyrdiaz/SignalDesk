import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { sanitizeHtml } from "./sanitize-html";
import { assertPublicUrl, readResponseText, safeFetch } from "./ssrf";
import type { ExtractResponse } from "./types";

const FETCH_TIMEOUT_MS = 12000;
const MAX_FALLBACK_HTML = 200_000;

function enhanceContent(html: string, baseUrl: string): string {
  try {
    const dom = new JSDOM(`<body>${html}</body>`);
    const doc = dom.window.document;

    // Lazy-load images + absolutize
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src) {
        try {
          img.setAttribute("src", new URL(src, baseUrl).toString());
        } catch {
          // leave as-is
        }
      }
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      // Wrap bare images in figure if not already
      if (img.parentElement?.tagName !== "FIGURE") {
        const figure = doc.createElement("figure");
        img.parentNode?.insertBefore(figure, img);
        figure.appendChild(img);
        const alt = img.getAttribute("alt");
        if (alt) {
          const cap = doc.createElement("figcaption");
          cap.textContent = alt;
          figure.appendChild(cap);
        }
      }
    });

    // External links
    doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href) {
        try {
          a.setAttribute("href", new URL(href, baseUrl).toString());
        } catch {
          // leave
        }
      }
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });

    // Wrap tables for scroll
    doc.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-scroll")) return;
      const wrap = doc.createElement("div");
      wrap.className = "table-scroll";
      table.parentNode?.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

async function fetchHtml(url: string): Promise<string> {
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SignalDesk/1.0; +https://signaldesk.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await readResponseText(res);
  } finally {
    clearTimeout(timer);
  }
}

export async function extractArticle(
  url: string,
  fallbackHtml?: string
): Promise<ExtractResponse> {
  const cappedFallback =
    fallbackHtml && fallbackHtml.length > MAX_FALLBACK_HTML
      ? fallbackHtml.slice(0, MAX_FALLBACK_HTML)
      : fallbackHtml;

  try {
    const html = await fetchHtml(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, {
      charThreshold: 100,
      keepClasses: false,
    });
    const parsed = reader.parse();

    if (parsed?.content && parsed.content.length > 120) {
      const cleaned = sanitizeHtml(parsed.content);
      const enhanced = enhanceContent(cleaned, url);
      return {
        url,
        title: parsed.title || "Untitled",
        byline: parsed.byline || undefined,
        excerpt: parsed.excerpt || undefined,
        content: enhanced,
        siteName: parsed.siteName || undefined,
        fallback: false,
      };
    }

    throw new Error("Readability returned empty content");
  } catch (err) {
    const message = (err as Error).message || "Extraction failed";

    if (cappedFallback && cappedFallback.length > 40) {
      const cleaned = sanitizeHtml(cappedFallback);
      const enhanced = enhanceContent(cleaned, url);
      return {
        url,
        title: "Article",
        content: enhanced,
        fallback: true,
        error: message,
      };
    }

    return {
      url,
      title: "Unable to extract",
      content: "",
      fallback: true,
      error: message,
    };
  }
}
