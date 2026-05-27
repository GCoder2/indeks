import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { categoriesApi, trendingApi } from "../lib/api";
import { Flame, TrendingUp, Sparkles, Image as ImageIcon } from "lucide-react";

const BG_URL =
  "https://static.prod-images.emergentagent.com/jobs/c05682b2-cbb7-4259-98bb-e85a2ebe1454/images/7e32b0480aac925465a788bc484112793930377f8818a13e7996bca79693f6be.png";

export default function Home() {
  const navigate = useNavigate();
  const [cats, setCats] = useState({ all: [], active: [] });
  const [trend, setTrend] = useState({ top_queries: [], most_visited: [] });

  useEffect(() => {
    categoriesApi().then((r) => setCats(r.data)).catch(() => {});
    trendingApi().then((r) => setTrend(r.data)).catch(() => {});
  }, []);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-30"
        style={{
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
        }}
      />
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-20 lg:py-28">
        <span className="cat-badge mb-6 fade-up">
          <Sparkles className="mr-1.5 h-3 w-3" /> AI destekli — Gemini 3 Flash
        </span>
        <h1
          data-testid="home-title"
          className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-center fade-up delay-1"
        >
          Kendi internetini <span style={{ color: "var(--brand)" }}>indeksle</span>.
        </h1>
        <p className="mt-4 max-w-xl text-center text-zinc-600 fade-up delay-2">
          Sitelerini ekle, sistem onları tarayıp AI ile kategorilere ayırsın. Sonra herkes
          arayabilir.
        </p>
        <div className="mt-8 w-full flex justify-center fade-up delay-3">
          <SearchBar autofocus size="lg" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 fade-up delay-4">
          <span className="text-xs text-zinc-500 mr-1">Hızlı:</span>
          {(trend.top_queries.length ? trend.top_queries.slice(0, 6) : [
            { query: "react" }, { query: "youtube" }, { query: "haber" }, { query: "stripe" },
          ]).map((t) => (
            <button
              key={t.query}
              onClick={() => navigate(`/search?q=${encodeURIComponent(t.query)}`)}
              className="cat-badge hover:bg-zinc-100 cursor-pointer"
              data-testid={`quick-query-${t.query}`}
            >
              {t.query}
            </button>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-6 px-6 pb-20 lg:grid-cols-3">
        <div className="surface p-6 lg:col-span-2 fade-up">
          <div className="mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" strokeWidth={2} />
            <h2 className="font-display text-lg font-bold">En çok aranan</h2>
          </div>
          {trend.top_queries.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz arama yok. İlk aramayı sen yap.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {trend.top_queries.map((t, i) => (
                <li key={t.query} className="flex items-center justify-between py-2.5">
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(t.query)}`)}
                    className="flex items-center gap-3 text-left hover:underline"
                    data-testid={`top-query-${i}`}
                  >
                    <span className="w-6 text-right font-mono text-xs text-zinc-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{t.query}</span>
                  </button>
                  <span className="font-mono text-xs text-zinc-500">{t.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-6 fade-up delay-1">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--brand)" }} strokeWidth={2} />
            <h2 className="font-display text-lg font-bold">En çok ziyaret</h2>
          </div>
          {trend.most_visited.length === 0 ? (
            <p className="text-sm text-zinc-500">Tıklama verisi birikiyor…</p>
          ) : (
            <ul className="space-y-3">
              {trend.most_visited.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-start gap-2 group"
                  >
                    {p.favicon && (
                      <img src={p.favicon} alt="" className="h-4 w-4 mt-1 rounded-sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium group-hover:underline truncate">
                        {p.title || p.url}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{p.domain}</div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{p.visits}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-6 lg:col-span-3 fade-up delay-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" strokeWidth={2} />
              <h2 className="font-display text-lg font-bold">Kategoriler</h2>
            </div>
            <Link to="/admin" className="text-xs text-zinc-500 hover:underline">
              Site ekle →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.all.map((name) => {
              const found = cats.active.find((a) => a.name === name);
              const count = found ? found.count : 0;
              return (
                <button
                  key={name}
                  onClick={() =>
                    navigate(`/search?q=${encodeURIComponent("*")}&cat=${encodeURIComponent(name)}`)
                  }
                  disabled={count === 0}
                  data-testid={`category-${name}`}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    count > 0
                      ? "border-zinc-200 bg-white hover:bg-zinc-50"
                      : "border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                  }`}
                >
                  {name}
                  {count > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-zinc-500">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
