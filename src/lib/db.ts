"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FeedSource, SavedArticle } from "./types";

interface SignalDeskDB extends DBSchema {
  saved: {
    key: string;
    value: SavedArticle;
    indexes: { "by-savedAt": string };
  };
  customFeeds: {
    key: string;
    value: FeedSource;
  };
  prefs: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = "signaldesk";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SignalDeskDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is client-only");
  }
  if (!dbPromise) {
    dbPromise = openDB<SignalDeskDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("saved")) {
          const store = db.createObjectStore("saved", { keyPath: "id" });
          store.createIndex("by-savedAt", "savedAt");
        }
        if (!db.objectStoreNames.contains("customFeeds")) {
          db.createObjectStore("customFeeds", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("prefs")) {
          db.createObjectStore("prefs", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveArticle(entry: SavedArticle): Promise<void> {
  const db = await getDb();
  await db.put("saved", entry);
}

export async function unsaveArticle(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("saved", id);
}

export async function getSavedArticle(id: string): Promise<SavedArticle | undefined> {
  const db = await getDb();
  return db.get("saved", id);
}

export async function listSavedArticles(): Promise<SavedArticle[]> {
  const db = await getDb();
  const all = await db.getAll("saved");
  return all.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export async function isArticleSaved(id: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get("saved", id);
  return Boolean(row);
}

export async function listCustomFeeds(): Promise<FeedSource[]> {
  const db = await getDb();
  return db.getAll("customFeeds");
}

export async function putCustomFeed(source: FeedSource): Promise<void> {
  const db = await getDb();
  await db.put("customFeeds", source);
}

export async function removeCustomFeed(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("customFeeds", id);
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    const row = await db.get("prefs", key);
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setPref(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("prefs", { key, value });
}
