import { useEffect, useState } from "react";
import { getFavoritesApi, removeFavoriteApi } from "../lib/api";
import { Heart, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Favorites() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getFavoritesApi()
      .then((r) => setItems(r.data.favorites || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onRemove = async (id) => {
    await removeFavoriteApi(id);
    toast.success("Favorilerden çıkarıldı");
    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="overline text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            Senin için kaydedildi
          </div>
          <h1 className="font-display text-3xl font-black tracking-tighter">Favoriler</h1>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-zinc-500">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="surface p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 font-display text-xl font-bold">Henüz favori yok</div>
          <p className="mt-1 text-sm text-zinc-600">
            Bir arama sonucunda kalp ikonuna basarak ekleyebilirsin.
          </p>
          <Link to="/" className="btn-primary mt-5 inline-flex">
            Arama yap
          </Link>
        </div>
      ) : (
        <ul data-testid="favorites-list" className="divide-y divide-zinc-100 surface">
          {items.map((p) => (
            <li key={p.id} className="flex items-start gap-3 p-4">
              {p.favicon && <img src={p.favicon} alt="" className="mt-1 h-4 w-4 rounded-sm" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="truncate">{p.domain}</span>
                  {p.category && <span className="cat-badge">{p.category}</span>}
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-blue text-base font-semibold hover:underline"
                >
                  {p.title || p.url}
                </a>
                {p.description && (
                  <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{p.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
                  title="Aç"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => onRemove(p.id)}
                  data-testid="remove-favorite-button"
                  className="rounded-md p-2 text-rose-600 hover:bg-rose-50"
                  title="Kaldır"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
