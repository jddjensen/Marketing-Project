"use client";

import { useCallback, useEffect, useState } from "react";

type Term = { id: string; value: string; addedAt: number };

export function SearchTermsPanel({ platform, projectId }: { platform: string; projectId: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchTerms = useCallback(async () => {
    const res = await fetch(
      `/api/terms?platform=${platform}&projectId=${projectId}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as { terms?: Term[] };
    setTerms(data.terms ?? []);
    setLoading(false);
  }, [platform, projectId]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const addTerms = useCallback(
    async (raw: string) => {
      const values = raw
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return;

      setSubmitting(true);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/terms?platform=${platform}&projectId=${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        });
        const body = (await res.json()) as {
          added?: Term[];
          skipped?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "failed to add terms");
        await fetchTerms();
        setInput("");
        const addedCount = body.added?.length ?? 0;
        const skipped = body.skipped ?? 0;
        if (addedCount > 0 && skipped > 0) {
          setNotice(`Added ${addedCount}. Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`);
        } else if (addedCount === 0 && skipped > 0) {
          setNotice(`Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to add terms");
      } finally {
        setSubmitting(false);
      }
    },
    [fetchTerms, platform, projectId]
  );

  const removeTerm = useCallback(
    async (id: string) => {
      setError(null);
      const res = await fetch(
        `/api/terms?platform=${platform}&projectId=${projectId}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "failed to remove");
        return;
      }
      setTerms((prev) => prev.filter((t) => t.id !== id));
    },
    [platform, projectId]
  );

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Search Terms</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Keywords and queries tied to this campaign. Paste comma- or newline-separated terms to add many at once.
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {terms.length} term{terms.length === 1 ? "" : "s"}
        </span>
      </div>

      <form
        className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!submitting) addTerms(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (!submitting) addTerms(input);
            }
          }}
          placeholder='e.g. "running shoes", best marathon trainers, nike pegasus'
          rows={2}
          className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submitting || input.trim().length === 0}
          className="self-start rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>

      {(error || notice) && (
        <div className="px-5 py-2 text-xs border-b border-zinc-200 dark:border-zinc-800">
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
          {notice && !error && <span className="text-zinc-500">{notice}</span>}
        </div>
      )}

      <div className="px-5 py-4">
        {loading ? (
          <div className="text-sm text-zinc-500 py-4 text-center">Loading…</div>
        ) : terms.length === 0 ? (
          <div className="text-sm text-zinc-500 py-4 text-center">No search terms yet.</div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <li
                key={t.id}
                className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-3 pr-1 py-1 text-sm"
              >
                <span>{t.value}</span>
                <button
                  type="button"
                  onClick={() => removeTerm(t.id)}
                  aria-label={`Remove ${t.value}`}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
