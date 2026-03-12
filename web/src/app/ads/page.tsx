import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClassifiedAdsForAccount, type ClassifiedAd } from "@/lib/meta-api";
import { ensureTranscriptionForVideo } from "@/lib/transcription";

type AdsPageProps = {
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    period?: string;
  }>;
};

function sortAds(ads: ClassifiedAd[], sort?: string, dir?: string): ClassifiedAd[] {
  const direction = dir === "asc" ? 1 : -1;
  const key = sort ?? "spend";

  const sorted = [...ads].sort((a, b) => {
    switch (key) {
      case "name":
        return direction * a.name.localeCompare(b.name);
      case "purchases":
        return direction * (a.purchases - b.purchases);
      case "cpa":
        return direction * ((a.cpa ?? Infinity) - (b.cpa ?? Infinity));
      case "ctr":
        return direction * ((a.ctr ?? 0) - (b.ctr ?? 0));
      case "roas":
        return direction * ((a.roas ?? 0) - (b.roas ?? 0));
      case "spend":
      default:
        return direction * (a.spend - b.spend);
    }
  });

  return sorted;
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function verdictLabel(verdict: ClassifiedAd["verdict"]): string {
  switch (verdict) {
    case "WINNER":
      return "🏆 Winner";
    case "LOSER":
      return "❌ Loser";
    case "MEDIANO":
      return "➡️ Mediano";
    case "SEM_DADOS":
    default:
      return "Sem dados suficientes";
  }
}

export default async function AdsPage({ searchParams }: AdsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-4 text-zinc-800 dark:text-zinc-100">
            Você precisa estar logado para ver os anúncios.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Ir para login
          </Link>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.metaToken || !user.selectedAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-4 text-zinc-800 dark:text-zinc-100">
            Conecte sua conta Meta Ads e selecione uma conta de anúncio para ver os criativos.
          </p>
          <Link
            href="/meta/connect"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Conectar Meta Ads
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const sort = params?.sort;
  const dir = params?.dir;
  const period = params?.period ?? "last_30d";

  const ads = await getClassifiedAdsForAccount({
    accountId: user.selectedAccount,
    accessToken: user.metaToken,
    period,
  });

  const videoIds = Array.from(
    new Set(
      ads
        .filter((ad) => ad.type === "video" && ad.videoId)
        .map((ad) => ad.videoId as string),
    ),
  );

  const existingTranscriptions = videoIds.length
    ? await prisma.transcription.findMany({
        where: { videoId: { in: videoIds } },
        select: { videoId: true },
      })
    : [];

  const transcribedVideoIds = new Set(existingTranscriptions.map((t) => t.videoId));

  const sortedAds = sortAds(ads, sort, dir);

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50 p-6 text-sm text-zinc-900 dark:bg-black dark:text-zinc-50">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Criativos da conta</h1>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Exibindo anúncios com spend &gt; 0, excluindo posts impulsionados, classificados por
            performance.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Período:</span>
            <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              {["last_7d", "last_14d", "last_30d", "last_90d", "maximum"].map((p) => (
                <Link
                  key={p}
                  href={{
                    pathname: "/ads",
                    query: { ...params, period: p },
                  }}
                  className={`rounded px-2 py-1 ${
                    period === p
                      ? "bg-black text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {p === "maximum" ? "Tudo" : p.replace("last_", "")}d
                </Link>
              ))}
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              const { runComparativeAnalysis } = await import("@/lib/analysis");
              await runComparativeAnalysis({ userId: user.id, period });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Rodar análise comparativa
            </button>
          </form>
        </div>
      </header>

      {sortedAds.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nenhum anúncio com spend &gt; 0 encontrado para o período selecionado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full table-fixed border-collapse text-xs">
            <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <tr>
                <th className="w-16 px-3 py-2">Thumb</th>
                <th className="w-64 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: { ...params, sort: "name", dir: dir === "asc" ? "desc" : "asc" },
                    }}
                  >
                    Nome
                  </Link>
                </th>
                <th className="w-16 px-3 py-2">Tipo</th>
                <th className="w-20 px-3 py-2">Status</th>
                <th className="w-24 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: { ...params, sort: "spend", dir: dir === "asc" ? "desc" : "asc" },
                    }}
                  >
                    Spend
                  </Link>
                </th>
                <th className="w-24 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: {
                        ...params,
                        sort: "purchases",
                        dir: dir === "asc" ? "desc" : "asc",
                      },
                    }}
                  >
                    Compras
                  </Link>
                </th>
                <th className="w-24 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: { ...params, sort: "cpa", dir: dir === "asc" ? "desc" : "asc" },
                    }}
                  >
                    CPA
                  </Link>
                </th>
                <th className="w-20 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: { ...params, sort: "ctr", dir: dir === "asc" ? "desc" : "asc" },
                    }}
                  >
                    CTR
                  </Link>
                </th>
                <th className="w-20 px-3 py-2">
                  <Link
                    href={{
                      pathname: "/ads",
                      query: { ...params, sort: "roas", dir: dir === "asc" ? "desc" : "asc" },
                    }}
                  >
                    ROAS
                  </Link>
                </th>
                <th className="w-32 px-3 py-2">Veredicto</th>
                <th className="w-32 px-3 py-2">Transcrição</th>
              </tr>
            </thead>
            <tbody>
              {sortedAds.map((ad) => (
                <tr
                  key={ad.id}
                  className="border-t border-zinc-100 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                >
                  <td className="px-3 py-2">
                    {ad.thumbnailUrl ? (
                      <Image
                        src={ad.thumbnailUrl}
                        alt={ad.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {ad.type === "video" ? "Vídeo" : "Imagem"}
                      </div>
                    )}
                  </td>
                  <td className="truncate px-3 py-2" title={ad.name}>
                    {ad.name}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {ad.type === "video" ? "Vídeo" : "Imagem"}
                  </td>
                  <td className="px-3 py-2 uppercase text-[11px]">{ad.status}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(ad.spend)}</td>
                  <td className="px-3 py-2 tabular-nums">{ad.purchases}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(ad.cpa)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(ad.ctr)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {ad.roas === null ? "-" : ad.roas.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs">{verdictLabel(ad.verdict)}</td>
                  <td className="px-3 py-2 text-xs">
                    {ad.type !== "video" || !ad.videoId ? (
                      "-"
                    ) : transcribedVideoIds.has(ad.videoId) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span>✅</span>
                        <span>Transcrito</span>
                      </span>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await ensureTranscriptionForVideo({
                            userId: user.id,
                            videoId: ad.videoId as string,
                          });
                        }}
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Transcrever
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

