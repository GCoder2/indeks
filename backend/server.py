"""FastAPI search-engine backend.

- Admin: add domains, crawl & index pages, AI-classify via Gemini 3 Flash
- Public search with AI summary (Perplexity-style)
- Anonymous user tracking via X-Anon-Id header (cookie on client side)
"""
from __future__ import annotations
import os
import re
import time
import logging
import asyncio
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from models import (
    Site,
    SiteCreate,
    Page,
    SearchLog,
    ClickLog,
    Favorite,
    SearchResult,
    SearchResponse,
)
from crawler import crawl_domain, canonical_domain
from ai import classify_site, perplexity_answer, CATEGORIES


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Emergent Search Engine")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("search")


# ----------------------------- Helpers ----------------------------- #
def anon_id_from(x_anon_id: Optional[str]) -> str:
    return (x_anon_id or "anon-public").strip() or "anon-public"


async def ensure_indexes() -> None:
    try:
        await db.pages.create_index("url", unique=True)
        await db.pages.create_index("domain")
        await db.pages.create_index("category")
        await db.pages.create_index([("title", "text"), ("description", "text"), ("content", "text")])
        await db.sites.create_index("domain", unique=True)
        await db.searches.create_index("query")
        await db.searches.create_index("anon_id")
        await db.clicks.create_index("anon_id")
        await db.favorites.create_index([("anon_id", 1), ("page_id", 1)], unique=True)
    except Exception as e:
        logger.warning(f"Index setup warning: {e}")


@app.on_event("startup")
async def on_startup() -> None:
    await ensure_indexes()
    logger.info("Search engine started.")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    client.close()


# ----------------------------- Admin: Sites ----------------------------- #
async def _run_crawl_task(site_id: str, seed_url: str, max_pages: int) -> None:
    """Background crawl: fetch pages, store, then AI-classify the domain."""
    domain = canonical_domain(seed_url)
    await db.sites.update_one({"id": site_id}, {"$set": {"status": "crawling", "updated_at": datetime.now(timezone.utc).isoformat()}})

    inserted = 0

    async def on_page(p: dict) -> None:
        nonlocal inserted
        page = Page(
            site_id=site_id,
            domain=p["domain"],
            url=p["url"],
            title=p["title"],
            description=p["description"],
            content=p["content"],
            image_url=p.get("image_url"),
            favicon=p.get("favicon"),
        )
        doc = page.model_dump()
        # Avoid conflict between $set and $setOnInsert for 'visits' on upsert
        doc.pop("visits", None)
        try:
            await db.pages.update_one(
                {"url": page.url},
                {"$set": doc, "$setOnInsert": {"visits": 0}},
                upsert=True,
            )
            inserted += 1
        except Exception as e:
            logger.warning(f"page insert failed: {e}")

    try:
        await crawl_domain(seed_url, max_pages=max_pages, max_depth=3, on_page=on_page)

        # AI classify based on collected samples
        sample_titles: list[str] = []
        sample_text_parts: list[str] = []
        cursor = db.pages.find({"site_id": site_id}, {"title": 1, "description": 1}).limit(10)
        async for p in cursor:
            if p.get("title"):
                sample_titles.append(p["title"])
            if p.get("description"):
                sample_text_parts.append(p["description"])
        sample_text = " ".join(sample_text_parts)

        classification = await classify_site(domain, sample_titles, sample_text)

        # Apply category to all pages of the site
        await db.pages.update_many({"site_id": site_id}, {"$set": {"category": classification["category"]}})

        await db.sites.update_one(
            {"id": site_id},
            {
                "$set": {
                    "status": "done",
                    "pages_count": inserted,
                    "category": classification["category"],
                    "description": classification["description"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "error": None,
                }
            },
        )
        logger.info(f"Crawl done: {domain} pages={inserted} cat={classification['category']}")
    except Exception as e:
        logger.exception("crawl failed")
        await db.sites.update_one(
            {"id": site_id},
            {"$set": {"status": "failed", "error": str(e)[:300], "updated_at": datetime.now(timezone.utc).isoformat()}},
        )


@api.post("/admin/sites", response_model=Site)
async def add_site(payload: SiteCreate, background: BackgroundTasks):
    raw = payload.url.strip()
    if not raw:
        raise HTTPException(400, "URL gerekli")
    domain = canonical_domain(raw)
    if not domain or "." not in domain:
        raise HTTPException(400, "Geçersiz URL")

    existing = await db.sites.find_one({"domain": domain}, {"_id": 0})
    if existing:
        raise HTTPException(409, f"{domain} zaten ekli")

    seed = raw if raw.startswith(("http://", "https://")) else "https://" + raw
    site = Site(domain=domain, seed_url=seed)
    await db.sites.insert_one(site.model_dump())
    background.add_task(_run_crawl_task, site.id, seed, max(5, min(payload.max_pages or 30, 10000)))
    return site


@api.get("/admin/sites", response_model=List[Site])
async def list_sites():
    docs = await db.sites.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Site(**d) for d in docs]


