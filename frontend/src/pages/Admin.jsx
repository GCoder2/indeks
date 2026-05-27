import { useEffect, useState } from "react";
import {
  adminAddSiteApi,
  adminListSitesApi,
  adminDeleteSiteApi,
  adminRecrawlApi,
  adminStatsApi,
} from "../lib/api";
import { Plus, RefreshCw, Trash2, Loader2, Globe, Database, Search, ListChecks } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES = {
  queued: "bg-amber-50 text-amber-700 border-amber-200",
  crawling: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Admin() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(30);
  const [adding, setAdding] = useState(false);
  const [sites, setSites] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [s, st] = await Promise.all([adminListSitesApi(), adminStatsApi()]);
      setSites(s.data);
      setStats(st.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const onAdd = async (e) => {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;
    setAdding(true);
    try {
      await adminAddSiteApi(target, maxPages);
      toast.success("Site eklendi — taranıyor");
      setUrl("");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (id, domain) => {
    if (!window.confirm(`${domain} indeksinden çıkarılacak. Emin misin?`)) return;
    try {
      await adminDeleteSiteApi(id);
      toast.success("Silindi");
      refresh();
    } catch {
      toast.error("Silinemedi");
    }
  };

  const onRecrawl = async (id) => {
    try {
      await adminRecrawlApi(id);
      toast.success("Yeniden tarama başladı");
      refresh();
    } catch {
      toast.error("Başlatılamadı");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="overline text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            Yönetim
          </div>
          <h1 className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
            İndeks Paneli
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Site ekle. Sistem alan adındaki tüm sayfaları tarar, Gemini 3 Flash ile sınıflar.
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary" data-testid="refresh-button">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Yenile
        </button>
      </div>

      {/* Stat grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Globe} label="Siteler" value={stats?.total_sites ?? "—"} />
        <StatCard icon={Database} label="Sayfalar" value={stats?.total_pages ?? "—"} />
        <StatCard icon={Search} label="Aramalar" value={stats?.total_searches ?? "—"} />
        <StatCard
          icon={ListChecks}
          label="Aktif iş"
          value={(stats?.status_counts?.crawling ?? 0) + (stats?.status_counts?.queued ?? 0)}
        />
      </div>

      {/* Add site form */}
      <form
        onSubmit={onAdd}
        data-testid="add-site-form"
        className="surface mb-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="block overline mb-1.5 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            Site URL
          </label>
          <input
            data-testid="site-url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="örn. https://news.ycombinator.com"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <div className="w-full sm:w-40">
          <label className="block overline mb-1.5 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            Max Sayfa
          </label>
          <input
            data-testid="max-pages-input"
            type="number"
            min={5}
            max={200}
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value || "30", 10))}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <button
          type="submit"
          data-testid="add-site-button"
          disabled={adding || !url.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ekle ve İndeksle
        </button>
      </form>

      {/* Sites table */}
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-display text-lg font-bold">İndekslenen Siteler</h2>
          <span className="text-xs text-zinc-500 font-mono">{sites.length} toplam</span>
        </div>
        {sites.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Henüz site eklenmedi. Yukarıdan bir URL ekleyerek başla.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Domain</th>
                <th className="px-5 py-3 font-semibold">Kategori</th>
                <th className="px-5 py-3 font-semibold">Durum</th>
                <th className="px-5 py-3 font-semibold text-right">Sayfa</th>
                <th className="px-5 py-3 font-semibold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sites.map((s) => (
                <tr key={s.id} data-testid="site-row" className="hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium">{s.domain}</div>
                    <div className="text-xs text-zinc-500 truncate max-w-[300px]">
                      {s.description || s.seed_url}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {s.category ? (
                      <span className="cat-badge">{s.category}</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[s.status] || ""
                      }`}
                    >
                      {s.status === "crawling" && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {s.status}
                    </span>
                    {s.error && (
                      <div className="mt-1 text-xs text-rose-600 truncate max-w-[260px]">
                        {s.error}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-700">
                    {s.pages_count}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="recrawl-button"
                        onClick={() => onRecrawl(s.id)}
                        className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Yeniden tara"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-testid="delete-site-button"
                        onClick={() => onDelete(s.id, s.domain)}
                        className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top queries */}
      {stats?.top_queries?.length > 0 && (
        <div className="surface mt-8 p-5">
          <h2 className="mb-3 font-display text-lg font-bold">En Çok Aranan Sorgular</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.top_queries.map((q) => (
              <li
                key={q.query}
                className="flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
              >
                <span className="truncate">{q.query}</span>
                <span className="font-mono text-xs text-zinc-500">{q.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}
