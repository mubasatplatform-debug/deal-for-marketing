import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow, Frame, Photo } from "@/components/site-ui";
import { SCOPE_INFO } from "@/lib/api/scopes";
import { SITE_URL, pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

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

const toc = [
  { id: "auth", label: "المصادقة" },
  { id: "scopes", label: "الصلاحيات" },
  { id: "rest", label: "مسارات REST" },
  { id: "mcp", label: "خادم MCP" },
  { id: "errors", label: "الأخطاء والحدود" },
];

function Code({ children, label }: { children: string; label: string }) {
  return (
    <figure className="mt-4 min-w-0">
      <figcaption className="text-xs font-bold text-slate">{label}</figcaption>
      <pre
        dir="ltr"
        className="mt-2 overflow-x-auto rounded-2xl bg-pine-deep p-4 text-start font-mono text-[12.5px] leading-relaxed text-snow"
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
          ? "mt-2 block w-fit max-w-full rounded-lg bg-pine-50 px-2 py-1 text-end font-mono text-[12.5px] break-words text-pine ms-auto"
          : "rounded-md bg-pine-50 px-1.5 py-0.5 font-mono text-[12.5px] break-words text-pine [unicode-bidi:isolate]"
      }
    >
      {children}
    </code>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 rounded-3xl bg-surface p-6 ring-1 ring-line md:p-8">
      <h2 id={`${id}-h`} className="font-display text-xl text-pine-deep md:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-loose text-slate">{children}</div>
    </section>
  );
}

function Developers() {
  return (
    <SiteChrome>
      <main className="bg-paper pt-24 pb-20 md:pt-32 md:pb-28">
        <div className={cn(wrap, "grid items-center gap-10 lg:grid-cols-12 lg:gap-14")}>
          <div className="lg:col-span-7">
            <Eyebrow>المطوّرون</Eyebrow>
            <h1 className="mt-4 font-display text-[2.3rem] leading-[1.25] text-pine-deep md:text-5xl">دليل المطوّرين</h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate">
              اربط متجرك وأدوات الأتمتة ومساعدي الذكاء الاصطناعي بحسابك في ديل. كل استدعاء يتم بمفتاح API تنشئه بنفسك
              وتحدد صلاحياته ومدته، وتلغيه متى شئت.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/client/keys" className={siteButton("primary")}>
                أنشئ مفتاحًا
              </a>
              <a href="#mcp" className={siteButton("secondary")}>
                ربط MCP
              </a>
            </div>
          </div>
          <Frame className="hidden aspect-[3/2] lg:col-span-5 lg:block">
            <Photo
              name="analyst"
              alt="رجل بشماغ يعمل على جواله وحاسوبه وسط أوراق عمل"
              sizes="(min-width: 1240px) 480px, 40vw"
            />
          </Frame>
        </div>

        <div className={cn(wrap, "mt-12 grid gap-8 lg:grid-cols-12")}>
          <aside className="hidden lg:order-last lg:col-span-4 lg:block">
            <nav aria-label="أقسام الدليل" className="sticky top-28 rounded-3xl bg-surface p-6 ring-1 ring-line">
              <p className="text-sm font-bold text-pine">في هذا الدليل</p>
              <ol className="mt-3 space-y-0.5">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="flex min-h-10 items-center rounded-lg px-3 text-[15px] font-semibold text-slate hover:bg-pine-50 hover:text-pine-deep"
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
              <a href="/client/keys" className={cn(siteButton("dark"), "mt-5 w-full")}>
                مفاتيح API في حسابك
              </a>
            </nav>
          </aside>
          <div className="min-w-0 space-y-5 lg:col-span-8">
            <Section id="auth" title="المصادقة">
              <p>
                أنشئ مفتاحًا من{" "}
                <a href="/client/keys" className="font-bold text-pine underline underline-offset-4">
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
              <ul className="divide-y divide-line border-y border-line">
                {SCOPE_INFO.map((s) => (
                  <li key={s.scope} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                    <span className="shrink-0 sm:w-48">
                      <Mono>{s.scope}</Mono>
                    </span>
                    <span>
                      <strong className="text-pine-deep">{s.label}.</strong> {s.body}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="rest" title="مسارات REST">
              <ul className="divide-y divide-line border-y border-line">
                {endpoints.map((e) => (
                  <li key={e.method + e.path} className="min-w-0 py-3">
                    <p
                      dir="ltr"
                      className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-start"
                    >
                      <span className="font-mono text-xs text-slate">{e.scope}</span>
                      <span className="font-mono text-[13px] text-pine-deep">
                        <span className="font-bold text-pine">{e.method}</span> /api/v1{e.path}
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
                    <span className="font-mono text-xs text-slate">{t.scope}</span>
                    <span className="font-mono text-[12.5px] text-pine-deep">{t.name}</span>
                  </li>
                ))}
              </ul>
              <Code label="Claude Code">{claudeCode}</Code>
              <Code label="عملاء يقبلون ملف إعداد (mcp.json)">{mcpJson}</Code>
            </Section>

            <Section id="errors" title="الأخطاء والحدود">
              <ul className="divide-y divide-line border-y border-line">
                {errors.map((e) => (
                  <li key={e.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                    <span dir="ltr" className="shrink-0 text-start font-mono text-[12.5px] sm:w-48">
                      <span className="font-bold text-pine-deep">{e.status}</span>{" "}
                      <span className="text-pine">{e.code}</span>
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

            <Link to="/start" className={cn(siteButton("secondary"), "mt-4")}>
              اطلب خدمتك
            </Link>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