@api.delete("/admin/sites/{site_id}")
async def delete_site(site_id: str):
    site = await db.sites.find_one({"id": site_id}, {"_id": 0})
    if not site:
        raise HTTPException(404, "Site bulunamadı")
    await db.pages.delete_many({"site_id": site_id})
    await db.sites.delete_one({"id": site_id})
    return {"ok": True, "deleted": site_id}


@api.post("/admin/sites/{site_id}/recrawl", response_model=Site)
async def recrawl_site(site_id: str, background: BackgroundTasks):
    site = await db.sites.find_one({"id": site_id}, {"_id": 0})
    if not site:
        raise HTTPException(404, "Site bulunamadı")
    await db.pages.delete_many({"site_id": site_id})
    await db.sites.update_one({"id": site_id}, {"$set": {"status": "queued", "pages_count": 0, "error": None}})
    background.add_task(_run_crawl_task, site_id, site["seed_url"], 30)
    site["status"] = "queued"
    site["pages_count"] = 0
    return Site(**site)


@api.get("/admin/stats")
async def admin_stats():
    total_sites = await db.sites.count_documents({})
    total_pages = await db.pages.count_documents({})
    total_searches = await db.searches.count_documents({})

    # Top queries
    pipeline = [
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_queries = []
    async for r in db.searches.aggregate(pipeline):
        top_queries.append({"query": r["_id"], "count": r["count"]})

    # Sites by status
    status_counts: dict = {"queued": 0, "crawling": 0, "done": 0, "failed": 0}
    async for r in db.sites.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]):
        status_counts[r["_id"]] = r["count"]

    return {
        "total_sites": total_sites,
        "total_pages": total_pages,
        "total_searches": total_searches,
        "top_queries": top_queries,
        "status_counts": status_counts,
    }


# ----------------------------- Public: Search ----------------------------- #
def _make_snippet(text: str, query: str, length: int = 240) -> str:
    if not text:
        return ""
    text = text.strip()
    qlow = query.lower()
    tlow = text.lower()
    idx = tlow.find(qlow)
    if idx == -1:
        # try first token
        first = qlow.split()[0] if qlow.split() else ""
        idx = tlow.find(first) if first else -1
    if idx == -1:
        return text[:length]
    start = max(0, idx - 60)
    end = min(len(text), start + length)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


@api.get("/search", response_model=SearchResponse)
async def search(
    q: str,
    category: Optional[str] = None,
    limit: int = 20,
    ai: bool = True,
    x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id"),
):
    start = time.time()
    q = (q or "").strip()
    if not q:
        return SearchResponse(query="", results=[], total=0, took_ms=0)

    anon = anon_id_from(x_anon_id)

    mongo_filter: dict = {"$text": {"$search": q}}
    if category and category != "Tümü":
        mongo_filter["category"] = category

    projection = {
        "_id": 0,
        "score": {"$meta": "textScore"},
        "id": 1, "url": 1, "title": 1, "description": 1, "content": 1,
        "category": 1, "domain": 1, "favicon": 1, "image_url": 1, "visits": 1,
    }

    cursor = db.pages.find(mongo_filter, projection).sort([("score", {"$meta": "textScore"})]).limit(limit)
    docs = await cursor.to_list(limit)

    # Fallback: regex search if text-index returns nothing (e.g. partial words)
    if not docs:
        regex = {"$regex": re.escape(q), "$options": "i"}
        fb_filter: dict = {"$or": [{"title": regex}, {"description": regex}, {"content": regex}]}
        if category and category != "Tümü":
            fb_filter = {"$and": [fb_filter, {"category": category}]}
        docs = await db.pages.find(fb_filter, {"_id": 0}).limit(limit).to_list(limit)
        for d in docs:
            d["score"] = 0.5

    results: List[SearchResult] = []
    for d in docs:
        snippet = _make_snippet(d.get("content") or d.get("description") or "", q)
        results.append(SearchResult(
            id=d["id"],
            url=d["url"],
            title=d.get("title") or d["url"],
            description=d.get("description") or "",
            snippet=snippet,
            category=d.get("category"),
            domain=d.get("domain", ""),
            favicon=d.get("favicon"),
            image_url=d.get("image_url"),
            visits=d.get("visits", 0),
            score=float(d.get("score") or 0),
        ))

    ai_answer = None
    ai_sources: List[str] = []
    if ai and results:
        ai_input = [
            {
                "title": r.title,
                "url": r.url,
                "description": r.description,
                "content": next((d.get("content", "") for d in docs if d.get("id") == r.id), ""),
            }
            for r in results[:5]
        ]
        ai_answer = await perplexity_answer(q, ai_input)
        ai_sources = [r.url for r in results[:5]]

    # Log search
    log = SearchLog(anon_id=anon, query=q.lower(), results_count=len(results))
    await db.searches.insert_one(log.model_dump())
    # Track history (separate collection for per-user fast reads)
    await db.history.insert_one({
        "id": log.id, "anon_id": anon, "query": q,
        "timestamp": log.timestamp, "results_count": len(results),
    })

    took = int((time.time() - start) * 1000)
    return SearchResponse(query=q, results=results, ai_answer=ai_answer, ai_sources=ai_sources, total=len(results), took_ms=took)


