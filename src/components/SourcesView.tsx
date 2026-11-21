"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, CURATED_FEEDS } from "@/lib/feeds";
import { putCustomFeed, removeCustomFeed } from "@/lib/db";
import type { CustomFeedResponse, FeedSource, FeedsResponse, StreamCategory } from "@/lib/types";

interface SourcesViewProps {
  data: FeedsResponse | null;
  customSources: FeedSource[];
  onCustomChanged: () => void;
}

const PIE_COLORS = [
  CATEGORY_COLORS.markets,
  CATEGORY_COLORS.equity,
  CATEGORY_COLORS.data,
  CATEGORY_COLORS.ai,
];

export function SourcesView({ data, customSources, onCustomChanged }: SourcesViewProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StreamCategory>("markets");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const topicData = useMemo(
    () =>
      (data?.topicMix || []).map((t) => ({
        name: CATEGORY_LABELS[t.category],
        value: t.count,
        category: t.category,
      })),
    [data]
  );

  const activityData = useMemo(
    () =>
      (data?.feedActivity || []).slice(0, 8).map((f) => ({
        name: f.sourceName.length > 14 ? `${f.sourceName.slice(0, 12)}…` : f.sourceName,
        count: f.count,
      })),
    [data]
  );

  const addFeed = async () => {
    if (!url.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/feeds/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          category,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Failed to add feed");
        return;
      }
      const body = json as CustomFeedResponse;
      await putCustomFeed(body.source);
      setUrl("");
      setName("");
      setMsg(`Added ${body.source.name} (${body.itemCount} items)`);
      onCustomChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    await removeCustomFeed(id);
    onCustomChanged();
  };

  return (
    <div className="space-y-6 pb-4">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl">
        <h2 className="mb-1 text-[15px] font-semibold text-white">Topic Mix</h2>
        <p className="mb-3 text-[12px] text-white/45">Distribution of articles in the current pull</p>
        <div className="h-48">
          {topicData.some((t) => t.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {topicData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#12141a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              Load feeds to see mix
            </div>
          )}
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-3">
          {topicData.map((t, i) => (
            <div key={t.name} className="flex items-center gap-1.5 text-[11px] text-white/60">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              {t.name} ({t.value})
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl">
        <h2 className="mb-1 text-[15px] font-semibold text-white">Feed Activity</h2>
        <p className="mb-3 text-[12px] text-white/45">Top sources by article count</p>
        <div className="h-52">
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#12141a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#0A84FF" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              No activity yet
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl">
        <h2 className="mb-1 text-[15px] font-semibold text-white">Add Custom Feed</h2>
        <p className="mb-3 text-[12px] text-white/45">
          Paste a Substack, blog, or newsletter URL — we auto-discover /feed or /rss
        </p>
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.substack.com"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#0A84FF]/50"
          />
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (optional)"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as StreamCategory)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.06] px-2 py-2.5 text-[13px] text-white outline-none"
            >
              {(Object.keys(CATEGORY_LABELS) as (StreamCategory | "all")[])
                .filter((k) => k !== "all")
                .map((k) => (
                  <option key={k} value={k} className="bg-[#12141a]">
                    {CATEGORY_LABELS[k]}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addFeed}
            disabled={adding || !url.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Source
          </button>
          {msg && <p className="text-[12px] text-white/55">{msg}</p>}
        </div>

        {customSources.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            {customSources.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{s.name}</p>
                  <p className="truncate text-[11px] text-white/40">{s.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-white">
          Library ({CURATED_FEEDS.length})
        </h2>
        <ul className="space-y-1.5">
          {CURATED_FEEDS.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: CATEGORY_COLORS[s.category] }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/90">{s.name}</p>
                <p className="text-[11px] text-white/40">
                  {CATEGORY_LABELS[s.category]} · Q {Math.round(s.quality * 100)}
                </p>
              </div>
              <a
                href={s.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-white/35 hover:bg-white/10 hover:text-white/70"
              >
                <ExternalLink size={14} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
