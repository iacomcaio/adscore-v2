# AdScoreAI — Product Requirements Document (PRD)
## v2.0 — Rewrite Spec for Cursor/Vibe Coding

> Este documento é a spec completa do produto. Não improvisar — seguir exatamente.

---

## 1. O QUE É

Ferramenta SaaS que conecta na conta de Meta Ads do cliente, analisa criativos (vídeos e imagens), compara os que vendem vs os que não vendem, e gera novas copies baseadas nos padrões vencedores.

**Valor central:** "Não é sobre qual criativo converteu. É sobre POR QUE converteu — e como replicar."

**Persona:** Gestor de tráfego BR que roda Meta Ads para infoprodutores, e-commerce ou serviços. Precisa entender rápido quais criativos escalar e por quê.

---

## 2. STACK TÉCNICA

```
Frontend:    Next.js 14+ (App Router)
Auth:        NextAuth.js (login com email/Google)
Meta OAuth:  Facebook Login (ads_read, ads_management scopes)
Banco:       Supabase (PostgreSQL via Prisma ORM)
LLM:         Anthropic Claude API (Sonnet 4) — NÃO usar modelos gratuitos
Transcrição: OpenAI Whisper API (ou self-hosted)
Deploy:      Vercel (frontend) + Supabase (banco)
Styling:     Tailwind CSS + shadcn/ui
```

---

## 3. FLUXO DO USUÁRIO (tela por tela)

### Tela 1: Login
- Login com Google ou email/senha (NextAuth)
- Após login, redireciona para Dashboard

### Tela 2: Dashboard (estado vazio)
- Se não tem Meta conectado: botão grande "Conectar Meta Ads"
- Se tem Meta conectado mas sem conta selecionada: dropdown de contas
- Se tem tudo: vai direto pra Tela 3

### Tela 3: Conectar Meta Ads
- Botão "Conectar com Facebook"
- OAuth flow padrão do Facebook Login
- Scopes necessários: `ads_read`, `ads_management`, `pages_read_engagement`
- Após autorizar: salvar access_token + token de longa duração (60 dias)
- Listar contas de anúncio do usuário
- Usuário seleciona qual conta analisar
- Salvar seleção no banco

### Tela 4: Dashboard Principal (com conta conectada)
- Header: nome da conta, período selecionável (7d, 14d, 30d, 60d, 90d, lifetime)
- KPIs da conta no período:
  - Spend total | Compras | CPA médio | ROAS | CTR médio
- Lista de criativos (Tela 5)
- Botão "Rodar Análise Comparativa" (Tela 6)

### Tela 5: Lista de Criativos
- Tabela com TODOS os ads que tiveram spend > R$0 no período selecionado
- **FILTRO CRÍTICO:** Excluir ads que são posts impulsionados (sem link de destino)
- Colunas:
  - Thumbnail (imagem ou frame do vídeo)
  - Nome do ad
  - Tipo (vídeo/imagem)
  - Status (ativo/pausado)
  - Spend
  - Compras
  - CPA
  - CTR
  - ROAS
  - Veredicto (🏆 Winner / ❌ Loser / ➡️ Mediano)
  - Transcrição (✅ / ❌ — botão pra transcrever se não tem)
- Ordenação padrão: por spend (maior primeiro)
- Filtros: Winners only / Losers only / Todos / Com transcrição / Sem transcrição

#### Regras de classificação (veredicto):
```
WINNER:  compras >= 3 E CPA <= CPA_MEDIO_CONTA * 0.8
         OU compras >= 5 (volume alto independente de CPA)
LOSER:   spend >= CPA_MEDIO_CONTA * 2 E compras == 0
         OU compras >= 1 E CPA >= CPA_MEDIO_CONTA * 2
MEDIANO: tudo que não é winner nem loser
```
- CPA_MEDIO_CONTA = spend total / compras totais no período (só ads com spend > 0)
- Se conta tem 0 compras no período: TODOS são classificados como "sem dados suficientes"

### Tela 6: Análise Comparativa (O PRODUTO)
- Ativada por botão "Rodar Análise" no dashboard
- Pré-requisito: pelo menos 1 winner E 1 loser com transcrição
- Se não tem transcrição: avisar "Transcreva os vídeos primeiro para uma análise completa"

#### O que a análise faz (backend):
1. Agrupa criativos em WINNERS, LOSERS, MEDIANOS
2. Para cada criativo, monta contexto:
   - Nome, tipo, métricas (spend, CPA, compras, CTR, ROAS)
   - Texto do anúncio (headline + body)
   - Transcrição do vídeo (se disponível) — ISSO É O MAIS IMPORTANTE
3. Envia tudo pro Claude Sonnet com o prompt comparativo (ver seção 5)
4. Recebe análise estruturada em JSON
5. Salva no banco e exibe

#### O que a tela mostra:

