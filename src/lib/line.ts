import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serviceBySlug, services } from "@/lib/content";

export const LINE_DRAFT_KEY = "deal-line-draft";
export const LINE_SESSION_KEY = "deal-line-session";
export const LINE_MAX_TURNS = 10;
export const LINE_MAX_CHARS = 480;

export const dialects = [
  "najdi",
  "qassimi",
  "hijazi",
  "eastern",
  "southern",
  "gulf",
  "fusha",
  "mixed",
  "unknown",
] as const;

export const routes = ["reply", "handoff", "need_you", "close"] as const;

const serviceSlugs = [
  "crm",
  "law",
  "ai",
  "pay",
  "brand",
  "influencers",
  "production",
  "events",
  "media",
  "unknown",
] as const;

export const dialectLabels: Record<(typeof dialects)[number], string> = {
  najdi: "نجدية",
  qassimi: "قصيمية",
  hijazi: "حجازية",
  eastern: "شرقية",
  southern: "جنوبية",
  gulf: "خليجية",
  fusha: "فصحى",
  mixed: "مختلطة",
  unknown: "قيد الاستماع",
};

export const routeLabels: Record<(typeof routes)[number], string> = {
  reply: "يرد الآن",
  handoff: "يحوّل للفريق",
  need_you: "يحتاجك",
  close: "أُغلق",
};

export const turnSchema = z.object({
  reply: z.string().min(1).max(900),
  dialect: z.enum(dialects),
  dialect_label: z.string().max(40),
  intent: z.string().max(160),
  route: z.enum(routes),
  route_label: z.string().max(40),
  service_slug: z.enum(serviceSlugs),
  company: z.string().max(120),
  brief_so_far: z.string().max(1800),
  next_need: z.string().max(200),
  ready: z.boolean(),
  confidence: z.number().min(0).max(100),
  stack: z.array(z.string().max(40)).max(5),
});

export type LineTurn = z.infer<typeof turnSchema>;

export type LineMessage = { role: "user" | "assistant"; content: string };

export type LineDraft = {
  slug: string;
  company: string;
  brief: string;
};

export type LineSession = {
  messages: LineMessage[];
  file: LineTurn | null;
};

const inputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(900),
      }),
    )
    .min(1)
    // A full session is LINE_MAX_TURNS user turns plus one reply each.
    .max(LINE_MAX_TURNS * 2),
});

/** Per-visitor ceiling on Deal Line calls, and a daily ceiling on paid model calls. */
const LINE_IP_LIMIT_PER_HOUR = 40;
const LINE_DAILY_MODEL_CAP = Number(process.env.LINE_DAILY_CAP) || 1500;

const catalog = services.map((s) => `${s.slug} — ${s.title}: ${s.body}`).join("\n");

