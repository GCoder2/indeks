"""Pydantic models for the search engine."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- Sites ----------------
class Site(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    domain: str  # canonical hostname e.g. "youtube.com"
    seed_url: str  # full URL admin entered
    status: str = "queued"  # queued | crawling | done | failed
    pages_count: int = 0
    category: Optional[str] = None  # AI-detected top-level category for the domain
    description: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


class SiteCreate(BaseModel):
    url: str
    max_pages: Optional[int] = 30


# ---------------- Pages ----------------
class Page(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    site_id: str
    domain: str
    url: str
    title: str = ""
    description: str = ""
    content: str = ""  # truncated text content
    category: Optional[str] = None
    image_url: Optional[str] = None
    favicon: Optional[str] = None
    visits: int = 0
    indexed_at: str = Field(default_factory=_now_iso)


# ---------------- Search / Analytics ----------------
class SearchLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    anon_id: str
    query: str
    results_count: int = 0
    timestamp: str = Field(default_factory=_now_iso)


class ClickLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    anon_id: str
    page_id: str
    query: Optional[str] = None
    timestamp: str = Field(default_factory=_now_iso)


class Favorite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    anon_id: str
    page_id: str
    created_at: str = Field(default_factory=_now_iso)


class SearchResult(BaseModel):
    id: str
    url: str
    title: str
    description: str
    snippet: str
    category: Optional[str] = None
    domain: str
    favicon: Optional[str] = None
    image_url: Optional[str] = None
    visits: int = 0
    score: float = 0.0


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    ai_answer: Optional[str] = None
    ai_sources: List[str] = []
    total: int = 0
    took_ms: int = 0
