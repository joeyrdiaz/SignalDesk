"use client";

import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/feeds";
import { formatRelativeTime, formatSignal } from "@/lib/format";
import type { Article, ViewMode } from "@/lib/types";

interface ArticleCardProps {
  article: Article;
  mode: ViewMode;
  onOpen: (article: Article) => void;
  featured?: boolean;
}

export function ArticleCard({ article, mode, onOpen, featured }: ArticleCardProps) {
  const accent = CATEGORY_COLORS[article.category];

  if (mode === "compact") {
    return (
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="group flex w-full items-start gap-3 border-b border-white/[0.06] px-1 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-white/45">
            <span>{article.sourceName}</span>
            <span>·</span>
            <span>{formatRelativeTime(article.publishedAt)}</span>
            <span className="ml-auto tabular-nums text-white/30">
              {formatSignal(article.signalScore)}
            </span>
          </div>
          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white/95 group-hover:text-white">
            {article.title}
          </h3>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className={`group w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] text-left backdrop-blur-xl transition-all hover:bg-white/[0.07] ${
        featured ? "shadow-[0_20px_60px_-20px_rgba(10,132,255,0.35)]" : ""
      }`}
    >
      {article.imageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050608]/80 via-transparent to-transparent" />
        </div>
      ) : (
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${accent}, transparent)`,
          }}
        />
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="rounded-md px-1.5 py-0.5 font-medium"
            style={{ background: `${accent}22`, color: accent }}
          >
            {CATEGORY_LABELS[article.category]}
          </span>
          <span className="text-white/40">{article.sourceName}</span>
          <span className="text-white/25">·</span>
          <span className="text-white/40">{formatRelativeTime(article.publishedAt)}</span>
          <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-medium tabular-nums text-white/50">
            σ {formatSignal(article.signalScore)}
          </span>
        </div>
        <h3
          className={`font-semibold leading-snug text-white ${
            featured ? "text-[20px]" : "text-[16px] line-clamp-3"
          }`}
        >
          {article.title}
        </h3>
        {article.summary && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-white/55">
            {article.summary}
          </p>
        )}
        {featured && article.takeaways.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-3">
            {article.takeaways.slice(0, 2).map((t) => (
              <li
                key={t.slice(0, 32)}
                className="flex gap-2 text-[12.5px] leading-snug text-white/65"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#0A84FF]" />
                <span className="line-clamp-2">{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </button>
  );
}
