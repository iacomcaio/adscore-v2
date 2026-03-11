"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface WinnersLosers {
  dna: string;
  patterns: string[];
  quotes: string[];
}

interface Creative {
  ad_id: string;
  name: string;
  verdict: string;
  why: string;
  key_quote: string;
  replicable: boolean;
}

interface GeneratedCopy {
  angle: string;
  hook: string;
  body: string;
  cta: string;
  based_on_ad_id: string;
}

interface AnalysisResult {
  winners_summary: WinnersLosers;
  losers_summary: WinnersLosers;
  crucial_difference: string;
  creatives: Creative[];
  generated_copies: GeneratedCopy[];
}

interface Analysis {
  id: string;
  accountId: string;
  period: string;
  adsCount: number;
  winnersCount: number;
  losersCount: number;
  resultJson: AnalysisResult;
  createdAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {copied ? "✅ Copiado!" : "📋 Copiar"}
    </button>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCreatives, setExpandedCreatives] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/analysis/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Carregando análise...</p>
      </main>
    );
  }

  if (!analysis) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Análise não encontrada.</p>
      </main>
    );
  }

  const r = analysis.resultJson;

  const toggleCreative = (adId: string) => {
    setExpandedCreatives((prev) => {
      const next = new Set(prev);
      if (next.has(adId)) next.delete(adId);
      else next.add(adId);
      return next;
    });
  };

  const allCopiesText = r.generated_copies
    .map(
      (c, i) =>
        `--- Copy ${i + 1}: ${c.angle} ---\nHook: ${c.hook}\nBody: ${c.body}\nCTA: ${c.cta}\nBaseado em: ${c.based_on_ad_id}`,
    )
    .join("\n\n");

  return (
    <main className="min-h-screen bg-zinc-50 p-6 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Análise Comparativa</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {analysis.adsCount} criativos · {analysis.winnersCount} winners · {analysis.losersCount} losers · Período: {analysis.period.replace("last_", "")}
            </p>
          </div>
          <Link
            href="/analysis"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Histórico
          </Link>
        </div>

        {/* Card 1: DNA dos Winners */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <h2 className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-300">
            🏆 DNA dos Winners
          </h2>
          <p className="mb-3 text-sm text-zinc-800 dark:text-zinc-200">{r.winners_summary.dna}</p>
          {r.winners_summary.patterns.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Padrões:</span>
              <ul className="ml-4 mt-1 list-disc text-sm text-zinc-700 dark:text-zinc-300">
                {r.winners_summary.patterns.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {r.winners_summary.quotes.length > 0 && (
            <div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Citações:</span>
              {r.winners_summary.quotes.map((q, i) => (
                <blockquote
                  key={i}
                  className="mt-1 border-l-2 border-emerald-400 pl-3 text-sm italic text-zinc-600 dark:text-zinc-400"
                >
                  &ldquo;{q}&rdquo;
                </blockquote>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: DNA dos Losers */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/30">
          <h2 className="mb-3 text-lg font-semibold text-red-800 dark:text-red-300">
            ❌ DNA dos Losers
          </h2>
          <p className="mb-3 text-sm text-zinc-800 dark:text-zinc-200">{r.losers_summary.dna}</p>
          {r.losers_summary.patterns.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Padrões:</span>
              <ul className="ml-4 mt-1 list-disc text-sm text-zinc-700 dark:text-zinc-300">
                {r.losers_summary.patterns.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {r.losers_summary.quotes.length > 0 && (
            <div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Citações:</span>
              {r.losers_summary.quotes.map((q, i) => (
                <blockquote
                  key={i}
                  className="mt-1 border-l-2 border-red-400 pl-3 text-sm italic text-zinc-600 dark:text-zinc-400"
                >
                  &ldquo;{q}&rdquo;
                </blockquote>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Diferença Crucial */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="mb-2 text-lg font-semibold text-amber-800 dark:text-amber-300">
            ⚡ Diferença Crucial
          </h2>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">{r.crucial_difference}</p>
        </div>

        {/* Card 4: Por Criativo */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">📊 Por Criativo</h2>
          <div className="space-y-2">
            {r.creatives.map((c) => (
              <div key={c.ad_id} className="rounded-lg border border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => toggleCreative(c.ad_id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span>
                      {c.verdict === "WINNER" ? "🏆" : c.verdict === "LOSER" ? "❌" : "➡️"}
                    </span>
                    <span className="font-medium">{c.name}</span>
                    {c.replicable && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Replicável
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-400">{expandedCreatives.has(c.ad_id) ? "▲" : "▼"}</span>
                </button>
                {expandedCreatives.has(c.ad_id) && (
                  <div className="border-t border-zinc-100 px-4 py-3 text-sm dark:border-zinc-800">
                    <p className="mb-2 text-zinc-700 dark:text-zinc-300">{c.why}</p>
                    {c.key_quote && (
                      <blockquote className="border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                        &ldquo;{c.key_quote}&rdquo;
                      </blockquote>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card 5: Copies Geradas */}
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-violet-800 dark:text-violet-300">
              ✍️ Copies Geradas
            </h2>
            <CopyButton text={allCopiesText} />
          </div>
          <div className="space-y-4">
            {r.generated_copies.map((copy, i) => (
              <div
                key={i}
                className="rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-800 dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    {copy.angle}
                  </span>
                  <CopyButton
                    text={`Hook: ${copy.hook}\nBody: ${copy.body}\nCTA: ${copy.cta}`}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">Hook: </span>
                    <span className="text-zinc-800 dark:text-zinc-200">{copy.hook}</span>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">Body: </span>
                    <span className="text-zinc-800 dark:text-zinc-200">{copy.body}</span>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">CTA: </span>
                    <span className="text-zinc-800 dark:text-zinc-200">{copy.cta}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Baseado em: {copy.based_on_ad_id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