**Card 1: DNA dos Winners**
- O que os winners têm em comum (com citações de trechos)
- Gatilho psicológico que faz o comprador agir

**Card 2: DNA dos Losers**
- O que os losers têm em comum (com citações)
- Por que NÃO convertem

**Card 3: Diferença Crucial**
- A diferença #1 entre winners e losers em 1-2 frases

**Card 4: Por Criativo**
- Lista expansível: cada criativo com "por que funciona" ou "por que falha"
- Citação do trecho-chave
- Badge: replicável ✅ ou não ❌

**Card 5: Copies Geradas (3 novas)**
- Cada copy com:
  - Ângulo (ex: "Identidade + Mecanismo Counter-Intuitivo")
  - Hook (primeiros 3 segundos)
  - Body (desenvolvimento)
  - CTA
  - Baseado em qual winner
- Botão "Copiar" em cada uma
- Botão "Copiar todas"

### Tela 7: Histórico de Análises
- Lista de análises anteriores com data/hora
- Clicar abre a análise completa (mesma visualização da Tela 6)
- Útil pra comparar evolução ao longo do tempo

---

## 4. API DO META ADS — Queries Exatas

### 4.1 Listar contas de anúncio
```
GET /me/adaccounts?fields=id,name,currency,account_status,timezone_name&limit=50
→ Filtrar: account_status === 1 (ativa)
```

### 4.2 KPIs da conta
```
GET /{account_id}/insights
  ?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,actions,action_values,cost_per_action_type
  &date_preset={periodo}
  &action_attribution_windows=["7d_click","1d_view"]
```

### 4.3 Listar ads com métricas
```
# Passo 1: Buscar ads
GET /{account_id}/ads
  ?fields=id,name,status,effective_status,creative{id,body,title,object_story_spec,asset_feed_spec,video_id,image_url,thumbnail_url,call_to_action_type}
  &filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]
  &limit=200

# Passo 2: Buscar métricas de todos os ads
GET /{account_id}/insights
  ?fields=ad_id,ad_name,spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type
  &date_preset={periodo}
  &level=ad
  &limit=500
  &action_attribution_windows=["7d_click","1d_view"]

# Passo 3: Cruzar ads com métricas por ad_id
# IMPORTANTE: agrupar por ad_id, NÃO por ad_name (nomes podem duplicar)
```

### 4.4 Filtrar posts impulsionados (CRÍTICO)
```
Excluir ads onde:
- creative.object_story_spec.link_data NÃO existe
  E creative.object_story_spec.video_data.call_to_action NÃO existe
  E creative.asset_feed_spec NÃO existe

Esses são posts orgânicos impulsionados — não são criativos de performance.
Se o ad não tem link de destino (LP), não é ad de conversão.
```

### 4.5 Obter URL do vídeo para transcrição
```
# Primeiro: pegar video_id do creative
# Se creative.video_id existe → usar direto
# Se creative.object_story_spec.video_data.video_id existe → usar esse
# CUIDADO: o ID do creative NÃO é o video_id

GET /{video_id}?fields=source
→ retorna URL temporária do vídeo (expira em horas)
```

### 4.6 Extrair compras das actions
```javascript
// Ordem de prioridade:
// 1. action_type === "purchase" (padrão)
// 2. action_type === "offsite_conversion.fb_pixel_purchase" (pixel)
// 3. action_type === "omni_purchase" (cross-channel)

function getPurchases(actions) {
  if (!actions) return 0;
  const purchase = actions.find(a => a.action_type === "purchase");
  if (purchase) return parseInt(purchase.value);
  const pixel = actions.find(a => a.action_type === "offsite_conversion.fb_pixel_purchase");
  if (pixel) return parseInt(pixel.value);
  const omni = actions.find(a => a.action_type === "omni_purchase");
  if (omni) return parseInt(omni.value);
  return 0;
}
```

---

## 5. PROMPT DA ANÁLISE COMPARATIVA (Claude Sonnet)

```
SYSTEM:
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

Retorne JSON válido no formato especificado.
```

**IMPORTANTE:** Usar Claude Sonnet (anthropic API). NÃO usar modelos gratuitos (Llama, Qwen, Gemma). A qualidade da análise É o produto — modelo fraco = produto fraco.

---

## 6. TRANSCRIÇÃO DE VÍDEOS

### Fluxo:
1. Usuário clica "Transcrever" no criativo de vídeo
2. Backend pega URL do vídeo via Meta API (GET /{video_id}?fields=source)
3. Baixa o vídeo temporariamente
4. Envia para Whisper API
5. Recebe transcrição em texto
6. Salva no banco (cache — não transcrever de novo)
7. Divide em: hook (primeiros 30s), meio, CTA (últimos 15s)

