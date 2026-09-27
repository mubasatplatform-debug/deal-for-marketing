/**
 * «المهل النظامية» — objection deadlines computed from the date the period
 * starts, per the articles of the Ministry of Justice laws (each rule names
 * its article, and the article's text is read from the library). Pure date
 * maths plus one core that files the deadline as a task on the case.
 * Bare SQL tag, relative imports (PGLite-testable).
 */
import { WorkspaceError, type SqlTag, type WorkspaceAccess } from "../../saas/tenancy-core.ts";
import { addDays, weekday } from "../time.ts";
import { assertCase, createTaskCore, need } from "../practice-core.ts";
import { getArticleCore, type ArticleHit } from "./library-core.ts";

export type DeadlineRule = {
  id: string;
  label: string;
  /** Days in the period; `urgentDays` for matters the court decided as urgent. */
  days: number;
  urgentDays?: number;
  law: string;
  article: string;
  /** When the period starts, in the law's words (shown next to the date field). */
  startsWhen: string;
  /** The article that fixes the start (shown with the result). */
  startArticle?: { law: string; article: string };
};

const CIVIL_START = { law: "نظام المرافعات الشرعية", article: "179" };

export const DEADLINE_RULES: DeadlineRule[] = [
  {
    id: "appeal",
    label: "الاعتراض بطلب الاستئناف أو التدقيق",
    days: 30,
    urgentDays: 10,
    law: "نظام المرافعات الشرعية",
    article: "187",
    startsWhen: "من تاريخ تسلّم صورة صك الحكم (أو إيداعها في ملف الدعوى إن لم يحضر)، ومن تاريخ التبليغ في الحكم الغيابي",
    startArticle: CIVIL_START,
  },
  {
    id: "cassation",
    label: "الاعتراض بطلب النقض",
    days: 30,
    urgentDays: 15,
    law: "نظام المرافعات الشرعية",
    article: "194",
    startsWhen: "من تاريخ تسلّم صورة صك حكم الاستئناف أو التبليغ به",
    startArticle: CIVIL_START,
  },
  {
    id: "review",
    label: "التماس إعادة النظر",
    days: 30,
    law: "نظام المرافعات الشرعية",
    article: "201",
    startsWhen: "من اليوم الذي يثبت فيه علم الملتمس بسبب الالتماس (أو من إبلاغ الحكم في بعض الحالات)",
  },
  {
    id: "payment_order",
    label: "التظلم من أمر الأداء",
    days: 15,
    law: "نظام المحاكم التجارية",
    article: "71",
    startsWhen: "من تاريخ إبلاغ المدين بأمر الأداء",
  },
  {
    id: "criminal_appeal",
    label: "الاعتراض بطلب الاستئناف (جزائي)",
    days: 30,
    law: "نظام الإجراءات الجزائية",
    article: "194",
    startsWhen: "من تاريخ تسلّم صورة الحكم",
  },
  {
    id: "criminal_cassation",
    label: "الاعتراض بطلب النقض (جزائي)",
    days: 30,
    law: "نظام الإجراءات الجزائية",
    article: "199",
    startsWhen: "من تاريخ تسلّم صورة حكم الاستئناف",
  },
];

export const RULE_BY_ID = new Map(DEADLINE_RULES.map((r) => [r.id, r]));

export type DeadlineResult = {
  rule: DeadlineRule;
  urgent: boolean;
  days: number;
  start: string;
  /** Last day by count (start day excluded, art. 22). */
  lastDay: string;
  /** After moving off a Friday/Saturday weekend. */
  deadline: string;
  movedForWeekend: boolean;
  daysLeft: number;
};

/**
 * Civil Procedure art. 22: the start day is not counted; the period ends with
 * its last day; a last day on an official holiday moves to the next working
 * day. Weekends (Friday, Saturday) are handled here; Eid holidays are not
 * known in advance, so the caller warns about them.
 */
export function computeDeadline(ruleId: string, startYmd: string, urgent: boolean, todayYmd: string): DeadlineResult {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) throw new WorkspaceError("invalid", 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) throw new WorkspaceError("invalid", 422);
  const days = urgent && rule.urgentDays ? rule.urgentDays : rule.days;
  const lastDay = addDays(startYmd, days);
  let deadline = lastDay;
  while ([5, 6].includes(weekday(deadline))) deadline = addDays(deadline, 1);
  const daysLeft = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86_400_000);
  return { rule, urgent: urgent && Boolean(rule.urgentDays), days, start: startYmd, lastDay, deadline, movedForWeekend: deadline !== lastDay, daysLeft };
}

/** The rule's article (and the start article) from the library, when loaded. */
export async function ruleArticlesCore(sql: SqlTag, rule: DeadlineRule): Promise<ArticleHit[]> {
  const out: ArticleHit[] = [];
  const main = await getArticleCore(sql, rule.law, rule.article).catch(() => null);
  if (main) out.push(main);
  if (rule.startArticle) {
    const start = await getArticleCore(sql, rule.startArticle.law, rule.startArticle.article).catch(() => null);
    if (start) out.push(start);
  }
  return out;
}

/** File the deadline on a case: a task due on the deadline, assigned to the caller. */
export async function fileDeadlineCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  input: { caseId: string; ruleId: string; start: string; urgent: boolean; today: string },
): Promise<{ taskId: string; result: DeadlineResult }> {
  need(access, "task.create");
  await assertCase(sql, access, input.caseId);
  const result = computeDeadline(input.ruleId, input.start, input.urgent, input.today);
  const r = result.rule;
  const notes = [
    `المدة: ${result.days} يومًا${result.urgent ? " (مسألة مستعجلة)" : ""} — ${r.law}، المادة (${r.article}).`,
    `بداية المدة: ${input.start} (${r.startsWhen}). لا يُحسب يوم البداية.`,
    result.movedForWeekend ? `آخر يوم بالعدّ ${result.lastDay} وافق عطلة نهاية الأسبوع فامتد إلى ${result.deadline}.` : "",
    "إذا وافق آخر المدة عطلة رسمية امتد إلى أول يوم عمل بعدها (المادة 22 من نظام المرافعات الشرعية). تحقّق من التواريخ قبل الاعتماد.",
  ]
    .filter(Boolean)
    .join("\n");
  const task = await createTaskCore(sql, access, {
    title: `آخر يوم: ${r.label}`.slice(0, 200),
    notes: notes.slice(0, 2000),
    caseId: input.caseId,
    assigneeId: access.userId,
    dueOn: result.deadline,
  });
  return { taskId: task.id, result };
}