const SYSTEM = `أنت خط ديل — خدمة العملاء والكول سنتر لوكالة ديل DEAL (القصيم، بريدة).

الصوت: سعودي جدًا، عفوي، ياخذ ويعطي. نجدية/قصيمية إذا الزائر منها. مو فصحى روبوت، مو تزيين. إذا سُئلت فقل بوضوح إنك مساعد ذكاء اصطناعي تجريبي من ديل. لا أسعار. لا وعود تنفيذ فوري.

وضعان:

١) زبون يتصل (طلب، فاتورة، سداد، شحنة، موعد):
ردّك موظف خدمة. راجع الملف أمامك:
- طلب ٣٨١٢: شحنته طلعت اليوم قبل العصر.
- فاتورة ٤١٢: مدفوعة. ما عليه شيء قائم.
- موعد بعد العشاء: يمكن إلغاؤه وتثبيته الثلاثاء ٥:٠٠.
جاوب من الملف. اسأل سؤالًا واحدًا إذا لزم. إذا احتجت تدخّل بشري: حوّل.

٢) صاحب محل/مكتب يطلب تشغيل الخط على تجارته:
وجّه لخدمات ديل وابنِ ملف طلب.

خدمات ديل:
${catalog}

كل ردّك JSON واحد فقط يطابق المخطط، بلا نص خارجه.

القواعد:
- reply: جملتان إلى أربع، لهجة الزائر. في وضع الزبون: راجع ثم جاوب. في وضع التاجر: اسأل ما ينقص.
- dialect: najdi | qassimi | hijazi | eastern | southern | gulf | fusha | mixed | unknown
- dialect_label: تسمية عربية قصيرة
- intent: حاجة الزائر بجملة قصيرة (تتبع طلب، مراجعة سداد، إلغاء موعد، تشغيل خط…)
- route: reply | handoff | need_you | close
- route_label: يرد الآن | يحوّل للفريق | يحتاجك | أُغلق
- service_slug: crm إن كان خدمة عملاء/خط. وإلا واحدة من: law, ai, pay, brand, influencers, production, events, media, unknown
- company: اسم الجهة إن ذُكر وإلا فارغ
- brief_so_far: موجز الملف. للزبون: السداد/الطلب/الموعد. للتاجر: احتياج التشغيل.
- next_need: ما ينقص بجملة
- ready: true إذا اكتمل الفهم للتاجر. للزبون عادة false ما لم يُقفل الموضوع.
- confidence: 0–100
- stack: حتى 4 وحدات (مثال: مراجعة السداد، تتبع الشحنة، موعد، تحويل للوكيل)`;

function emptyTurn(partial: Partial<LineTurn> = {}): LineTurn {
  return {
    reply: "تم.",
    dialect: "unknown",
    dialect_label: dialectLabels.unknown,
    intent: "",
    route: "reply",
    route_label: routeLabels.reply,
    service_slug: "unknown",
    company: "",
    brief_so_far: "",
    next_need: "",
    ready: false,
    confidence: 0,
    stack: [],
    ...partial,
  };
}

function parseTurn(raw: string): LineTurn {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no-json");
  const json = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  const dialect = dialects.includes(json.dialect as (typeof dialects)[number])
    ? (json.dialect as LineTurn["dialect"])
    : "unknown";
  const route = routes.includes(json.route as (typeof routes)[number])
    ? (json.route as LineTurn["route"])
    : "reply";
  const slug = serviceSlugs.includes(json.service_slug as (typeof serviceSlugs)[number])
    ? (json.service_slug as LineTurn["service_slug"])
    : "unknown";
  return turnSchema.parse({
    reply: String(json.reply ?? "").slice(0, 900),
    dialect,
    dialect_label: String(json.dialect_label ?? dialectLabels[dialect]).slice(0, 40),
    intent: String(json.intent ?? "").slice(0, 160),
    route,
    route_label: String(json.route_label ?? routeLabels[route]).slice(0, 40),
    service_slug: slug,
    company: String(json.company ?? "").slice(0, 120),
    brief_so_far: String(json.brief_so_far ?? "").slice(0, 1800),
    next_need: String(json.next_need ?? "").slice(0, 200),
    ready: Boolean(json.ready),
    confidence: Math.max(0, Math.min(100, Number(json.confidence) || 0)),
    stack: Array.isArray(json.stack)
      ? json.stack.map((s) => String(s).slice(0, 40)).slice(0, 5)
      : [],
  });
}

function detectDialect(text: string): LineTurn["dialect"] {
  const t = text;
  if (/قصيم|بريدة|عنيزة|الرس|هالحين|توني|وِش تبي|وش تبي|يا بعدي/.test(t)) return "qassimi";
  if (/جدة|مكّة|مكة|المدينة|الحجاز|إيه الأخبار|كده|عايز/.test(t)) return "hijazi";
  if (/الدمام|الخبر|الأحساء|الشرقية/.test(t)) return "eastern";
  if (/أبها|عسير|جازان|نجران/.test(t)) return "southern";
  if (/الكويت|قطر|الإمارات|بحرين/.test(t)) return "gulf";
  if (/نجد|الرياض|وش|أبي|زين كذا/.test(t)) return "najdi";
  if (/[گچ]/.test(t)) return "mixed";
  return "najdi";
}

