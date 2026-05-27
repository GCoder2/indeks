import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import AiAnswer from "../components/AiAnswer";
import ResultItem from "../components/ResultItem";
import { categoriesApi, searchApi, imageSearchApi } from "../lib/api";
import { Image as ImageIcon, List, Loader2 } from "lucide-react";

export default function Results() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const catParam = params.get("cat") || "";
  const tab = params.get("tab") || "web";

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [data, setData] = useState(null);
  const [imgs, setImgs] = useState([]);
  const [cats, setCats] = useState({ all: [], active: [] });

  useEffect(() => {
    categoriesApi().then((r) => setCats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q) return;
    if (tab === "images") {
      setLoading(true);
      imageSearchApi(q)
        .then((r) => setImgs(r.data.results || []))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    setAiLoading(true);
    setData(null);
    searchApi(q, { category: catParam || undefined })
      .then((r) => {
        setData(r.data);
      })
      .catch(() => setData({ results: [], ai_answer: null, total: 0, took_ms: 0 }))
      .finally(() => {
        setLoading(false);
        setAiLoading(false);
      });
  }, [q, catParam, tab]);

  const setTab = (t) => {
    const p = new URLSearchParams(params);
    p.set("tab", t);
    setParams(p);
  };

  const setCat = (name) => {
    const p = new URLSearchParams(params);
    if (!name || name === "Tümü") p.delete("cat");
    else p.set("cat", name);
    setParams(p);
  };

  const activeCats = useMemo(() => cats.active || [], [cats]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchBar initial={q} size="md" />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          <button
            data-testid="tab-web"
            onClick={() => setTab("web")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              tab === "web" ? "bg-zinc-900 text-white" : "text-zinc-700"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Web
          </button>
          <button
            data-testid="tab-images"
            onClick={() => setTab("images")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              tab === "images" ? "bg-zinc-900 text-white" : "text-zinc-700"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Görsel
          </button>
        </div>
      </div>

      {tab === "web" && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCat("")}
            className={`cat-badge ${!catParam ? "bg-zinc-900 text-white border-zinc-900" : ""}`}
          >
            Tümü
          </button>
          {activeCats.map((c) => (
            <button
              key={c.name}
              data-testid={`filter-${c.name}`}
              onClick={() => setCat(c.name)}
              className={`cat-badge ${
                catParam === c.name ? "bg-zinc-900 text-white border-zinc-900" : ""
              }`}
            >
              {c.name} <span className="ml-1 opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-8 space-y-6">
          {tab === "web" && (
            <>
              <AiAnswer
                loading={aiLoading && q && q !== "*"}
                answer={data?.ai_answer}
                sources={data?.ai_sources || []}
              />

              {loading && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Aranıyor…
                </div>
              )}

              {!loading && data && (
                <>
                  <div className="text-xs text-zinc-500 font-mono">
                    {data.total} sonuç · {data.took_ms}ms
                  </div>
                  {data.results.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div data-testid="results-list">
                      {data.results.map((r, i) => (
                        <ResultItem key={r.id} result={r} query={q} index={i} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === "images" && (
            <>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Görseller yükleniyor…
                </div>
              ) : imgs.length === 0 ? (
                <EmptyState images />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imgs.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-testid="image-result"
                      className="group block overflow-hidden rounded-lg border border-zinc-200 bg-white transition-transform hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-zinc-100">
                        <img
                          src={p.image_url}
                          alt={p.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          onError={(e) => (e.currentTarget.style.opacity = 0.2)}
                        />
                      </div>
                      <div className="p-3">
                        <div className="text-xs text-zinc-500 truncate">{p.domain}</div>
                        <div className="text-sm font-medium line-clamp-2">{p.title}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <aside className="lg:col-span-4 space-y-4">
          <div className="surface p-5">
            <div className="overline mb-2 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
              Aranan
            </div>
            <div className="font-display text-2xl font-bold break-words">{q}</div>
            {data && (
              <div className="mt-3 text-xs text-zinc-500 font-mono">
                {data.total} sonuç bulundu
              </div>
            )}
          </div>
          {activeCats.length > 0 && tab === "web" && (
            <div className="surface p-5">
              <div className="overline mb-3 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
                Kategoriler
              </div>
              <ul className="space-y-1 text-sm">
                {activeCats.map((c) => (
                  <li key={c.name}>
                    <button
                      onClick={() => setCat(c.name)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-zinc-50 ${
                        catParam === c.name ? "bg-zinc-100 font-semibold" : ""
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{c.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ images }) {
  return (
    <div className="surface p-10 text-center">
      <div className="font-display text-xl font-bold">Sonuç bulunamadı</div>
      <p className="mt-2 text-sm text-zinc-600">
        {images
          ? "Bu sorgu için indekslenmiş görsel yok."
          : "Farklı bir terim dene veya yönetim panelinden site ekle."}
      </p>
      <Link to="/admin" className="btn-secondary mt-4 inline-flex">
        Site ekle
      </Link>
    </div>
  );
}
