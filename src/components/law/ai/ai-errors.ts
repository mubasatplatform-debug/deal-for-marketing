import { workspaceErrorCode, workspaceErrorMessage } from "@/lib/saas/errors";

/** Arabic message for errors of the AI features (a few codes read differently here). */
export function aiErrorMessage(err: unknown): string {
  const code = workspaceErrorCode(err);
  if (code === "status") return "لا يمكن تنفيذ هذا على المسودة في حالتها الحالية. انتظر اكتمالها أو أعد المحاولة.";
  if (code === "plan_feature") return "المساعد القانوني (أسئلة الملفات وصياغة المستندات) ليس ضمن خطتك الحالية. رقِّ الخطة لاستخدامه.";
  return workspaceErrorMessage(err);
}
