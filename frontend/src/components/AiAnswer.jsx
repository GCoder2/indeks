import { Sparkles } from "lucide-react";

function renderWithCitations(text, sources) {
  if (!text) return null;
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      const href = sources[idx];
      if (href) {
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="mx-0.5 inline-flex items-center rounded bg-zinc-100 px-1 text-[11px] font-semibold text-zinc-700 align-middle hover:bg-zinc-200"
          >
            {m[1]}
          </a>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AiAnswer({ loading, answer, sources = [] }) {
  if (!loading && !answer) return null;
  return (
    <section data-testid="ai-answer-card" className="ai-card fade-up">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="grid h-7 w-7 place-items-center rounded-md text-white"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
            AI Cevap
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            gemini-3-flash
          </div>
        </div>
      </div>
      {loading ? (
        <>
          <div className="indeterminate-bar mb-3 rounded" />
          <div className="space-y-2">
            <div className="h-3 w-11/12 rounded bg-zinc-100" />
            <div className="h-3 w-10/12 rounded bg-zinc-100" />
            <div className="h-3 w-8/12 rounded bg-zinc-100" />
          </div>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-zinc-800">
            {renderWithCitations(answer, sources)}
          </p>
          {sources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
              {sources.map((s, i) => (
                <a
                  key={s}
                  href={s}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  <span className="font-bold text-zinc-400">{i + 1}</span>
                  <span className="truncate max-w-[180px]">{new URL(s).hostname}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
