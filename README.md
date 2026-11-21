# SignalDesk

iPhone-first intelligence aggregator + full-text in-app reader for Finance, Macro Markets, Equity Valuation, Data Science, Analytics, and AI/ML.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- `@mozilla/readability`, `jsdom`, `isomorphic-dompurify`, `rss-parser`, `lucide-react`, `recharts`, `idb`
- PWA manifest + Apple web-app meta + safe-area padding

## Run

```bash
cd signaldesk
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

```bash
npm run build && npm start
```

## APIs

| Route | Purpose |
| --- | --- |
| `GET /api/feeds` | Aggregate curated RSS/Atom feeds, score, tag, takeaways, SWR cache |
| `GET/POST /api/extract?url=` | Readability extraction + DOMPurify; RSS fallback |
| `POST /api/feeds/custom` | Validate + auto-discover `/feed` or `/rss` |

## Notes

- Zero mock articles — curated library uses real public feed URLs.
- Custom feeds persist in IndexedDB; Saved articles store full extracted HTML offline.
- Lyn Alden may return HTTP 202 intermittently; IMF/Mode public RSS were unavailable at build time and were replaced with Bloomberg Markets / Databricks / Analytics Vidhya.
