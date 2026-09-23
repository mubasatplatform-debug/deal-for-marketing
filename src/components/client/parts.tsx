import { Link } from "@tanstack/react-router";
import { agency, phone, services } from "@/lib/content";
import { TEAM_EMAIL, followUpText, statusLabel, stepIndex, waLink } from "./status";

/** The identity's play-triangle mark. */
export function PlayMark({ className = "h-3 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 20" className={className} aria-hidden="true">
      <polygon points="0,0 18,10 0,20" fill="currentColor" />
    </svg>
  );
}

/** Status chip: the four states climb from quiet pine to full lime. */
export function StatusChip({ status }: { status: string }) {
  const i = stepIndex(status);
  const tone = [
    "border border-pine-soft text-mist",
    "bg-pine text-snow",
    "bg-pine text-lime",
    "bg-lime text-pine-deep",
  ][i];
  const dot = ["bg-pine-soft", "bg-mist", "bg-lime motion-safe:animate-pulse", "bg-pine-deep"][i];
  return (
    <span className={`inline-flex h-7 shrink-0 items-center gap-2 px-2.5 font-display text-xs ${tone}`}>
      <span aria-hidden="true" className={`size-1.5 ${dot}`} />
      {statusLabel(status)}
    </span>
  );
}

/** DEAL rule: the mark followed by a 1px line, like the brand board's base line. */
export function MarkRule({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-3 text-lime ${className}`}>
      <PlayMark className="h-2.5 w-auto -scale-x-100" />
      <span className="h-px flex-1 bg-hair" />
    </div>
  );
}

export function ContactPanel({ latestId }: { latestId?: number }) {
  return (
    <section aria-labelledby="client-contact" className="border border-pine bg-pine-deep">
      <div className="p-6">
        <p className="text-kicker text-lime">تواصل مباشر //</p>
        <h2 id="client-contact" className="mt-3 font-display text-xl text-snow">
          فريق ديل على خط واحد معك
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          {latestId ? (
            <>
              اذكر رقم الطلب{" "}
              <span dir="ltr" className="font-ui text-snow">
                #{latestId}
              </span>{" "}
              لنصل لملفك أسرع.
            </>
          ) : (
            "نرد في أوقات العمل، ونتابع كل طلب حتى التسليم."
          )}
        </p>
      </div>
      <ul className="border-t border-pine">
        <ContactRow
          href={waLink(followUpText(latestId))}
          label="واتساب"
          value="راسلنا الآن"
          external
          primary
        />
        <ContactRow href={`tel:${phone.tel}`} label="اتصال" value={phone.display} ltr />
        <ContactRow href={`mailto:${TEAM_EMAIL}`} label="البريد" value={TEAM_EMAIL} ltr />
      </ul>
      <div className="flex items-center justify-between gap-4 border-t border-pine px-6 py-4">
        <p dir="ltr" lang="en" className="font-script text-2xl leading-none text-lime/90">
          Where Impact Stays
        </p>
        <PlayMark className="h-3 w-auto -scale-x-100 text-pine-soft" />
      </div>
    </section>
  );
}

function ContactRow({
  href,
  label,
  value,
  ltr,
  external,
  primary,
}: {
  href: string;
  label: string;
  value: string;
  ltr?: boolean;
  external?: boolean;
  primary?: boolean;
}) {
  return (
    <li className="border-b border-pine last:border-b-0">
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`group flex min-h-14 items-center justify-between gap-4 px-6 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime ${
          primary ? "bg-lime text-pine-deep hover:bg-lime/90" : "text-snow hover:bg-pine"
        }`}
      >
        <span className={`font-display text-sm ${primary ? "text-pine-deep" : "text-dim"}`}>{label}</span>
        <span className="flex items-center gap-3">
          <span dir={ltr ? "ltr" : undefined} className={ltr ? "font-ui text-sm font-semibold" : "font-display text-sm"}>
            {value}
          </span>
          <PlayMark
            className={`h-2.5 w-auto -scale-x-100 transition-transform group-hover:-translate-x-0.5 ${
              primary ? "text-pine-deep" : "text-lime"
            }`}
          />
        </span>
      </a>
    </li>
  );
}

export function GuestNote() {
  return (
    <p className="flex gap-3 border border-hair px-5 py-4 text-sm leading-relaxed text-dim">
      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-pine-soft" />
      طلبات أرسلتها بدون دخول تصلك متابعتها على جوالك.
    </p>
  );
}

const systemsFamily = services.filter((s) => !agency.some((a) => a.slug === s.slug));

export function EmptyState() {
  return (
    <section aria-labelledby="client-empty" className="border border-hair bg-card">
      <div className="relative overflow-hidden border-b border-hair p-6 md:p-10">
        <svg
          viewBox="0 0 200 220"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 hidden h-44 w-auto -translate-y-1/2 -scale-x-100 text-pine-soft md:block"
        >
          <polygon points="2,2 198,110 2,218" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="60,62 150,110 60,158" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="84,88 124,110 84,132" className="fill-lime" />
        </svg>
        <p className="relative text-kicker text-lime">البداية //</p>
        <h2 id="client-empty" className="relative mt-3 font-display text-2xl text-snow md:text-3xl">
          لا توجد طلبات بعد
        </h2>
        <p className="relative mt-3 max-w-md text-sm leading-relaxed text-mist">
          اختر الخدمة، اكتب لنا ما تحتاجه في دقيقة، وتابع كل خطوة من هنا حتى التسليم.
        </p>
        <Link
          to="/start"
          className="relative mt-6 inline-flex h-12 items-center gap-3 bg-lime px-6 font-display text-sm text-ink transition-colors hover:bg-lime/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          ابدأ طلبك الأول
          <PlayMark className="h-2.5 w-auto -scale-x-100" />
        </Link>
      </div>
      <div className="grid gap-px bg-hair md:grid-cols-2">
        <ServiceFamily title="الأنظمة" items={systemsFamily} />
        <ServiceFamily title="الوكالة" items={agency} />
      </div>
    </section>
  );
}

function ServiceFamily({ title, items }: { title: string; items: readonly (typeof services)[number][] }) {
  return (
    <div className="bg-card p-6">
      <p className="font-display text-sm text-dim">{title}</p>
      <ul className="mt-3">
        {items.map((s) => (
          <li key={s.slug} className="border-b border-hair last:border-b-0">
            <Link
              to="/start/$slug"
              params={{ slug: s.slug }}
              className="group flex min-h-12 items-center gap-4 py-2 text-snow transition-colors hover:text-lime focus-visible:outline-2 focus-visible:outline-lime"
            >
              <span className="font-ui text-xs font-semibold text-pine-soft group-hover:text-lime">{s.n}</span>
              <span className="flex-1 font-display text-sm">{s.title}</span>
              <PlayMark className="h-2 w-auto -scale-x-100 text-dim group-hover:text-lime" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