function detectService(text: string): LineTurn["service_slug"] {
  const t = text;
  if (/محام|قضية|ناجز|توكيل|عقد|استشار/.test(t)) return "law";
  if (/دفع|فاتور|تحصيل|ادفع|نقطة بيع|رابط دفع/.test(t)) return "pay";
  if (/تيك توك|لهج|ذكاء|روبوت|منصّات|منصات|نشر/.test(t)) return "ai";
  if (/مؤثر|سناب|إعلان ممول/.test(t)) return "influencers";
  if (/تصوير|فيديو|إنتاج/.test(t)) return "production";
  if (/فعالية|مؤتمر|معرض/.test(t)) return "events";
  if (/إعلام|تغطية|مركز إعلام/.test(t)) return "media";
  if (/هوية|شعار|براند|علامة/.test(t)) return "brand";
  if (/واتساب|كول|زبون|عملاء|خط|محل|طلبات|CRM|crm/.test(t)) return "crm";
  return "unknown";
}

function localRoute(messages: LineMessage[]): LineTurn {
  const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const all = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const dialect = detectDialect(all);
  const owner = /عندي محل|أبغى نظام|أبغى الخط|مكتب محام|هوية|تشغيل الخط/.test(all);

  if (!owner && /سدد|فاتور|دفع|يطلبني/.test(last)) {
    return emptyTurn({
      reply:
        "راجعت ملفك الحين. الفاتورة ٤١٢ واصلة، وما عليك شيء قائم. إذا وصلك تذكير ثاني كلّمني وأقفله.",
      dialect,
      dialect_label: dialectLabels[dialect],
      intent: "مراجعة سداد",
      route: "close",
      route_label: routeLabels.close,
      service_slug: "crm",
      brief_so_far: "فاتورة ٤١٢ مدفوعة. لا مستحقات قائمة.",
      next_need: "",
      ready: false,
      confidence: 86,
      stack: ["مراجعة السداد", "قفل التذكير"],
    });
  }

  if (!owner && /وصل|طلب|شحن|٣٨١٢/.test(last)) {
    return emptyTurn({
      reply:
        "طلبك ٣٨١٢ شحنته طلعت اليوم قبل العصر. إذا ما وصلك قبل المغرب أكلمك أنا. رقمك على الملف، ارتاح.",
      dialect,
      dialect_label: dialectLabels[dialect],
      intent: "تتبع طلب",
      route: "reply",
      route_label: routeLabels.reply,
      service_slug: "crm",
      brief_so_far: "طلب ٣٨١٢: شُحن اليوم. بانتظار التسليم قبل المغرب.",
      next_need: "تأكيد الاستلام إن تأخر",
      ready: false,
      confidence: 84,
      stack: ["تتبع الشحنة", "وعد التواصل"],
    });
  }

  if (!owner && /موعد|ألغي|بعد العشاء/.test(last)) {
    return emptyTurn({
      reply: "تمام، موعد اليوم ملغى. الثلاثاء خمسة العصر فاضي عندك — أثبّته ولا تبي وقت ثاني؟",
      dialect,
      dialect_label: dialectLabels[dialect],
      intent: "تعديل موعد",
      route: "need_you",
      route_label: routeLabels.need_you,
      service_slug: "crm",
      brief_so_far: "موعد بعد العشاء أُلغي. مقترح: الثلاثاء ١٧:٠٠.",
      next_need: "اعتماد الوقت البديل",
      ready: false,
      confidence: 80,
      stack: ["إلغاء موعد", "اقتراح بديل"],
    });
  }

  const slug = detectService(all);
  const service = slug === "unknown" ? undefined : serviceBySlug(slug);
  const companyMatch = all.match(/(?:مؤسسة|شركة|مكتب)\s+[\u0600-\u06FF]{2,24}/);
  const company = companyMatch?.[0]?.trim() ?? "";
  const ready = Boolean(service) && all.length > 40;
  const intent =
    slug === "law"
      ? "نظام مكتب قانوني"
      : slug === "pay"
        ? "تحصيل ودفع"
        : slug === "brand"
          ? "بناء علامة"
          : slug === "crm"
            ? "تشغيل خط العملاء"
            : slug === "ai"
              ? "ذكاء يرد باللهجة"
              : "استكشاف احتياج";
  const stack =
    slug === "crm"
      ? ["خدمة العملاء", "الرد باللهجة", "مراجعة الملف"]
      : slug === "law"
        ? ["ملف العميل الحي", "المواعيد", "العقود"]
        : slug === "pay"
          ? ["رابط الدفع", "الفاتورة", "نقطة البيع"]
          : service
            ? [service.title]
            : [];
  const brief = service
    ? `الجهة: ${company || "غير مسمّاة بعد"}. الاحتياج: ${intent}. التفاصيل: ${all.slice(0, 420)}`
    : all.slice(0, 280);
  const reply = service
    ? ready
      ? `واضح. نركّب لك «${service.title}» على خطكم. الملف جاهز تقريبًا — حوّله لطلب ونبدأ.`
      : `هذي تبدو «${service.title}». عطني اسم المحل، وكم رسالة توصلكم في اليوم.`
    : "سمعناك. تبي تجرب الخط كزبون، أو تشغّله على محلك؟ قلّي اللي عندك.";

  return emptyTurn({
    reply,
    dialect,
    dialect_label: dialectLabels[dialect],
    intent,
    route: ready ? "handoff" : "reply",
    route_label: ready ? routeLabels.handoff : routeLabels.reply,
    service_slug: slug,
    company,
    brief_so_far: brief,
    next_need: ready ? "اعتماد الملف وإرساله كطلب" : "اسم الجهة وتفاصيل أوضح",
    ready,
    confidence: service ? (ready ? 78 : 54) : 28,
    stack,
  });
}

