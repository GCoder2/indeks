import { useEffect, useState } from "react";
import { getHistoryApi, clearHistoryApi } from "../lib/api";
import { Clock, Trash2, Search as SearchIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getHistoryApi()
      .then((r) => setItems(r.data.history || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onClear = async () => {
    if (!window.confirm("Tüm arama geçmişin silinecek. Emin misin?")) return;
    await clearHistoryApi();
    toast.success("Geçmiş silindi");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="overline text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            Bu cihazda
          </div>
          <h1 className="font-display text-3xl font-black tracking-tighter">Arama Geçmişi</h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            data-testid="clear-history-button"
            className="btn-secondary !text-rose-600 !border-rose-200 hover:!bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Hepsini sil
          </button>
        )}
      </header>

      {loading ? (
        <div className="text-sm text-zinc-500">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="surface p-10 text-center">
          <Clock className="mx-auto h-8 w-8 text-zinc-300" />
          <div className="mt-3 font-display text-xl font-bold">Geçmiş boş</div>
          <p className="mt-1 text-sm text-zinc-600">
            İlk araman burada görünecek. Tüm geçmiş anonim olarak cihazına bağlı tutulur.
          </p>
          <Link to="/" className="btn-primary mt-5 inline-flex">
            Aramaya başla
          </Link>
        </div>
      ) : (
        <ul className="surface divide-y divide-zinc-100" data-testid="history-list">
          {items.map((h) => (
            <li key={h.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50/60">
              <SearchIcon className="h-4 w-4 text-zinc-400" />
              <button
                onClick={() => navigate(`/search?q=${encodeURIComponent(h.query)}`)}
                className="flex-1 text-left text-sm font-medium hover:underline"
              >
                {h.query}
              </button>
              <span className="font-mono text-xs text-zinc-400">
                {new Date(h.timestamp).toLocaleString()}
              </span>
              <span className="font-mono text-xs text-zinc-500 w-16 text-right">
                {h.results_count} sonuç
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
