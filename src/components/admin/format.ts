import type { Tone } from "@/components/dash/ui";
import type { AdminRequestRow } from "@/lib/admin";
import { requestStatus } from "@/lib/content";

/** Gregorian calendar, Latin digits — the product's one date locale. */
const LOCALE = "ar-SA-u-nu-latn-ca-gregory";

export const STATUS_ORDER = ["new", "review", "production", "delivered"] as const;
export type Status = (typeof STATUS_ORDER)[number];

export const statusTone: Record<string, Tone> = {
  new: "lime",
  review: "pine",
  production: "info",
  delivered: "neutral",
};

export const statusLabel = (s: string) => requestStatus[s] ?? s;

const absFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const rtf = new Intl.RelativeTimeFormat("ar-u-nu-latn", { numeric: "auto" });

export const formatAbsolute = (d: Date) => absFmt.format(d);
export const formatDay = (d: Date) => dayFmt.format(d);
export const formatLongDay = (d: Date) => longDayFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);

export function formatRelative(d: Date, now: number): string {
  const diff = (d.getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "الآن";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return shortDateFmt.format(d);
}

const pr = new Intl.PluralRules("ar");
type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Arabic count phrase: 1 طلب واحد، 2 طلبان، 3 طلبات، 11 طلبًا. */
export function countOf(n: number, forms: Forms): string {
  const cat = pr.select(n);
  const word = forms[cat] ?? forms.other;
  if (cat === "zero" && forms.zero) return forms.zero;
  if (cat === "one" || cat === "two") return word;
  return `${n.toLocaleString("en-US")} ${word}`;
}

export const requestsWord: Forms = {
  zero: "لا طلبات",
  one: "طلب واحد",
  two: "طلبان",
  few: "طلبات",
  many: "طلبًا",
  other: "طلب",
};

/** Digits only (Arabic-Indic folded to Latin), in international form for Saudi numbers. */
export function normalizePhone(raw: string): string {
  let d = raw
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = `966${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith("5")) d = `966${d}`;
  return d;
}

/** "+966 55 123 4567" for Saudi mobiles, the raw value otherwise. */
export function displayPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length === 12 && d.startsWith("9665")) {
    return `+966 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return raw.trim();
}

export function whatsappHref(r: AdminRequestRow): string | null {
  const d = normalizePhone(r.phone);
  if (d.length < 8) return null;
  const name = r.contact_name.trim();
  const text = `${name ? `مرحبًا ${name}،` : "مرحبًا،"} معك فريق ديل بخصوص طلبك رقم #${r.id} (${r.service_title}).`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function initialsName(r: AdminRequestRow): string {
  return r.contact_name.trim() || r.account_email?.split("@")[0] || "عميل";
}

export function matchesQuery(r: AdminRequestRow, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return true;
  if (/^\d+$/.test(needle) && String(r.id) === needle) return true;
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 3 && normalizePhone(r.phone).includes(normalizePhone(digits))) return true;
  return [r.contact_name, r.company, r.brief, r.service_title, r.account_email ?? "", String(r.id)]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

/** Neutralise spreadsheet formulas in free text (CSV injection). */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(rows: AdminRequestRow[], now = new Date()) {
  const head = [
    "رقم الطلب",
    "الخدمة",
    "الاسم",
    "الجوال",
    "الشركة",
    "البريد",
    "الحالة",
    "تاريخ الطلب",
    "الإشعار",
    "التفاصيل",
  ];
  const lines = rows.map((r) =>
    [
      String(r.id),
      r.service_title,
      r.contact_name,
      // Spaced digits stay text in Excel and never start a formula.
      displayPhone(r.phone).replace(/^\+/, ""),
      r.company,
      r.account_email ?? "",
      statusLabel(r.status),
      formatAbsolute(new Date(r.created_at)),
      r.notified_at ? "وصل" : "لم يصل",
      r.brief,
    ]
      .map(cell)
      .join(","),
  );
  const csv = `\uFEFF${[head.map(cell).join(","), ...lines].join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `deal-requests-${now.toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DAY = 86_400_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeStats(rows: AdminRequestRow[], now: number) {
  const weekAgo = now - 7 * DAY;
  const twoWeeksAgo = now - 14 * DAY;
  let thisWeek = 0;
  let lastWeek = 0;
  let delivered = 0;
  let unnotified = 0;
  let fresh = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t >= weekAgo) thisWeek++;
    else if (t >= twoWeeksAgo) lastWeek++;
    if (r.status === "delivered") delivered++;
    if (r.status === "new") fresh++;
    if (!r.notified_at) unnotified++;
  }
  return {
    total: rows.length,
    fresh,
    thisWeek,
    lastWeek,
    delivered,
    unnotified,
    rate: rows.length ? Math.round((delivered / rows.length) * 100) : 0,
  };
}

export function dailySeries(rows: AdminRequestRow[], now: number, days = 30) {
  const today = startOfDay(now);
  const first = today - (days - 1) * DAY;
  const buckets = Array.from({ length: days }, (_, i) => ({ t: first + i * DAY, count: 0 }));
  for (const r of rows) {
    const t = startOfDay(new Date(r.created_at).getTime());
    const i = Math.round((t - first) / DAY);
    if (i >= 0 && i < days) buckets[i].count++;
  }
  return buckets;
}

export function byService(rows: AdminRequestRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.service_title, (map.get(r.service_title) ?? 0) + 1);
  return [...map.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ar"));
}

export type Customer = {
  key: string;
  name: string;
  company: string;
  phone: string;
  email: string | null;
  count: number;
  last: number;
  services: string[];
  latest: AdminRequestRow;
};

export function aggregateCustomers(rows: AdminRequestRow[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const r of rows) {
    const key = normalizePhone(r.phone) || r.account_email || `#${r.id}`;
    const t = new Date(r.created_at).getTime();
    const c = map.get(key);
    if (!c) {
      map.set(key, {
        key,
        name: initialsName(r),
        company: r.company,
        phone: r.phone,
        email: r.account_email,
        count: 1,
        last: t,
        services: [r.service_title],
        latest: r,
      });
      continue;
    }
    c.count++;
    if (!c.services.includes(r.service_title)) c.services.push(r.service_title);
    if (t > c.last) {
      c.last = t;
      c.latest = r;
      if (r.contact_name.trim()) c.name = r.contact_name.trim();
      if (r.company) c.company = r.company;
    }
    if (!c.company && r.company) c.company = r.company;
    if (!c.email && r.account_email) c.email = r.account_email;
  }
  return [...map.values()].sort((a, b) => b.last - a.last);
}
