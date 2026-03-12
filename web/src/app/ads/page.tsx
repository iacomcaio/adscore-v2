import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClassifiedAdsForAccount, type ClassifiedAd } from "@/lib/meta-api";
import { ensureTranscriptionForVideo } from "@/lib/transcription";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

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
  return [...ads].sort((a, b) => {
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
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function VerdictBadge({ verdict }: { verdict: ClassifiedAd["verdict"] }) {
  switch (verdict) {
    case "WINNER":
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/20 dark:text-emerald-400">🏆 Winner</Badge>;
    case "LOSER":
      return <Badge variant="destructive" className="bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-500/20 dark:text-red-400">Loser</Badge>;
    case "MEDIANO":
      return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20 dark:text-amber-400">Mediano</Badge>;
    case "SEM_DADOS":
    default:
      return <Badge variant="outline" className="text-zinc-500">Sem dados</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`} />
      {isActive ? "Ativo" : "Pausado"}
    </span>
  );
}

function SortableHeader({ children, field, currentSort, currentDir, params }: {
  children: React.ReactNode;
  field: string;
  currentSort?: string;
  currentDir?: string;
  params: Record<string, string | undefined>;
}) {
  const isActive = (currentSort ?? "spend") === field;
  const nextDir = isActive && currentDir !== "asc" ? "asc" : "desc";
  return (
    <TableHead className="whitespace-nowrap">
      <Link
        href={{ pathname: "/ads", query: { ...params, sort: field, dir: nextDir } }}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${isActive ? "text-zinc-900 dark:text-zinc-100 font-semibold" : ""}`}
      >
        {children}
        {isActive && <span className="text-[10px]">{currentDir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </TableHead>
  );
}

const PERIODS = [
  { value: "last_7d", label: "7d" },
  { value: "last_14d", label: "14d" },
  { value: "last_30d", label: "30d" },
  { value: "last_90d", label: "90d" },
  { value: "maximum", label: "Tudo" },
];

export default async function AdsPage({ searchParams }: AdsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Acesso necessário</CardTitle>
            <CardDescription>Faça login para ver seus anúncios.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild><Link href="/login">Fazer login</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (!user?.metaToken || !user.selectedAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Conecte o Meta Ads</CardTitle>
            <CardDescription>Vincule sua conta de anúncios para começar a análise.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild><Link href="/meta/connect">Conectar Meta Ads</Link></Button>
          </CardContent>
        </Card>
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
    new Set(ads.filter((ad) => ad.type === "video" && ad.videoId).map((ad) => ad.videoId as string)),
  );

  const existingTranscriptions = videoIds.length
    ? await prisma.transcription.findMany({ where: { videoId: { in: videoIds } }, select: { videoId: true } })
    : [];
  const transcribedVideoIds = new Set(existingTranscriptions.map((t) => t.videoId));

  const sortedAds = sortAds(ads, sort, dir);

  // Stats
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalPurchases = ads.reduce((s, a) => s + a.purchases, 0);
  const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : null;
  const winners = ads.filter((a) => a.verdict === "WINNER").length;
  const losers = ads.filter((a) => a.verdict === "LOSER").length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              A
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">AdScore AI</h1>
              <p className="text-xs text-zinc-500">Análise de criativos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/analysis" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
              Histórico
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-xs text-zinc-400">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Spend total</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalSpend)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Compras</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{totalPurchases}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">CPA médio</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(avgCpa)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Winners / Losers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                <span className="text-emerald-600">{winners}</span>
                <span className="text-zinc-300 mx-1">/</span>
                <span className="text-red-500">{losers}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Período:</span>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              {PERIODS.map((p) => (
                <Link
                  key={p.value}
                  href={{ pathname: "/ads", query: { ...params, period: p.value } }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    period === p.value
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {p.label}
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
            <Button type="submit" size="sm">
              ⚡ Rodar análise comparativa
            </Button>
          </form>
        </div>

        {/* Ads table */}
        {sortedAds.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-zinc-500">Nenhum anúncio com spend &gt; 0 para este período.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">Thumb</TableHead>
                  <SortableHeader field="name" currentSort={sort} currentDir={dir} params={params ?? {}}>
                    Nome
                  </SortableHeader>
                  <TableHead className="w-20">Status</TableHead>
                  <SortableHeader field="spend" currentSort={sort} currentDir={dir} params={params ?? {}}>
                    Spend
                  </SortableHeader>
                  <SortableHeader field="purchases" currentSort={sort} currentDir={dir} params={params ?? {}}>
                    Compras
                  </SortableHeader>
                  <SortableHeader field="cpa" currentSort={sort} currentDir={dir} params={params ?? {}}>
                    CPA
                  </SortableHeader>
                  <TableHead className="w-28">Veredicto</TableHead>
                  <TableHead className="w-28">Transcrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAds.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      {ad.thumbnailUrl ? (
                        <Image
                          src={ad.thumbnailUrl}
                          alt={ad.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800">
                          {ad.type === "video" ? "🎬" : "🖼"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100" title={ad.name}>
                        {ad.name}
                      </p>
                      <p className="text-[11px] text-zinc-400">{ad.id}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ad.status} />
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">{formatCurrency(ad.spend)}</TableCell>
                    <TableCell className="tabular-nums">{ad.purchases}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {ad.cpa !== null ? (
                        <span className={ad.cpa <= (avgCpa ?? Infinity) ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                          {formatCurrency(ad.cpa)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <VerdictBadge verdict={ad.verdict} />
                    </TableCell>
                    <TableCell>
                      {ad.type !== "video" || !ad.videoId ? (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      ) : transcribedVideoIds.has(ad.videoId) ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                          ✓ Transcrito
                        </Badge>
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
                          <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                            Transcrever
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-400">
          {sortedAds.length} anúncios · {period === "maximum" ? "Todos os dados" : `Últimos ${period.replace("last_", "").replace("d", " dias")}`}
        </p>
      </div>
    </main>
  );
}
