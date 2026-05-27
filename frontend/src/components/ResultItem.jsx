import { Heart, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toggleFavoriteApi, trackClickApi, getFavoritesApi } from "../lib/api";
import { toast } from "sonner";

let _favCache = null; // module-level cache of favorite ids for the session

async function loadFavIds(force = false) {
  if (_favCache && !force) return _favCache;
  try {
    const r = await getFavoritesApi();
    _favCache = new Set((r.data.favorites || []).map((f) => f.id));
  } catch {
    _favCache = new Set();
  }
  return _favCache;
}

export default function ResultItem({ result, query, index = 0 }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadFavIds().then((set) => {
      if (mounted) setFav(set.has(result.id));
    });
    return () => {
      mounted = false;
    };
  }, [result.id]);

  const onToggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const r = await toggleFavoriteApi(result.id);
      const favorited = r.data.favorited;
      setFav(favorited);
      const set = await loadFavIds();
      if (favorited) set.add(result.id);
      else set.delete(result.id);
      toast.success(favorited ? "Favorilere eklendi" : "Favorilerden çıkarıldı");
    } catch {
      toast.error("İşlem başarısız");
    }
  };

  const onOpen = () => {
    trackClickApi(result.id, query).catch(() => {});
  };

  return (
    <article
      data-testid="search-result-item"
      className="group fade-up border-b border-zinc-100 py-5 last:border-0"
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        {result.favicon && (
          <img
            src={result.favicon}
            alt=""
            className="h-4 w-4 rounded-sm border border-zinc-100 bg-white"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <span className="truncate">{result.domain}</span>
        {result.category && <span className="cat-badge ml-1">{result.category}</span>}
      </div>
      <h3 className="text-lg font-bold leading-snug">
        <a
          data-testid="result-title-link"
          href={result.url}
          onClick={onOpen}
          target="_blank"
          rel="noreferrer noopener"
          className="link-blue group-hover:underline"
        >
          {result.title}
        </a>
      </h3>
      <p className="mt-1.5 text-sm text-zinc-700 line-clamp-3">{result.snippet || result.description}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <button
          type="button"
          data-testid="favorite-button"
          onClick={onToggleFav}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
            fav
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${fav ? "fill-rose-500 text-rose-500" : ""}`} strokeWidth={1.75} />
          {fav ? "Favori" : "Favori ekle"}
        </button>
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 hover:bg-zinc-50"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} /> Aç
        </a>
        {result.visits > 0 && (
          <span className="text-zinc-400">· {result.visits} ziyaret</span>
        )}
      </div>
    </article>
  );
}
