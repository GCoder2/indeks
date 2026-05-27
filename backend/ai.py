"""AI helpers powered by Gemini 3 Flash via emergentintegrations."""
from __future__ import annotations
import os
import re
import uuid
import json
from typing import List, Dict, Any, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage


EMERGENT_LLM_KEY_VAR = "EMERGENT_LLM_KEY"
MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"


def _get_key() -> str:
    return os.environ.get(EMERGENT_LLM_KEY_VAR, "")


CATEGORIES = [
    "Video",
    "Sosyal Medya",
    "Haber",
    "Eğitim",
    "Teknoloji",
    "E-Ticaret",
    "Eğlence",
    "Müzik",
    "Spor",
    "Finans",
    "Sağlık",
    "Seyahat",
    "Yemek",
    "Oyun",
    "Forum",
    "Blog",
    "Resmi",
    "Dokümantasyon",
    "Araç",
    "Diğer",
]


def _new_chat(system: str) -> LlmChat:
    chat = LlmChat(
        api_key=_get_key(),
        session_id=str(uuid.uuid4()),
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    return chat


async def classify_site(domain: str, sample_titles: List[str], sample_text: str) -> Dict[str, str]:
    """Classify a domain into one of CATEGORIES + short description.

    Returns {"category": str, "description": str}.
    """
    system = (
        "You are a website classifier. Given a domain and some sample page content, "
        "return a strict JSON object with two fields: 'category' (one of the allowed list) "
        "and 'description' (a single short Turkish sentence, max 120 chars, describing the site)."
        f" Allowed categories: {', '.join(CATEGORIES)}."
        " Respond ONLY with a JSON object. No markdown, no preamble."
    )
    sample = (sample_text or "")[:1500]
    titles = " | ".join(sample_titles[:8])
    prompt = (
        f"Domain: {domain}\n"
        f"Sample page titles: {titles}\n"
        f"Sample text: {sample}\n\n"
        "Return JSON: {\"category\": \"...\", \"description\": \"...\"}"
    )

    try:
        chat = _new_chat(system)
        resp = await chat.send_message(UserMessage(text=prompt))
        text = (resp or "").strip()
        # Strip code fences if any
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
        data = json.loads(text)
        cat = data.get("category", "Diğer")
        if cat not in CATEGORIES:
            cat = "Diğer"
        desc = data.get("description", "")[:200]
        return {"category": cat, "description": desc}
    except Exception:
        return {"category": "Diğer", "description": f"({domain})"}


async def perplexity_answer(query: str, results: List[Dict[str, Any]]) -> Optional[str]:
    """Generate a Perplexity-style short answer based on top results."""
    if not results:
        return None

    sources_text = ""
    for i, r in enumerate(results[:5], start=1):
        snippet = (r.get("description") or "") + " " + (r.get("content") or "")
        snippet = snippet[:500]
        sources_text += f"[{i}] {r.get('title','')}\nURL: {r.get('url','')}\n{snippet}\n\n"

    system = (
        "You are a concise search assistant. Answer the user's query in Turkish in 2-4 sentences "
        "using ONLY the provided sources. Cite sources inline as [1], [2] where relevant. "
        "If sources don't contain enough info, say so briefly. Plain text only, no markdown."
    )
    prompt = f"Soru: {query}\n\nKaynaklar:\n{sources_text}\nKısa cevap:"

    try:
        chat = _new_chat(system)
        resp = await chat.send_message(UserMessage(text=prompt))
        return (resp or "").strip() or None
    except Exception:
        return None
