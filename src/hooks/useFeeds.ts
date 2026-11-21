"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedSource, FeedsResponse } from "@/lib/types";
import { listCustomFeeds } from "@/lib/db";

interface UseFeedsOptions {
  category?: string;
  q?: string;
  refreshKey?: number;
}

export function useFeeds({ category = "all", q = "", refreshKey = 0 }: UseFeedsOptions) {
  const [data, setData] = useState<FeedsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customSources, setCustomSources] = useState<FeedSource[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reloadCustom = useCallback(async () => {
    try {
      const feeds = await listCustomFeeds();
      setCustomSources(feeds);
      return feeds;
    } catch {
      setCustomSources([]);
      return [] as FeedSource[];
    }
  }, []);

  const fetchFeeds = useCallback(
    async (customs: FeedSource[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (q) params.set("q", q);
      if (customs.length) {
        params.set("custom", JSON.stringify(customs));
      }

      try {
        const res = await fetch(`/api/feeds?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Feeds request failed (${res.status})`);
        }
        const json = (await res.json()) as FeedsResponse;
        setData(json);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load feeds");
      } finally {
        setLoading(false);
      }
    },
    [category, q]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const customs = await reloadCustom();
      if (!cancelled) await fetchFeeds(customs);
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [fetchFeeds, reloadCustom, refreshKey]);

  const refresh = useCallback(async () => {
    const customs = await reloadCustom();
    await fetchFeeds(customs);
  }, [fetchFeeds, reloadCustom]);

  return {
    data,
    loading,
    error,
    customSources,
    refresh,
    reloadCustom,
  };
}
