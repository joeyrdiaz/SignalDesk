"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Minus,
  Plus,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Type,
  Moon,
  Sun,
  Coffee,
} from "lucide-react";
import type {
  Article,
  ExtractResponse,
  ReaderFont,
  ReaderTheme,
  SavedArticle,
} from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { getSavedArticle, isArticleSaved, saveArticle, unsaveArticle } from "@/lib/db";

interface ReaderSheetProps {
  article: Article | null;
  onClose: () => void;
  onSavedChange?: () => void;
}

const FONT_SIZES = [15, 17, 19, 21, 23];

export function ReaderSheet({ article, onClose, onSavedChange }: ReaderSheetProps) {
  const [content, setContent] = useState<ExtractResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<ReaderTheme>("dark");
  const [font, setFont] = useState<ReaderFont>("sans");
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!article) return;
    let cancelled = false;
    setLoading(true);
    setContent(null);
    setProgress(0);
    setShowControls(false);

    (async () => {
      const offline = await getSavedArticle(article.id);
      if (offline && !cancelled) {
        setContent({
          url: article.link,
          title: article.title,
          content: offline.html,
          fallback: offline.fallback,
        });
        setSaved(true);
        setLoading(false);
        return;
      }

      setSaved(await isArticleSaved(article.id));

      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: article.link,
            fallbackHtml: article.contentEncoded,
          }),
        });
        const json = (await res.json()) as ExtractResponse;
        if (!cancelled) {
          if (!json.title || json.title === "Article" || json.title === "Unable to extract") {
            json.title = article.title;
          }
          if (!json.content && article.contentEncoded) {
            json.content = article.contentEncoded;
            json.fallback = true;
          }
          setContent(json);
        }
      } catch {
        if (!cancelled) {
          setContent({
            url: article.link,
            title: article.title,
            content: article.contentEncoded || `<p>${article.summary}</p>`,
            fallback: true,
            error: "Network error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [article]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
  }, []);

  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, onClose]);

  // Image tap-to-zoom
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "IMG") {
        setZoomSrc((t as HTMLImageElement).src);
      }
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [content]);

  const toggleSave = async () => {
    if (!article || !content) return;
    if (saved) {
      await unsaveArticle(article.id);
      setSaved(false);
    } else {
      const entry: SavedArticle = {
        id: article.id,
        article,
        html: content.content,
        savedAt: new Date().toISOString(),
        fallback: content.fallback,
      };
      await saveArticle(entry);
      setSaved(true);
    }
    onSavedChange?.();
  };

  if (!article) return null;

  const themeClass =
    theme === "light"
      ? "reader-light"
      : theme === "sepia"
        ? "reader-sepia"
        : "reader-dark";

  const fontClass = font === "serif" ? "font-reader-serif" : "font-reader-sans";
  const fontSize = FONT_SIZES[fontSizeIdx];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050608]">
      {/* Progress */}
      <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/5">
        <div
          className="h-full bg-[#0A84FF] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header
        className="relative z-10 flex items-center gap-2 border-b border-white/[0.08] bg-[#050608]/90 px-3 backdrop-blur-2xl"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close reader"
        >
          <X size={20} />
        </button>
        <div className="min-w-0 flex-1 py-2">
          <p className="truncate text-[12px] text-white/45">{article.sourceName}</p>
          <p className="truncate text-[13px] font-medium text-white/80">
            {formatRelativeTime(article.publishedAt)}
            {content?.fallback ? " · RSS fallback" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          className="rounded-full p-2 text-white/70 hover:bg-white/10"
          aria-label="Reader settings"
        >
          <Type size={18} />
        </button>
        <button
          type="button"
          onClick={toggleSave}
          className="rounded-full p-2 text-white/70 hover:bg-white/10"
          aria-label={saved ? "Remove from saved" : "Save offline"}
        >
          {saved ? <BookmarkCheck size={18} className="text-[#0A84FF]" /> : <Bookmark size={18} />}
        </button>
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full p-2 text-white/70 hover:bg-white/10"
          aria-label="Open original"
        >
          <ExternalLink size={18} />
        </a>
      </header>

      {/* Controls panel */}
      {showControls && (
        <div className="z-10 border-b border-white/[0.08] bg-[#0c0e12]/95 px-4 py-3 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[65ch] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFontSizeIdx((i) => Math.max(0, i - 1))}
                className="rounded-lg bg-white/10 p-2 text-white/80"
                aria-label="Decrease font"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs text-white/50">A</span>
              <button
                type="button"
                onClick={() => setFontSizeIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
                className="rounded-lg bg-white/10 p-2 text-white/80"
                aria-label="Increase font"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setFont("sans")}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  font === "sans" ? "bg-white/15 text-white" : "text-white/50"
                }`}
              >
                Sans
              </button>
              <button
                type="button"
                onClick={() => setFont("serif")}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  font === "serif" ? "bg-white/15 text-white" : "text-white/50"
                }`}
              >
                Serif
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`rounded-lg p-2 ${theme === "dark" ? "bg-white/15" : "bg-white/5"}`}
                aria-label="Dark"
              >
                <Moon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`rounded-lg p-2 ${theme === "light" ? "bg-white/15" : "bg-white/5"}`}
                aria-label="Light"
              >
                <Sun size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTheme("sepia")}
                className={`rounded-lg p-2 ${theme === "sepia" ? "bg-white/15" : "bg-white/5"}`}
                aria-label="Sepia"
              >
                <Coffee size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`flex-1 overflow-y-auto ${themeClass}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <article
          className={`reader-article mx-auto max-w-[65ch] px-5 py-6 ${fontClass}`}
          style={{ fontSize, lineHeight: 1.65 }}
        >
          <h1 className="mb-3 text-[1.55em] font-bold leading-tight tracking-tight">
            {article.title}
          </h1>
          {article.author && (
            <p className="mb-4 text-[0.85em] opacity-60">By {article.author}</p>
          )}

          {article.takeaways.length > 0 && (
            <div className="takeaways mb-6 rounded-2xl border border-current/10 bg-current/[0.04] p-4">
              <p className="mb-2 text-[0.7em] font-semibold uppercase tracking-[0.12em] opacity-50">
                Key Takeaways
              </p>
              <ul className="space-y-2">
                {article.takeaways.map((t) => (
                  <li key={t.slice(0, 40)} className="flex gap-2 text-[0.92em] leading-snug">
                    <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading && (
            <div className="space-y-3 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-current/10"
                  style={{ width: `${70 + (i % 3) * 10}%` }}
                />
              ))}
            </div>
          )}

          {!loading && content?.content && (
            <div
              className="reader-body"
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
          )}

          {!loading && !content?.content && (
            <div className="py-8 text-center opacity-70">
              <p className="mb-3">Couldn’t extract this article.</p>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-4 py-2 text-sm font-medium text-white"
              >
                Open Original <ExternalLink size={14} />
              </a>
            </div>
          )}
        </article>
      </div>

      {/* Zoom overlay */}
      {zoomSrc && (
        <button
          type="button"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomSrc(null)}
          aria-label="Close image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSrc}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </button>
      )}
    </div>
  );
}
