"""Backend regression tests for the Turkish AI search engine.

Covers:
  * Admin sites CRUD (add/list/recrawl/delete) + duplicate handling
  * Admin stats
  * Crawl flow + Gemini classification (waits for background task)
  * Public search (with AI answer), categories, trending, images
  * Click tracking and visits increment
  * Anonymous user history & favorites (toggle, list, remove)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend/.env value (the file_of_reference says so)
    BASE_URL = "https://query-finder-24.preview.emergentagent.com"

API = f"{BASE_URL}/api"
ANON = f"pytest-{uuid.uuid4().hex[:10]}"
HEADERS = {"X-Anon-Id": ANON, "Content-Type": "application/json"}

# Test seed domain - use example.com (light, single page) per request
TEST_DOMAIN_URL = "https://example.com"
TEST_DOMAIN = "example.com"


# ---------------- Health ---------------- #
def test_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Admin sites ---------------- #
@pytest.fixture(scope="module")
def ensure_site():
    """Make sure example.com exists; return its id."""
    # Check existing
    r = requests.get(f"{API}/admin/sites", timeout=15)
    assert r.status_code == 200, r.text
    sites = r.json()
    found = next((s for s in sites if s["domain"] == TEST_DOMAIN), None)
    if found:
        return found["id"]
    # Add fresh
    r = requests.post(f"{API}/admin/sites", json={"url": TEST_DOMAIN_URL, "max_pages": 5}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_admin_list_sites():
    r = requests.get(f"{API}/admin/sites", timeout=15)
    assert r.status_code == 200
    sites = r.json()
    assert isinstance(sites, list)
    if sites:
        s = sites[0]
        for f in ("id", "domain", "status", "pages_count"):
            assert f in s


def test_admin_add_site_duplicate(ensure_site):
    # Adding example.com again -> 409
    r = requests.post(f"{API}/admin/sites", json={"url": TEST_DOMAIN_URL}, timeout=15)
    assert r.status_code == 409, f"Expected 409 duplicate, got {r.status_code}: {r.text}"


def test_admin_add_site_invalid_url():
    r = requests.post(f"{API}/admin/sites", json={"url": "not-a-domain"}, timeout=15)
    assert r.status_code == 400


def test_admin_add_site_empty_url():
    r = requests.post(f"{API}/admin/sites", json={"url": ""}, timeout=15)
    assert r.status_code == 400


def test_crawl_completes_and_classifies(ensure_site):
    """Wait for crawl to finish and verify pages_count > 0 + category set."""
    site_id = ensure_site
    deadline = time.time() + 60  # 60s budget
    last = None
    while time.time() < deadline:
        r = requests.get(f"{API}/admin/sites", timeout=15)
        site = next((s for s in r.json() if s["id"] == site_id), None)
        assert site
        last = site
        if site["status"] in ("done", "failed"):
            break
        time.sleep(2)
    assert last is not None
    assert last["status"] == "done", f"Crawl did not finish ok: {last}"
    assert last["pages_count"] >= 1, f"No pages indexed: {last}"
    assert last["category"], f"Category not set by Gemini: {last}"


def test_admin_stats():
    r = requests.get(f"{API}/admin/stats", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for key in ("total_sites", "total_pages", "total_searches", "top_queries", "status_counts"):
        assert key in data
    assert isinstance(data["top_queries"], list)
    assert isinstance(data["status_counts"], dict)
    assert data["total_sites"] >= 1


# ---------------- Public search ---------------- #
def test_search_returns_results_and_ai(ensure_site):
    # First make sure crawl completed
    test_crawl_completes_and_classifies(ensure_site)
    r = requests.get(f"{API}/search", params={"q": "example"}, headers=HEADERS, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["query"] == "example"
    assert isinstance(data["results"], list)
    assert data["total"] >= 1, f"No search results returned: {data}"
    first = data["results"][0]
    for k in ("id", "url", "title", "snippet", "domain"):
        assert k in first
    # AI answer should be present (real Gemini)
    assert data.get("ai_answer"), f"Missing ai_answer: {data}"
    assert isinstance(data.get("ai_sources"), list) and len(data["ai_sources"]) >= 1


def test_search_empty_query():
    r = requests.get(f"{API}/search", params={"q": ""}, headers=HEADERS, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert data["results"] == []


def test_search_with_category_filter():
    r = requests.get(f"{API}/search", params={"q": "example", "category": "Tümü"}, headers=HEADERS, timeout=30)
    assert r.status_code == 200


def test_categories_endpoint():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "all" in data and isinstance(data["all"], list) and len(data["all"]) > 5
    assert "active" in data and isinstance(data["active"], list)


def test_trending_endpoint():
    r = requests.get(f"{API}/trending", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "top_queries" in data and isinstance(data["top_queries"], list)
    assert "most_visited" in data and isinstance(data["most_visited"], list)


def test_image_search():
    r = requests.get(f"{API}/images", params={"q": "example"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "results" in data and isinstance(data["results"], list)


# ---------------- Click tracking + visits ---------------- #
def test_track_click_and_visits():
    # Find a page id via search
    r = requests.get(f"{API}/search", params={"q": "example", "ai": "false"}, headers=HEADERS, timeout=30)
    assert r.status_code == 200
    results = r.json()["results"]
    if not results:
        pytest.skip("No pages in DB for click test")
    page_id = results[0]["id"]
    before = results[0].get("visits", 0)
    r = requests.post(f"{API}/track/click", json={"page_id": page_id, "query": "example"}, headers=HEADERS, timeout=15)
    assert r.status_code == 200 and r.json().get("ok") is True
    # Re-search and check visits increased
    r = requests.get(f"{API}/search", params={"q": "example", "ai": "false"}, headers=HEADERS, timeout=30)
    after_results = r.json()["results"]
    matched = next((x for x in after_results if x["id"] == page_id), None)
    assert matched is not None
    assert matched["visits"] >= before + 1, f"visits did not increment: before={before}, after={matched['visits']}"


def test_track_click_missing_page_id():
    r = requests.post(f"{API}/track/click", json={}, headers=HEADERS, timeout=10)
    assert r.status_code == 400


# ---------------- User history ---------------- #
def test_user_history_flow():
    # do a search to log history under our anon
    requests.get(f"{API}/search", params={"q": "pytest-history-token"}, headers=HEADERS, timeout=30)
    r = requests.get(f"{API}/user/history", headers=HEADERS, timeout=15)
    assert r.status_code == 200
    items = r.json()["history"]
    assert any("pytest-history-token" in (i.get("query") or "") for i in items)
    # clear
    r = requests.delete(f"{API}/user/history", headers=HEADERS, timeout=15)
    assert r.status_code == 200 and r.json()["deleted"] >= 1
    r = requests.get(f"{API}/user/history", headers=HEADERS, timeout=15)
    assert r.json()["history"] == []


# ---------------- Favorites toggle ---------------- #
def test_favorites_flow():
    r = requests.get(f"{API}/search", params={"q": "example", "ai": "false"}, headers=HEADERS, timeout=30)
    results = r.json()["results"]
    if not results:
        pytest.skip("no pages")
    page_id = results[0]["id"]
    # Add
    r = requests.post(f"{API}/user/favorites", json={"page_id": page_id}, headers=HEADERS, timeout=15)
    assert r.status_code == 200
    assert r.json().get("favorited") is True
    # List
    r = requests.get(f"{API}/user/favorites", headers=HEADERS, timeout=15)
    assert r.status_code == 200
    favs = r.json()["favorites"]
    assert any(f["id"] == page_id for f in favs)
    # Toggle off via POST again
    r = requests.post(f"{API}/user/favorites", json={"page_id": page_id}, headers=HEADERS, timeout=15)
    assert r.status_code == 200
    assert r.json().get("favorited") is False
    # Add then DELETE
    requests.post(f"{API}/user/favorites", json={"page_id": page_id}, headers=HEADERS, timeout=15)
    r = requests.delete(f"{API}/user/favorites/{page_id}", headers=HEADERS, timeout=15)
    assert r.status_code == 200


def test_favorites_missing_page_id():
    r = requests.post(f"{API}/user/favorites", json={}, headers=HEADERS, timeout=10)
    assert r.status_code == 400


# ---------------- Recrawl ---------------- #
def test_recrawl(ensure_site):
    site_id = ensure_site
    r = requests.post(f"{API}/admin/sites/{site_id}/recrawl", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == site_id
    assert data["status"] in ("queued", "crawling")


def test_recrawl_not_found():
    r = requests.post(f"{API}/admin/sites/non-existent-id/recrawl", timeout=10)
    assert r.status_code == 404


def test_delete_not_found():
    r = requests.delete(f"{API}/admin/sites/non-existent-id", timeout=10)
    assert r.status_code == 404


# ---------------- Cleanup: only delete if this run created the site ---------------- #
# Note: we intentionally don't delete example.com so the next iteration retains state.
