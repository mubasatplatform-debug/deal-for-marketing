import type { DraftKind, DraftStatus } from "@/lib/law/ai/drafts-core";

/**
 * Client-safe copy of the draft kinds (drafts-core.ts pulls in server code).
 * Keep in step with DRAFT_KINDS / DRAFT_KIND_LABELS there.
 */
export const DRAFT_KIND_LIST: readonly { kind: DraftKind; label: string; hint: string }[] = [
  { kind: "claim", label: "صحيفة دعوى", hint: "الوقائع والأسانيد والطلبات وفق نظام المرافعات." },
  { kind: "defense_memo", label: "مذكرة جوابية (دفاع)", hint: "الدفوع الشكلية ثم الرد على كل ادعاء بعينه." },
  { kind: "reply_memo", label: "مذكرة تعقيبية", hint: "تعقيب نقطة نقطة على مذكرة الطرف الآخر." },
  { kind: "objection", label: "لائحة اعتراضية (استئناف)", hint: "أسباب الاعتراض على الحكم وطلب نقضه أو تعديله." },
  { kind: "notice", label: "إنذار / إخطار", hint: "مطالبة محددة بمهلة وما يُتخذ عند عدم الاستجابة." },
  { kind: "fee_agreement", label: "عقد أتعاب محاماة", hint: "نطاق التوكيل والأتعاب وطريقة السداد والتزامات الطرفين." },
  { kind: "contract", label: "عقد", hint: "بنود مرقّمة: المحل والمقابل والمدة والإخلال والإنهاء." },
  { kind: "letter", label: "خطاب رسمي", hint: "خطاب موجّه لجهة أو طرف بطلب محدد." },
  { kind: "legal_opinion", label: "رأي قانوني / استشارة مكتوبة", hint: "الوقائع والمسألة والتحليل والتوصية للعميل." },
  { kind: "case_summary", label: "ملخص قضية", hint: "الأطراف والوقائع والجلسات ونقاط القوة والخطوات التالية." },
];

export const DRAFT_KIND_LABEL: Record<DraftKind, string> = Object.fromEntries(
  DRAFT_KIND_LIST.map((k) => [k.kind, k.label]),
) as Record<DraftKind, string>;

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  pending: "قيد الكتابة",
  ready: "جاهزة",
  failed: "تعذّرت",
};

export const DRAFT_DISCLAIMER = "مسودة آلية — راجعها وتحقق من الوقائع وأرقام المواد قبل استخدامها.";