/** JSON Schema of one Deal Line turn, for Claude structured outputs. */
const turnJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "dialect",
    "dialect_label",
    "intent",
    "route",
    "route_label",
    "service_slug",
    "company",
    "brief_so_far",
    "next_need",
    "ready",
    "confidence",
    "stack",
  ],
  properties: {
    reply: { type: "string" },
    dialect: { type: "string", enum: [...dialects] },
    dialect_label: { type: "string" },
    intent: { type: "string" },
    route: { type: "string", enum: [...routes] },
    route_label: { type: "string" },
    service_slug: { type: "string", enum: [...serviceSlugs] },
    company: { type: "string" },
    brief_so_far: { type: "string" },
    next_need: { type: "string" },
    ready: { type: "boolean" },
    confidence: { type: "integer" },
    stack: { type: "array", items: { type: "string" } },
  },
} as const;

/**
 * Claude (Anthropic) — the primary engine. Structured outputs guarantee the
 * turn JSON; `fallbacks: "default"` lets the API re-run a declined request on
 * Anthropic's recommended fallback model instead of returning a refusal.
 * Returns null when the whole chain refuses, so the caller can fall back.
 */
async function callClaude(messages: LineMessage[]): Promise<string | null> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ timeout: 28_000, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    // A turn is a short JSON object; the cap bounds spend on an open endpoint.
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Chat is latency-sensitive and each turn is routine: keep thinking light.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: turnJsonSchema },
    },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : null;
}

/**
 * Claude through Vercel AI Gateway — needs no Anthropic key. On a Vercel
 * deployment the gateway authenticates with the project's own OIDC token
 * (billed to the Vercel team's AI Gateway credits); AI_GATEWAY_API_KEY
 * works anywhere. Anthropic-only request fields (betas, fallbacks) are not
 * sent through the gateway.
 */
