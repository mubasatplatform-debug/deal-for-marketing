import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SCOPE_INFO } from "@/lib/api/scopes";
import { SITE_URL, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/developers")({
  head: () =>
    pageHead({
      title: "دليل المطوّرين — API وخادم MCP",
      description:
        "اربط متجرك وأدوات الأتمتة ومساعدي الذكاء الاصطناعي بحسابك في ديل: REST API وخادم MCP بمفاتيح وصلاحيات محددة.",
      path: "/developers",
    }),
  component: Developers,
});

const API = `${SITE_URL}/api/v1`;
const MCP = `${SITE_URL}/api/mcp`;

type Endpoint = { method: string; path: string; scope: string; body: ReactNode };

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/services",
    scope: "public",
    body: (
      <>
        قائمة خدمات ديل ومعرّف كل خدمة <Mono>slug</Mono>. عامة، لا تحتاج مفتاحًا.
      </>
    ),
  },
  {
    method: "GET",
    path: "/requests",
    scope: "requests:read",
    body: (
      <>
        طلباتك أنت فقط، الأحدث أولًا، مع ترقيم الصفحات وتصفية اختيارية بالحالة (حتى 100 في الصفحة).
        <Mono block>?limit=20&offset=0&status=review</Mono>
      </>
    ),
  },
  {
    method: "GET",
    path: "/requests/:id",
    scope: "requests:read",
    body: "طلب واحد من طلباتك وحالته الحالية.",
  },
  {
    method: "POST",
    path: "/requests",
    scope: "requests:write",
    body: (
      <>
        ينشئ طلب خدمة باسم حسابك، حتى 20 طلبًا في الساعة لكل مفتاح. قيمة <Mono>consent</Mono> يجب أن
        تكون <Mono>true</Mono> (موافقة صاحب الطلب على التواصل).
        <Mono block>slug · name · phone · company · brief · consent</Mono>
      </>
    ),
  },
  {
    method: "GET",
    path: "/admin/requests",
    scope: "admin:requests:read",
    body: "لفريق ديل: طلبات كل العملاء مع بيانات التواصل.",
  },
  {
    method: "PATCH",
    path: "/admin/requests/:id",
    scope: "admin:requests:write",
    body: (
      <>
        لفريق ديل: يغيّر حالة الطلب إلى إحدى المراحل.
        <Mono block>{'{ "status": "new" | "review" | "production" | "delivered" }'}</Mono>
      </>
    ),
  },
];

const tools: { name: string; scope: string }[] = [
  { name: "deal_list_services", scope: "services:read" },
  { name: "deal_list_my_requests", scope: "requests:read" },
  { name: "deal_get_request", scope: "requests:read" },
  { name: "deal_create_request", scope: "requests:write" },
  { name: "deal_admin_list_requests", scope: "admin:requests:read" },
  { name: "deal_admin_update_request_status", scope: "admin:requests:write" },
];

const errors: { status: string; code: string; body: ReactNode }[] = [
  { status: "401", code: "unauthorized", body: "المفتاح ناقص أو غير صحيح أو ملغى أو منتهي." },
  {
    status: "403",
    code: "insufficient_scope",
    body: "المفتاح لا يملك الصلاحية المطلوبة لهذا المسار.",
  },
  { status: "404", code: "not_found", body: "المسار غير موجود، أو الطلب ليس من طلبات حسابك." },
  {
    status: "422",
    code: "validation_error",
    body: (
      <>
        حقل غير صالح؛ القائمة <Mono>details</Mono> تذكر كل حقل وسببه.
      </>
    ),
  },
  {
    status: "429",
    code: "rate_limited",
    body: (
      <>
        تجاوزت الحد (60 استدعاء في الدقيقة لكل مفتاح). انتظر عدد الثواني في ترويسة{" "}
        <Mono>Retry-After</Mono>.
      </>
    ),
  },
];

const curlList = `curl ${API}/requests \\
  -H "Authorization: Bearer $DEAL_API_KEY"`;

const curlCreate = `curl ${API}/requests \\
  -H "Authorization: Bearer $DEAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "crm",
    "name": "سارة العتيبي",
    "phone": "0551234567",
    "company": "متجر الورد",
    "brief": "نحتاج نظام CRM يربط طلبات المتجر بفريق المبيعات",
    "consent": true
  }'`;

const responseShape = `{
  "data": [ { "id": 42, "service": { "slug": "crm", "title": "…" },
              "status": "review", "status_label": "…", "created_at": "…" } ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "has_more": false, "next_offset": null }
}`;

const claudeCode = `claude mcp add --transport http deal ${MCP} \\
  --header "Authorization: Bearer $DEAL_API_KEY"`;

const mcpJson = `{
  "mcpServers": {
    "deal": {
      "type": "http",
      "url": "${MCP}",
      "headers": { "Authorization": "Bearer deal_live_…" }
    }
  }
}`;