### Opções de Whisper:
- **OpenAI Whisper API** ($0.006/min) — mais fácil, mais preciso
- **Self-hosted** (localhost:8000) — grátis mas precisa servidor
- **Groq Whisper** ($0.02/min) — rápido, barato

### Cache:
- Transcrição é cacheada por video_id
- Se o vídeo já foi transcrito, não transcreve de novo
- Cache nunca expira (vídeo não muda)

---

## 7. MODELO DE DADOS (Prisma)

```prisma
model User {
  id            String   @id @default(cuid())
  name          String?
  email         String?  @unique
  image         String?
  metaToken     String?  @db.Text  // Facebook access token (long-lived)
  metaTokenExp  DateTime?
  metaUserId    String?
  selectedAccount String? // act_XXXXX
  analyses      Analysis[]
  createdAt     DateTime @default(now())
}

model Analysis {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  accountId   String   // act_XXXXX
  period      String   // last_7d, last_30d, etc
  adsCount    Int
  winnersCount Int
  losersCount Int
  resultJson  Json     // Resultado completo da análise LLM
  createdAt   DateTime @default(now())
}

model Transcription {
  id          String   @id @default(cuid())
  videoId     String   @unique  // Meta video ID
  full        String   @db.Text
  hook        String?  @db.Text  // Primeiros ~30s
  meio        String?  @db.Text
  cta         String?  @db.Text  // Últimos ~15s
  createdAt   DateTime @default(now())
}
```

Simplificado de propósito. Sem subscription, sem cache de criativos, sem goals. MVP.

---

## 8. O QUE NÃO FAZER (anti-patterns)

- ❌ NÃO adicionar Stripe/subscription no MVP — validar primeiro, cobrar depois
- ❌ NÃO cachear criativos no banco — Meta API é a fonte de verdade, sempre
- ❌ NÃO usar múltiplos providers de LLM com fallback — 1 provider (Anthropic), 1 modelo (Sonnet)
- ❌ NÃO classificar criativos individualmente — SEMPRE comparativo (winners vs losers)
- ❌ NÃO mostrar ads sem spend — se não gastou, não tem dado, não serve
- ❌ NÃO incluir posts impulsionados — filtrar por link de destino
- ❌ NÃO fazer transcrição automática de todos os vídeos — sob demanda (clique do usuário)
- ❌ NÃO usar modelos gratuitos (Llama, Qwen) — a análise É o produto

---

## 9. O QUE REUSAR DO CÓDIGO ATUAL

O repositório `iacomcaio/ad-score-ai` tem partes funcionais:

✅ **Reusar:**
- `src/lib/meta-api.ts` — queries à Meta API (ajustar filtros)
- `src/lib/meta-connection.ts` — OAuth flow do Facebook
- `src/app/api/meta/callback/route.ts` — callback OAuth
- `src/app/api/transcribe/route.ts` — integração Whisper
- Schema do Prisma (simplificar)
- NextAuth config

❌ **Descartar:**
- `src/lib/groq-analyzer.ts` — reescrever com Anthropic + prompt novo
- Todo o frontend (UI) — refazer com shadcn/ui limpo
- Stripe/subscription — não é MVP
- Cache de criativos em banco — complexidade sem valor
- AccountGoals/AccountInsights — over-engineering

---

## 10. DEFINIÇÃO DE PRONTO (MVP)

O MVP está pronto quando:
1. ✅ Usuário loga e conecta Meta Ads via OAuth
2. ✅ Seleciona conta de anúncio
3. ✅ Vê lista de criativos com métricas reais (sem posts impulsionados)
4. ✅ Pode transcrever vídeos individualmente
5. ✅ Roda análise comparativa (Claude Sonnet)
6. ✅ Vê resultado: DNA winners, DNA losers, diferença, copies geradas
7. ✅ Copia copies geradas com 1 clique

**Nada mais. Nada menos.**

---

## 11. SEQUÊNCIA DE IMPLEMENTAÇÃO (pro Cursor)

Ordem recomendada para vibe coding:

1. **Setup projeto** — Next.js + Tailwind + shadcn/ui + Prisma + Supabase
2. **Auth** — NextAuth com Google login
3. **Meta OAuth** — Conectar Facebook, salvar token, listar contas
4. **Lista de ads** — Puxar ads com métricas, filtrar lixo, classificar winner/loser
5. **Transcrição** — Botão por vídeo, chamar Whisper, salvar no banco
6. **Análise comparativa** — Montar contexto, chamar Claude, parsear resposta
7. **UI da análise** — Cards com resultado, copies com botão copiar
8. **Histórico** — Lista de análises anteriores
9. **Polish** — Loading states, error handling, responsivo

Cada passo é um prompt separado pro Cursor. Não tentar fazer tudo de uma vez.

---

*Spec escrita por Athena (COO) — baseada em 30+ análises reais feitas manualmente para o cliente Ronan Diego (RDT Treinamentos).*
