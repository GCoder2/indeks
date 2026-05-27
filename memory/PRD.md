# PRD — indeks. (AI-powered Search Engine)

## Original Problem Statement
"Şimdi senden bir arama motoru yapmanı istiyorum."

Clarified by user:
- Admins add site URLs in a panel; system crawls every page under that domain (e.g. youtube.com → youtube.com/...).
- Cheapest AI model (Gemini 3 Flash) classifies each site by type / category.
- Public-facing search with Perplexity-style AI answers (Gemini 3 Flash).
- Features: search history, favorites, image search, categories, most-searched, most-visited.
- Anonymous user tracking via cookies (no login).

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + Motor (MongoDB) + httpx/BeautifulSoup crawler (`crawler.py`) + Gemini-3-Flash via `emergentintegrations` (`ai.py`).
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + sonner + lucide-react. Anonymous identity stored in cookie `emg_anon_id` (1y) and sent as `X-Anon-Id` header.
- **MongoDB collections**: `sites`, `pages` (text index on title/description/content), `searches`, `history`, `clicks`, `favorites`.

## User Personas
- **Visitor (anonymous)**: searches, gets AI answer with citations, browses categories, saves favorites, recalls history — all anchored by anon cookie.
- **Admin (open, no auth in MVP)**: adds new domains to index, monitors crawl status, sees stats.

## Core Requirements
- Background crawl per domain (BFS, same-registered-domain, max_pages, max_depth=3).
- AI classification on completed crawl → category + short Turkish description applied to all pages.
- Search with Mongo text index + regex fallback; optional category filter.
- AI answer (Perplexity-style with [1][2] citations) generated from top-5 results when `ai=true`.
- Per-anonymous-id: history, favorites, click tracking, anon ID never leaves cookie/header.
- Trending: top queries (aggregation), most visited (page.visits desc).
- Image search: pages with og:image filtered by query.

## What's Been Implemented (2026-02-27)
- ✅ Admin endpoints: add / list / recrawl / delete sites; stats dashboard.
- ✅ Public endpoints: /api/search (with AI), /api/images, /api/categories, /api/trending, /api/track/click.
- ✅ User endpoints: /api/user/history (GET/DELETE), /api/user/favorites (POST toggle / GET / DELETE).
- ✅ Background crawler with same-domain BFS, capped pages/depth.
- ✅ Gemini 3 Flash classifier (returns category + Turkish description, model `gemini-3-flash-preview`).
- ✅ Gemini 3 Flash Perplexity-style answer with inline citation links.
- ✅ Anonymous cookie identity flow end-to-end.
- ✅ Frontend: Home, Results (Web + Images tabs, AI card, filters), Admin (stats + add/recrawl/delete table), Favorites, History — Swiss-inspired light theme per design_guidelines.
- ✅ 21/21 backend tests passing; all critical frontend flows verified by testing agent.

## Prioritized Backlog
### P0 (next, before scaling)
- Protect admin endpoints with an `X-Admin-Token` env-backed header (currently open).
- Stale-crawl watchdog: reset `status=crawling` rows older than N minutes on startup.

### P1
- Short-TTL cache (per query) for `/api/search` AI answer to cut Gemini cost and latency.
- Split `server.py` into `routers/admin.py`, `routers/search.py`, `routers/user.py`.
- Respect `robots.txt` + `Crawl-Delay` in crawler.

### P2
- Replace `dict` payloads on `/api/track/click` and `/api/user/favorites` with Pydantic models.
- Migrate `on_event` to FastAPI lifespan handlers.
- Pagination on search (currently capped at `limit`).
- Sitemap.xml discovery and bigger per-domain page caps.
- Real-time crawl progress via Server-Sent Events.
- "Site önizleme" hover card for results with og:image preview.

## Next Tasks
- Implement P0 items.
- Add at least 3 seed domains (or expose an "Import top sites" admin button) so first-time visitors see populated trending & categories.