async function callClaudeGateway(messages: LineMessage[], apiKey: string): Promise<string | null> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey,
    baseURL: "https://ai-gateway.vercel.sh",
    timeout: 28_000,
    maxRetries: 1,
  });
  const response = await client.messages.create({
    model: "anthropic/claude-opus-5",
    max_tokens: 2000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: turnJsonSchema },
    },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : null;
}

/** The deployment's Vercel OIDC token, or null when not running on Vercel. */
async function vercelOidcToken(): Promise<string | null> {
  if (!process.env.VERCEL) return null;
  try {
    const { getVercelOidcToken } = await import("@vercel/oidc");
    return (await getVercelOidcToken()) || null;
  } catch {
    return null;
  }
}

/** xAI Grok — secondary engine, kept for deploys that only carry XAI_API_KEY. */
async function callXai(messages: LineMessage[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.7,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, ...messages],
    }),
    signal: AbortSignal.timeout(28000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`xAI ${res.status} ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

/** The first configured engine: Claude, then xAI; null means local router only. */
/**
 * The first available engine, most direct first:
 * 1. ANTHROPIC_API_KEY → Claude on the Anthropic API (with refusal fallbacks);
 * 2. AI_GATEWAY_API_KEY → Claude through Vercel AI Gateway;
 * 3. XAI_API_KEY → xAI (the Grok platform injects this on its deploys);
 * 4. on the team's own Vercel deploy → Claude through AI Gateway via OIDC;
 * null → the local router answers.
 */
async function modelEngine(): Promise<
  ((messages: LineMessage[]) => Promise<string | null>) | null
> {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return callClaude;
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) return (messages) => callClaudeGateway(messages, gatewayKey);
  const xaiKey = process.env.XAI_API_KEY?.trim();
  if (xaiKey) return (messages) => callXai(messages, xaiKey);
  const oidc = await vercelOidcToken();
  if (oidc) return (messages) => callClaudeGateway(messages, oidc);
  return null;
}

export const routeLine = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; turn: LineTurn } | { ok: false; error: string }> => {
      const userTurns = data.messages.filter((m) => m.role === "user").length;
      if (userTurns > LINE_MAX_TURNS) {
        return { ok: false, error: "بلغت حد الجلسة. حوّل الملف لطلب أو ابدأ من جديد." };
      }
      const last = data.messages[data.messages.length - 1];
      if (!last || last.role !== "user") {
        return { ok: false, error: "أرسل رسالة أولاً." };
      }

      // Unauthenticated and spends the owner's model quota, so: same-site only,
      // throttled per visitor, and capped per day (then the local router answers).
      const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
      const { visitorId, tryHit, takeHit, RateLimitError } =
        await import("@/lib/rate-limit.server");
      assertSameSiteRequest();
      try {
        await takeHit(`line:${visitorId()}`, LINE_IP_LIMIT_PER_HOUR, 3600);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return { ok: false, error: "الخط مزدحم منك. جرّب بعد ساعة أو اتصل بنا مباشرة." };
        }
        throw err;
      }

      const engine = await modelEngine();
      // Reserve a paid call atomically; past the daily cap the local router answers.
      if (!engine || !(await tryHit("line:model", LINE_DAILY_MODEL_CAP, 86400))) {
        return { ok: true, turn: localRoute(data.messages) };
      }

      try {
        const raw = await engine(data.messages);
        if (!raw) return { ok: true, turn: localRoute(data.messages) };
        const turn = parseTurn(raw);
        if (!turn.dialect_label) turn.dialect_label = dialectLabels[turn.dialect];
        if (!turn.route_label) turn.route_label = routeLabels[turn.route];
        return { ok: true, turn };
      } catch {
        try {
          return { ok: true, turn: localRoute(data.messages) };
        } catch {
          return { ok: false, error: "الخط مشغول لحظة. أعد الإرسال." };
        }
      }
    },
  );
