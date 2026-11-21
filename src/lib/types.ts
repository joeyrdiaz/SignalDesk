export type StreamCategory = "markets" | "equity" | "data" | "ai";

export type CategoryPill = "all" | StreamCategory;

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  siteUrl: string;
  category: StreamCategory;
  quality: number; // 0–1 source quality weight
  custom?: boolean;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  author?: string;
  publishedAt: string;
  summary: string;
  contentSnippet?: string;
  contentEncoded?: string;
  imageUrl?: string;
  sourceId: string;
  sourceName: string;
  category: StreamCategory;
  tags: string[];
  signalScore: number;
  takeaways: string[];
  guid?: string;
}

export interface FeedsResponse {
  articles: Article[];
  sources: FeedSource[];
  cachedAt: string;
  stale: boolean;
  topicMix: { category: StreamCategory; count: number }[];
  feedActivity: { sourceId: string; sourceName: string; count: number }[];
}

export interface ExtractResponse {
  url: string;
  title: string;
  byline?: string;
  excerpt?: string;
  content: string;
  siteName?: string;
  fallback: boolean;
  error?: string;
}

export interface CustomFeedRequest {
  url: string;
  name?: string;
  category?: StreamCategory;
}

export interface CustomFeedResponse {
  source: FeedSource;
  discoveredUrl: string;
  itemCount: number;
}

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderFont = "sans" | "serif";
export type ViewMode = "editorial" | "compact";
export type TabId = "today" | "streams" | "saved" | "sources";

export interface SavedArticle {
  id: string;
  article: Article;
  html: string;
  savedAt: string;
  fallback: boolean;
}
