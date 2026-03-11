import { prisma } from "@/lib/prisma";
import { getClassifiedAdsForAccount, type ClassifiedAd } from "@/lib/meta-api";

type AdForPrompt = ClassifiedAd & {
  transcription?: {
    full: string;
    hook: string | null;
    meio: string | null;
    cta: string | null;
  } | null;
};

export async function runComparativeAnalysis(params: {
  userId: string;
  period: string;
}) {
  const { userId, period } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.metaToken || !user.selectedAccount) {
    throw new Error("User is missing Meta token or selected account");
  }

  const ads = await getClassifiedAdsForAccount({
    accountId: user.selectedAccount,
    accessToken: user.metaToken,
    period,
  });

  if (!ads.length) {
    throw new Error("No ads with spend found for the selected period");
  }

  const videoIds = Array.from(
    new Set(
      ads
        .filter((ad) => ad.type === "video" && ad.videoId)
        .map((ad) => ad.videoId as string),
    ),
  );

  const transcriptions = videoIds.length
    ? await prisma.transcription.findMany({
        where: { videoId: { in: videoIds } },
      })
    : [];

  const transcriptionByVideoId = new Map(
    transcriptions.map((t) => [t.videoId, t]),
  );

  const adsWithContext: AdForPrompt[] = ads.map((ad) => ({
    ...ad,
    transcription: ad.videoId
      ? (() => {
          const t = transcriptionByVideoId.get(ad.videoId!);
          if (!t) return null;
          return {
            full: t.full,
            hook: t.hook,
            meio: t.meio,
            cta: t.cta,
          };
        })()
      : null,
  }));

  const winners = adsWithContext.filter((ad) => ad.verdict === "WINNER");
  const losers = adsWithContext.filter((ad) => ad.verdict === "LOSER");
  const medianos = adsWithContext.filter((ad) => ad.verdict === "MEDIANO");

  if (!winners.length || !losers.length) {
    throw new Error(
      "É preciso ter pelo menos 1 winner e 1 loser para rodar a análise comparativa.",
    );
  }

  const inputForModel = {
    account: {
      id: user.selectedAccount,
      period,
    },
    winners,
    losers,
    medianos,
  };

  const systemPrompt = `
Você é um analista sênior de copy para Meta Ads no mercado brasileiro.

Você vai receber criativos agrupados por performance:
- WINNERS: CPA baixo, conversões consistentes
- LOSERS: CPA alto ou zero conversões
- MEDIANOS: resultados intermediários

Sua análise deve responder UMA pergunta: "O que os winners têm que os losers não têm?"

Para vídeos com transcrição: analise O QUE É FALADO (a transcrição). O título/texto do anúncio são secundários — o vídeo é o criativo real.

REGRAS:
1. Cite trechos EXATOS como evidência
2. Pense como comprador: o que faz parar, assistir e clicar?
3. Nas copies geradas, replique ELEMENTOS ESPECÍFICOS dos winners
4. Gere copies para o MESMO produto/nicho dos anúncios
5. Em português brasileiro natural, sem linguagem de IA

Retorne JSON válido no formato abaixo, sem comentários e sem texto fora do JSON:
{
  "winners_summary": {
    "dna": "texto curto explicando o DNA dos winners",
    "patterns": ["padrão 1", "padrão 2"],
    "quotes": ["trecho exato 1", "trecho exato 2"]
  },
  "losers_summary": {
    "dna": "texto curto explicando o DNA dos losers",
    "patterns": ["padrão 1", "padrão 2"],
    "quotes": ["trecho exato 1", "trecho exato 2"]
  },
  "crucial_difference": "a diferença #1 entre winners e losers em 1-2 frases",
  "creatives": [
    {
      "ad_id": "id do anúncio",
      "name": "nome do anúncio",
      "verdict": "WINNER | LOSER | MEDIANO",
      "why": "por que funciona ou falha",
      "key_quote": "trecho-chave citado",
      "replicable": true
    }
  ],
  "generated_copies": [
    {
      "angle": "ex: Identidade + Mecanismo Counter-Intuitivo",
      "hook": "primeiros 3 segundos",
      "body": "desenvolvimento",
      "cta": "chamada para ação",
      "based_on_ad_id": "id do winner que inspirou"
    }
  ]
}
`.trim();

  // LLM provider selection: Gemini (default/free) or Anthropic (premium)
  const provider = process.env.LLM_PROVIDER || "gemini";
  let raw: string;

  if (provider === "anthropic") {
    const { anthropic } = await import("@/lib/anthropic");
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify(inputForModel),
            },
          ],
        },
      ],
    });

    const content = response.content.find(
      (c) => c.type === "text",
    ) as { type: "text"; text: string } | undefined;

    if (!content) {
      throw new Error("Claude response did not include text content");
    }
    raw = content.text.trim();
  } else {
    const { geminiModel } = await import("@/lib/gemini");
    const result = await geminiModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\n---\n\nDados dos criativos:\n${JSON.stringify(inputForModel)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    if (!text) {
      throw new Error("Gemini response did not include text content");
    }
    raw = text.trim();
  }

  let parsed: unknown;
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```json?/i, "").replace(/```$/, "").trim()
    : raw;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Failed to parse Claude JSON response: ${(error as Error).message}`,
    );
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId,
      accountId: user.selectedAccount,
      period,
      adsCount: ads.length,
      winnersCount: winners.length,
      losersCount: losers.length,
      resultJson: JSON.stringify(parsed),
    },
  });

  return analysis;
}

