import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, Loader2 } from "lucide-react";

export default function SearchBar({ initial = "", autofocus = false, size = "lg" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    if (autofocus) inputRef.current?.focus();
  }, [autofocus]);

  const onSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setTimeout(() => setLoading(false), 300);
  };

  const isLg = size === "lg";

  return (
    <form
      data-testid="search-form"
      onSubmit={onSubmit}
      className={`group flex w-full items-center gap-2 rounded-2xl border-2 bg-white px-4 transition-all focus-within:border-[var(--brand)] focus-within:shadow-sm ${
        isLg ? "h-16 max-w-2xl" : "h-12 max-w-xl"
      }`}
      style={{ borderColor: "rgb(228 228 231)" }}
    >
      <Search
        className={`text-zinc-400 ${isLg ? "h-5 w-5" : "h-4 w-4"}`}
        strokeWidth={1.75}
      />
      <input
        ref={inputRef}
        data-testid="search-input"
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Bir şey ara..."
        className={`flex-1 bg-transparent outline-none placeholder:text-zinc-400 ${
          isLg ? "text-lg" : "text-base"
        }`}
      />
      <button
        type="submit"
        data-testid="search-submit"
        disabled={!q.trim() || loading}
        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Ara <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