function Code({ children, label }: { children: string; label: string }) {
  return (
    <figure className="mt-4 min-w-0">
      <figcaption className="text-xs text-dim">{label}</figcaption>
      <pre
        dir="ltr"
        className="mt-2 overflow-x-auto border border-hair/60 bg-black/30 p-4 text-start font-mono text-[12.5px] leading-relaxed text-snow"
      >
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function Mono({ children, block }: { children: ReactNode; block?: boolean }) {
  return (
    <code
      dir="ltr"
      className={
        block
          ? "mt-1 block text-end font-mono text-[12.5px] break-words text-lime"
          : "font-mono text-[12.5px] break-words text-lime [unicode-bidi:isolate]"
      }
    >
      {children}
    </code>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="font-display text-xl text-snow">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-loose text-mist">{children}</div>
    </section>
  );
}

function Developers() {
  return (
    <SiteChrome>
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">المطوّرون //</p>
        <h1 className="mt-4 font-display text-poster text-snow">دليل المطوّرين</h1>
        <p className="mt-4 max-w-2xl text-sm leading-loose text-mist">
          اربط متجرك وأدوات الأتمتة ومساعدي الذكاء الاصطناعي بحسابك في ديل. كل استدعاء يتم بمفتاح
          API تنشئه بنفسك وتحدد صلاحياته ومدته، وتلغيه متى شئت.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/client/keys"
            className="inline-flex h-11 items-center bg-lime px-5 font-display text-sm text-ink transition-opacity hover:opacity-90"
          >
            أنشئ مفتاحًا
          </a>
          <a
            href="#mcp"
            className="inline-flex h-11 items-center border border-hair px-5 font-display text-sm text-snow transition-colors hover:border-lime hover:text-lime"
          >
            ربط MCP
          </a>
        </div>

        <div className="mt-14 max-w-3xl space-y-12">
          <Section id="auth" title="المصادقة">
            <p>
              أنشئ مفتاحًا من{" "}
              <a href="/client/keys" className="text-lime">
                مفاتيح API
              </a>{" "}
              في حسابك. يظهر المفتاح كاملًا مرة واحدة فقط، ونحفظ منه بصمة مشفّرة لا غير. أرسله في
              ترويسة كل طلب:
            </p>
            <Code label="الترويسة">{"Authorization: Bearer deal_live_…"}</Code>
            <p>
              عنوان الـ API: <Mono>{API}</Mono>. الإجابات JSON دائمًا:{" "}
              <Mono>{"{ data, meta }"}</Mono> عند النجاح، و
              <Mono>{"{ error: { code, message, details } }"}</Mono> عند الخطأ. لا تضع المفتاح في
              كود يصل للمتصفح.
            </p>
          </Section>

          <Section id="scopes" title="الصلاحيات">
            <p>امنح كل مفتاح أقل ما يحتاجه تكاملك. صلاحيات الفريق لا تظهر إلا لحسابات فريق ديل.</p>
            <ul className="divide-y divide-hair/40 border-y border-hair/40">
              {SCOPE_INFO.map((s) => (
                <li key={s.scope} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                  <span className="shrink-0 sm:w-48">
                    <Mono>{s.scope}</Mono>
                  </span>
                  <span>
                    <strong className="text-snow">{s.label}.</strong> {s.body}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="rest" title="مسارات REST">
            <ul className="divide-y divide-hair/40 border-y border-hair/40">
              {endpoints.map((e) => (
                <li key={e.method + e.path} className="min-w-0 py-3">
                  <p
                    dir="ltr"
                    className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-start"
                  >
                    <span className="font-mono text-xs text-dim">{e.scope}</span>
                    <span className="font-mono text-[13px] text-snow">
                      <span className="text-lime">{e.method}</span> /api/v1{e.path}
                    </span>
                  </p>
                  <p className="mt-1 min-w-0">{e.body}</p>
                </li>
              ))}
            </ul>
            <Code label="قراءة طلباتك">{curlList}</Code>
            <Code label="شكل الإجابة">{responseShape}</Code>
            <Code label="إنشاء طلب (يحتاج requests:write)">{curlCreate}</Code>
          </Section>

          <Section id="mcp" title="خادم MCP">
            <p>
              يعمل خادم MCP عبر Streamable HTTP على <Mono>{MCP}</Mono> بالمفتاح نفسه. يرى المساعد
              فقط الأدوات التي تسمح بها صلاحيات المفتاح:
            </p>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {tools.map((t) => (
                <li
                  key={t.name}
                  dir="ltr"
                  className="flex flex-wrap justify-end gap-x-2 text-start"
                >
                  <span className="font-mono text-xs text-dim">{t.scope}</span>
                  <span className="font-mono text-[12.5px] text-snow">{t.name}</span>
                </li>
              ))}
            </ul>
            <Code label="Claude Code">{claudeCode}</Code>
            <Code label="عملاء يقبلون ملف إعداد (mcp.json)">{mcpJson}</Code>
          </Section>

          <Section id="errors" title="الأخطاء والحدود">
            <ul className="divide-y divide-hair/40 border-y border-hair/40">
              {errors.map((e) => (
                <li key={e.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                  <span dir="ltr" className="shrink-0 text-start font-mono text-[12.5px] sm:w-48">
                    <span className="text-snow">{e.status}</span>{" "}
                    <span className="text-lime">{e.code}</span>
                  </span>
                  <span>{e.body}</span>
                </li>
              ))}
            </ul>
            <p>
              كل استدعاء يُسجَّل باسم المفتاح ويظهر لك عدده في صفحة المفاتيح. إذا تسرّب مفتاح ألغِه
              فورًا؛ الإلغاء يسري في اللحظة نفسها.
            </p>
          </Section>

          <Link to="/start" className="inline-flex font-display text-sm text-lime">
            اطلب خدمتك
          </Link>
        </div>
      </main>
    </SiteChrome>
  );
}
