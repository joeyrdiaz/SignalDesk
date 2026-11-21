"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, RefreshCw, Search } from "lucide-react";
import { TabBar } from "./TabBar";
import { CategoryPills } from "./CategoryPills";
import { ArticleCard } from "./ArticleCard";
import { ReaderSheet } from "./ReaderSheet";
import { SourcesView } from "./SourcesView";
import { useFeeds } from "@/hooks/useFeeds";
import { listSavedArticles } from "@/lib/db";
import type {
  Article,
  CategoryPill,
  SavedArticle,
  TabId,
  ViewMode,
} from "@/lib/types";

export function AppShell() {
  const [tab, setTab] = useState<TabId>("today");
  const [category, setCategory] = useState<CategoryPill>("all");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("editorial");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Article | null>(null);
  const [saved, setSaved] = useState<SavedArticle[]>([]);
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data, loading, error, customSources, refresh, reloadCustom } = useFeeds({
    category: tab === "streams" || tab === "today" ? category : "all",
    q: debouncedQ,
    refreshKey,
  });

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await listSavedArticles());
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "saved") void loadSaved();
  }, [tab, savedTick, loadSaved]);

  const articles = data?.articles || [];
  const topPick = articles[0] || null;
  const rest = useMemo(
    () => (topPick ? articles.slice(1) : articles),
    [articles, topPick]
  );

  const streamArticles = useMemo(() => {
    if (category === "all") return articles;
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050608] text-white">
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-24 top-[-10%] h-[420px] w-[420px] rounded-full bg-[#0A84FF]/18 blur-[100px]" />
        <div className="absolute -right-16 top-[20%] h-[360px] w-[360px] rounded-full bg-[#BF5AF2]/12 blur-[110px]" />
        <div className="absolute bottom-[10%] left-[20%] h-[280px] w-[280px] rounded-full bg-[#34C759]/08 blur-[90px]" />
      </div>

      <div
        className="mx-auto flex min-h-dvh max-w-lg flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Sticky header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#050608]/75 px-4 pb-3 pt-3 backdrop-blur-2xl">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
                SignalDesk
              </p>
              <h1 className="text-[26px] font-semibold tracking-tight text-white">
                {tab === "today" && "Today"}
                {tab === "streams" && "Streams"}
                {tab === "saved" && "Saved"}
                {tab === "sources" && "Sources"}
              </h1>
            </div>
            <div className="flex items-center gap-1">
              {(tab === "today" || tab === "streams") && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode((m) => (m === "editorial" ? "compact" : "editorial"))
                    }
                    className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"
                    aria-label="Toggle view"
                  >
                    {viewMode === "editorial" ? <List size={18} /> : <LayoutGrid size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefreshKey((k) => k + 1);
                      void refresh();
                    }}
                    className={`rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white ${
                      loading ? "animate-spin" : ""
                    }`}
                    aria-label="Refresh"
                  >
                    <RefreshCw size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {(tab === "today" || tab === "streams") && (
            <>
              <div className="relative mb-3">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, sources, tags…"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.06] py-2.5 pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/20"
                />
              </div>
              <CategoryPills active={category} onChange={setCategory} />
            </>
          )}
        </header>

        {/* Content */}
        <main
          className="flex-1 overflow-y-auto px-4 pt-4"
          style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
              {error}
            </div>
          )}

          {tab === "today" && (
            <div className="space-y-4">
              {loading && !data && (
                <div className="space-y-3">
                  <div className="h-48 animate-pulse rounded-2xl bg-white/[0.06]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                  <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                </div>
              )}

              {topPick && (
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0A84FF]">
                    Today&apos;s Top Pick
                  </p>
                  <ArticleCard
                    article={topPick}
                    mode="editorial"
                    featured
                    onOpen={setSelected}
                  />
                </section>
              )}

              <section className={viewMode === "editorial" ? "space-y-3" : "divide-y divide-white/[0.04]"}>
                {rest.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    mode={viewMode}
                    onOpen={setSelected}
                  />
                ))}
              </section>

              {!loading && articles.length === 0 && (
                <p className="py-16 text-center text-sm text-white/45">
                  No articles matched. Try another category or refresh.
                </p>
              )}

              {data?.stale && (
                <p className="pb-2 text-center text-[11px] text-white/30">
                  Showing cached feed · refreshing in background
                </p>
              )}
            </div>
          )}

          {tab === "streams" && (
            <div className={viewMode === "editorial" ? "space-y-3" : ""}>
              {loading && !data && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
                  ))}
                </div>
              )}
              {streamArticles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  mode={viewMode}
                  onOpen={setSelected}
                />
              ))}
              {!loading && streamArticles.length === 0 && (
                <p className="py-16 text-center text-sm text-white/45">
                  Empty stream — pull to refresh or switch category.
                </p>
              )}
            </div>
          )}

          {tab === "saved" && (
            <div className="space-y-3">
              {saved.length === 0 && (
                <p className="py-16 text-center text-sm text-white/45">
                  Save articles from the reader for offline access.
                </p>
              )}
              {saved.map((s) => (
                <ArticleCard
                  key={s.id}
                  article={s.article}
                  mode="editorial"
                  onOpen={setSelected}
                />
              ))}
            </div>
          )}

          {tab === "sources" && (
            <SourcesView
              data={data}
              customSources={customSources}
              onCustomChanged={async () => {
                await reloadCustom();
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
        </main>

        <TabBar active={tab} onChange={setTab} />
      </div>

      <ReaderSheet
        article={selected}
        onClose={() => setSelected(null)}
        onSavedChange={() => setSavedTick((t) => t + 1)}
      />
    </div>
  );
}
