"""Lightweight async web crawler for indexing domains."""
from __future__ import annotations
import asyncio
import re
from urllib.parse import urljoin, urlparse, urldefrag
from typing import Optional, Set, List, Dict, Any

import httpx
import tldextract
from bs4 import BeautifulSoup


USER_AGENT = "EmergentSearchBot/1.0 (+https://emergent.sh)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
TIMEOUT = httpx.Timeout(15.0, connect=10.0)

SKIP_EXT = (
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".css", ".js", ".pdf", ".zip", ".rar", ".mp4", ".mp3",
    ".woff", ".woff2", ".ttf", ".eot",
)


def canonical_domain(url: str) -> str:
    """Return registered domain (e.g. youtube.com from m.youtube.com/path)."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parts = tldextract.extract(url)
    if parts.suffix:
        return f"{parts.domain}.{parts.suffix}".lower()
    return urlparse(url).hostname or ""


def normalize_url(url: str) -> str:
    url, _ = urldefrag(url)
    return url.rstrip("/")


def is_html_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return not any(path.endswith(ext) for ext in SKIP_EXT)


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text


def extract_page_data(html: str, url: str) -> Dict[str, Any]:
    """Parse HTML and extract title, description, body text, image, links."""
    soup = BeautifulSoup(html, "lxml")

    # Remove non-content
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = clean_text(soup.title.string)
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = clean_text(h1.get_text())

    description = ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        description = clean_text(meta_desc["content"])
    if not description:
        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            description = clean_text(og_desc["content"])

    # OG image
    image_url = None
    og_img = soup.find("meta", attrs={"property": "og:image"})
    if og_img and og_img.get("content"):
        image_url = urljoin(url, og_img["content"])

    # Body text (first ~2000 chars)
    body = soup.body
    text = clean_text(body.get_text(" ", strip=True)) if body else ""
    content = text[:2500]

    # Links
    links: List[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = normalize_url(urljoin(url, href))
        if absolute.startswith(("http://", "https://")):
            links.append(absolute)

    if not description and text:
        description = text[:200]

    return {
        "title": title[:300],
        "description": description[:500],
        "content": content,
        "image_url": image_url,
        "links": links,
    }


async def fetch(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.get(url, follow_redirects=True)
        if r.status_code != 200:
            return None
        ctype = r.headers.get("content-type", "")
        if "text/html" not in ctype and "application/xhtml" not in ctype:
            return None
        return r.text
    except Exception:
        return None


async def crawl_domain(
    seed_url: str,
    max_pages: int = 30,
    max_depth: int = 3,
    on_page=None,
) -> Dict[str, Any]:
    """BFS crawl restricted to the seed's registered domain.

    on_page is an optional async callback receiving the page dict.
    Returns {"domain", "pages_crawled", "pages": [...]}
    """
    if not seed_url.startswith(("http://", "https://")):
        seed_url = "https://" + seed_url

    domain = canonical_domain(seed_url)
    seen: Set[str] = set()
    queue: List[tuple] = [(normalize_url(seed_url), 0)]
    crawled: List[Dict[str, Any]] = []

    favicon = f"https://www.google.com/s2/favicons?domain={domain}&sz=64"

    async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT) as client:
        while queue and len(crawled) < max_pages:
            url, depth = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)

            if not is_html_url(url):
                continue
            if canonical_domain(url) != domain:
                continue

            html = await fetch(client, url)
            if not html:
                continue

            try:
                data = extract_page_data(html, url)
            except Exception:
                continue

            page_record = {
                "url": url,
                "title": data["title"] or url,
                "description": data["description"],
                "content": data["content"],
                "image_url": data["image_url"],
                "favicon": favicon,
                "domain": domain,
            }
            crawled.append(page_record)
            if on_page:
                try:
                    await on_page(page_record)
                except Exception:
                    pass

            if depth < max_depth:
                for link in data["links"]:
                    if link not in seen and canonical_domain(link) == domain:
                        queue.append((link, depth + 1))

            # Be polite
            await asyncio.sleep(0.15)

    return {
        "domain": domain,
        "favicon": favicon,
        "pages_crawled": len(crawled),
        "pages": crawled,
    }
