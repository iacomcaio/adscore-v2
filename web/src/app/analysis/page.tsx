import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function AnalysisHistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-4 text-zinc-800 dark:text-zinc-100">
            Faça login para ver o histórico.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Ir para login
          </Link>
        </div>
      </main>
    );
  }

  const analyses = await prisma.analysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-zinc-50 p-6 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Histórico de Análises</h1>
          <Link
            href="/ads"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Voltar aos criativos
          </Link>
        </div>

        {analyses.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Nenhuma análise realizada ainda.</p>
            <Link
              href="/ads"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Ir para criativos
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((a) => {
              const date = new Date(a.createdAt);
              return (
                <Link
                  key={a.id}
                  href={`/analysis/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {a.adsCount} criativos · {a.winnersCount} winners · {a.losersCount} losers
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Período: {a.period.replace("last_", "")} · Conta: {a.accountId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">
                      {date.toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
