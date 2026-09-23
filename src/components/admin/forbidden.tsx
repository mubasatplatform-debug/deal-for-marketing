import { LockKeyhole } from "lucide-react";
import { DealWordmark } from "@/components/logo";
import { buttonClass } from "@/components/dash/button-class";
import { Card } from "@/components/dash/ui";

/** Shown to signed-in accounts that are not on the DEAL team. */
export function AdminForbidden({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut?: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4 py-16 font-dash text-pine-deep">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <div className="w-full max-w-[420px]">
        <a href="/" aria-label="ديل — الموقع" className="mx-auto mb-8 flex w-fit text-pine">
          <DealWordmark className="h-7 w-auto" />
        </a>
        <Card className="px-6 py-8 text-center md:px-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-5 text-xl font-extrabold">هذه اللوحة لفريق ديل فقط</h1>
          <p className="mt-2 text-sm leading-6 text-slate">
            الحساب الذي دخلت به ليس ضمن فريق ديل. إن كنت من الفريق، ادخل بحساب Google المعتمد.
          </p>
          {email ? (
            <p
              className="mt-4 inline-flex max-w-full rounded-lg bg-paper px-3 py-1.5 font-ui text-xs text-slate"
              dir="ltr"
            >
              <span className="truncate">{email}</span>
            </p>
          ) : null}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a href="/client" className={buttonClass("dark")}>
              الذهاب إلى مشاريعي
            </a>
            {onSignOut ? (
              <button type="button" onClick={onSignOut} className={buttonClass("secondary")}>
                الدخول بحساب آخر
              </button>
            ) : (
              <a href="/" className={buttonClass("secondary")}>
                الصفحة الرئيسية
              </a>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