@api.get("/categories")
async def list_categories():
    pipeline = [
        {"$match": {"category": {"$ne": None}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    out = []
    async for r in db.pages.aggregate(pipeline):
        out.append({"name": r["_id"], "count": r["count"]})
    return {"all": CATEGORIES, "active": out}


@api.get("/images")
async def image_search(q: str, limit: int = 30):
    """Visual search across indexed pages that have og:images."""
    q = (q or "").strip()
    if not q:
        return {"results": []}
    regex = {"$regex": re.escape(q), "$options": "i"}
    mongo_filter = {
        "image_url": {"$ne": None},
        "$or": [{"title": regex}, {"description": regex}, {"content": regex}],
    }
    docs = await db.pages.find(mongo_filter, {"_id": 0}).limit(limit).to_list(limit)
    return {
        "results": [
            {
                "id": d["id"],
                "url": d["url"],
                "title": d.get("title", ""),
                "image_url": d.get("image_url"),
                "domain": d.get("domain"),
                "favicon": d.get("favicon"),
                "category": d.get("category"),
            }
            for d in docs if d.get("image_url")
        ]
    }


# ----------------------------- Trending ----------------------------- #
@api.get("/trending")
async def trending():
    # Top queries (overall)
    qp = [
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    top_queries = []
    async for r in db.searches.aggregate(qp):
        top_queries.append({"query": r["_id"], "count": r["count"]})

    # Most visited pages
    most_visited_docs = await db.pages.find({"visits": {"$gt": 0}}, {"_id": 0}).sort("visits", -1).limit(8).to_list(8)
    most_visited = [
        {
            "id": d["id"], "url": d["url"], "title": d.get("title"),
            "domain": d.get("domain"), "favicon": d.get("favicon"),
            "category": d.get("category"), "visits": d.get("visits", 0),
        }
        for d in most_visited_docs
    ]
    return {"top_queries": top_queries, "most_visited": most_visited}


# ----------------------------- Click tracking ----------------------------- #
class ClickPayload(SiteCreate):  # tiny payload reuse
    pass


@api.post("/track/click")
async def track_click(
    payload: dict,
    x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id"),
):
    page_id = payload.get("page_id")
    query = payload.get("query")
    if not page_id:
        raise HTTPException(400, "page_id gerekli")
    anon = anon_id_from(x_anon_id)
    cl = ClickLog(anon_id=anon, page_id=page_id, query=query)
    await db.clicks.insert_one(cl.model_dump())
    await db.pages.update_one({"id": page_id}, {"$inc": {"visits": 1}})
    return {"ok": True}


# ----------------------------- User: history & favorites ----------------------------- #
@api.get("/user/history")
async def get_history(x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id"), limit: int = 50):
    anon = anon_id_from(x_anon_id)
    docs = await db.history.find({"anon_id": anon}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"history": docs}


@api.delete("/user/history")
async def clear_history(x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id")):
    anon = anon_id_from(x_anon_id)
    res = await db.history.delete_many({"anon_id": anon})
    return {"deleted": res.deleted_count}


@api.post("/user/favorites")
async def add_favorite(
    payload: dict,
    x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id"),
):
    page_id = payload.get("page_id")
    if not page_id:
        raise HTTPException(400, "page_id gerekli")
    anon = anon_id_from(x_anon_id)
    fav = Favorite(anon_id=anon, page_id=page_id)
    try:
        await db.favorites.insert_one(fav.model_dump())
    except Exception:
        # already exists -> remove (toggle)
        await db.favorites.delete_one({"anon_id": anon, "page_id": page_id})
        return {"ok": True, "favorited": False}
    return {"ok": True, "favorited": True}


@api.get("/user/favorites")
async def list_favorites(x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id")):
    anon = anon_id_from(x_anon_id)
    favs = await db.favorites.find({"anon_id": anon}, {"_id": 0}).sort("created_at", -1).to_list(500)
    page_ids = [f["page_id"] for f in favs]
    pages = await db.pages.find({"id": {"$in": page_ids}}, {"_id": 0}).to_list(500)
    page_map = {p["id"]: p for p in pages}
    out = []
    for f in favs:
        p = page_map.get(f["page_id"])
        if not p:
            continue
        out.append({
            "id": p["id"], "url": p["url"], "title": p.get("title"),
            "description": p.get("description"), "domain": p.get("domain"),
            "favicon": p.get("favicon"), "category": p.get("category"),
            "favorited_at": f["created_at"],
        })
    return {"favorites": out}


@api.delete("/user/favorites/{page_id}")
async def remove_favorite(page_id: str, x_anon_id: Optional[str] = Header(default=None, alias="X-Anon-Id")):
    anon = anon_id_from(x_anon_id)
    await db.favorites.delete_one({"anon_id": anon, "page_id": page_id})
    return {"ok": True}


# ----------------------------- Health ----------------------------- #
@api.get("/")
async def root():
    return {"name": "Emergent Search Engine", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
