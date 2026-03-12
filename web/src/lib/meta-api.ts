const META_GRAPH_BASE = "https://graph.facebook.com/v18.0";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMetaOAuthUrl(redirectUri: string) {
  const clientId = getRequiredEnv("META_APP_ID");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ["ads_read", "ads_management", "pages_read_engagement"].join(","),
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForShortLivedToken(code: string, redirectUri: string) {
  const clientId = getRequiredEnv("META_APP_ID");
  const clientSecret = getRequiredEnv("META_APP_SECRET");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to exchange code for short-lived token");
  }

  return (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const clientId = getRequiredEnv("META_APP_ID");
  const clientSecret = getRequiredEnv("META_APP_SECRET");

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to exchange for long-lived token");
  }

  return (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

export async function getMetaUser(accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name",
  });

  const res = await fetch(`${META_GRAPH_BASE}/me?${params.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Meta user profile");
  }

  return (await res.json()) as {
    id: string;
    name: string;
  };
}

export type MetaAdAccount = {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  timezone_name: string;
};

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,currency,account_status,timezone_name",
    limit: "50",
  });

  const res = await fetch(`${META_GRAPH_BASE}/me/adaccounts?${params.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch ad accounts from Meta");
  }

  const json = (await res.json()) as { data?: MetaAdAccount[] };
  const accounts = json.data ?? [];

  // Filter to active accounts only (account_status === 1)
  return accounts.filter((account) => account.account_status === 1);
}

export async function getVideoSource(params: {
  videoId: string;
  accessToken: string;
}): Promise<string> {
  const { videoId, accessToken } = params;

  const url = new URL(`${META_GRAPH_BASE}/${encodeURIComponent(videoId)}`);
  url.searchParams.set("fields", "source");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "GET" });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[getVideoSource] Failed for ${videoId}:`, res.status, errBody);
    return null;
  }

  const json = (await res.json()) as { source?: string };
  if (!json.source) {
    console.error(`[getVideoSource] No source field for ${videoId}`);
    return null;
  }

  return json.source;
}
export type MetaAdCreative = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  creative: {
    id: string;
    body?: string;
    title?: string;
    object_story_spec?: {
      link_data?: {
        link?: string;
      };
      video_data?: {
        call_to_action?: unknown;
      };
    };
    asset_feed_spec?: unknown;
    video_id?: string;
    image_url?: string;
    thumbnail_url?: string;
    call_to_action_type?: string;
  };
};

export type MetaAdInsightAction = {
  action_type: string;
  value: string;
};

export type MetaAdInsight = {
  ad_id: string;
  ad_name: string;
  spend: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAdInsightAction[];
  action_values?: MetaAdInsightAction[];
  cost_per_action_type?: MetaAdInsightAction[];
};

export type ClassifiedAdVerdict = "WINNER" | "LOSER" | "MEDIANO" | "SEM_DADOS";

export type ClassifiedAd = {
  id: string;
  name: string;
  type: "video" | "image";
  videoId: string | null;
  status: string;
  spend: number;
  purchases: number;
  cpa: number | null;
  ctr: number | null;
  roas: number | null;
  verdict: ClassifiedAdVerdict;
  thumbnailUrl: string | null;
};

export function getPurchases(actions?: MetaAdInsightAction[]): number {
  if (!actions) return 0;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value, 10);
  const pixel = actions.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase",
  );
  if (pixel) return parseInt(pixel.value, 10);
  const omni = actions.find((a) => a.action_type === "omni_purchase");
  if (omni) return parseInt(omni.value, 10);
  return 0;
}

function isBoostedPost(creative: MetaAdCreative["creative"]): boolean {
  const linkData = creative.object_story_spec?.link_data;
  const videoCallToAction = creative.object_story_spec?.video_data?.call_to_action;
  const assetFeed = creative.asset_feed_spec;

  // Excluir ads onde:
  // - creative.object_story_spec.link_data NÃO existe
  //   E creative.object_story_spec.video_data.call_to_action NÃO existe
  //   E creative.asset_feed_spec NÃO existe
  return !linkData && !videoCallToAction && !assetFeed;
}

function classifyAd(
  ad: ClassifiedAd,
  accountAverageCpa: number | null,
  totalPurchases: number,
): ClassifiedAdVerdict {
  if (!accountAverageCpa || totalPurchases === 0) {
    return "SEM_DADOS";
  }

  // WINNER:
  // compras >= 3 E CPA <= CPA_MEDIO_CONTA * 0.8
  // OU compras >= 5
  if (
    (ad.purchases >= 3 && ad.cpa !== null && ad.cpa <= accountAverageCpa * 0.8) ||
    ad.purchases >= 5
  ) {
    return "WINNER";
  }

  // LOSER:
  // spend >= CPA_MEDIO_CONTA * 2 E compras == 0
  // OU compras >= 1 E CPA >= CPA_MEDIO_CONTA * 2
  if (
    ad.spend >= accountAverageCpa * 2 && ad.purchases === 0 ||
    (ad.purchases >= 1 && ad.cpa !== null && ad.cpa >= accountAverageCpa * 2)
  ) {
    return "LOSER";
  }

  // MEDIANO: tudo que não é winner nem loser
  return "MEDIANO";
}

export async function getClassifiedAdsForAccount(params: {
  accountId: string;
  accessToken: string;
  period: string;
}): Promise<ClassifiedAd[]> {
  const { accountId, accessToken, period } = params;

  // Passo 1: Buscar insights primeiro (já filtra ads com spend)
  const insightsParams = new URLSearchParams({
    access_token: accessToken,
    fields:
      "ad_id,ad_name,spend,impressions,clicks,actions,cost_per_action_type",
    date_preset: period,
    level: "ad",
    limit: "200",
  });

  const insightsRes = await fetch(
    `${META_GRAPH_BASE}/${encodeURIComponent(accountId)}/insights?${insightsParams.toString()}`,
    { method: "GET" },
  );

  if (!insightsRes.ok) {
    const errorBody = await insightsRes.text();
    console.error("Meta insights API error:", insightsRes.status, errorBody);
    throw new Error(`Failed to fetch insights: ${insightsRes.status} ${errorBody.slice(0, 200)}`);
  }

  const insightsJson = (await insightsRes.json()) as { data?: MetaAdInsight[] };
  const insights = insightsJson.data ?? [];
  console.log(`[DEBUG] Insights returned: ${insights.length}`);

  if (insights.length === 0) return [];

  // Passo 2: Buscar detalhes dos ads em chunks de 50
  const adIds = insights.map((i) => i.ad_id);
  let adsById: Record<string, MetaAdCreative> = {};

  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50);
    const adsParams = new URLSearchParams({
      access_token: accessToken,
      ids: chunk.join(","),
      fields: "id,name,status,effective_status,creative{id,video_id,image_url,thumbnail_url}",
    });

    const adsRes = await fetch(`${META_GRAPH_BASE}/?${adsParams.toString()}`);
    if (adsRes.ok) {
      const batch = (await adsRes.json()) as Record<string, MetaAdCreative>;
      Object.assign(adsById, batch);
    } else {
      console.error("Meta ads batch error:", adsRes.status, await adsRes.text());
    }
  }
  console.log(`[DEBUG] Ad details fetched: ${Object.keys(adsById).length}`);

  // Merge
  const merged: ClassifiedAd[] = [];

  for (const insight of insights) {
    const spend = parseFloat(insight.spend ?? "0");
    if (!Number.isFinite(spend) || spend <= 0) continue;

    const ad = adsById[insight.ad_id];

    const purchases = getPurchases(insight.actions);
    const cpa = purchases > 0 ? spend / purchases : null;

    let videoId: string | null = null;
    let thumbnailUrl: string | null = null;
    let isVideo = false;
    let status = "UNKNOWN";
    let name = insight.ad_name ?? insight.ad_id;

    if (ad) {
      name = ad.name ?? name;
      status = ad.effective_status ?? ad.status ?? status;
      if (ad.creative) {
        videoId = ad.creative.video_id ?? null;
        thumbnailUrl = ad.creative.image_url ?? ad.creative.thumbnail_url ?? null;
        isVideo = !!videoId;
      }
    }

    merged.push({
      id: insight.ad_id,
      name,
      type: isVideo ? "video" : "image",
      videoId,
      status,
      spend,
      purchases,
      cpa,
      ctr: null,
      roas: null,
      verdict: "SEM_DADOS",
      thumbnailUrl,
    });
  }

  if (merged.length === 0) return [];

  const totalSpend = merged.reduce((sum, a) => sum + a.spend, 0);
  const totalPurchases = merged.reduce((sum, a) => sum + a.purchases, 0);
  const accountAverageCpa =
    totalPurchases > 0 && totalSpend > 0 ? totalSpend / totalPurchases : null;

  return merged.map((ad) => ({
    ...ad,
    verdict: classifyAd(ad, accountAverageCpa, totalPurchases),
  }));
}

