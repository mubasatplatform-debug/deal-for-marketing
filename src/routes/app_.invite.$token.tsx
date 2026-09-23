import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, LogOut, MailX, Scale } from "lucide-react";
import { DealSignIn } from "@/components/deal-sign-in";
import { OnboardingShell } from "@/components/law/onboarding-shell";
import { dateAr, officeInitial } from "@/components/law/format";
import { buttonClass } from "@/components/dash/button-class";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { ROLE_HINTS, ROLE_LABELS } from "@/lib/saas/lifecycle";
import { acceptInvite, getInvite, type InviteLookup } from "@/lib/saas/workspace";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app_/invite/$token")({
  head: () => pageHead({ title: "دعوة إلى مكتب المحامي", noindex: true }),
  component: InvitePage,
});

const ASIDE = {
  kicker: "دعوة إلى مكتب المحامي",
  title: (
    <>
      فريقك بانتظارك
      <br className="hidden lg:block" /> في مكتب واحد.
    </>
  ),
  points: [
    "ادخل أو أنشئ حسابك بالبريد الذي وصلته الدعوة.",
    "تنضم مباشرة بالصلاحية التي حددها مدير المكتب.",
    "بيانات المكتب لا يراها إلا أعضاؤه.",
  ],
};

function InvitePage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [lookup, setLookup] = useState<InviteLookup | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const userId = user?.id;
  const load = useCallback(() => {
    setFailed(false);
    getInvite({ data: { token } })
      .then(setLookup)
      .catch(() => setFailed(true));
  }, [token]);

  useEffect(() => {
    if (!isPending) load();
  }, [isPending, userId, load]);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const r = await acceptInvite({ data: { token } });
      window.location.assign(`/app?ws=${r.workspaceId}`);
    } catch (e) {
      setErr(workspaceErrorMessage(e));
      setBusy(false);
    }
  }

  const here = `/app/invite/${token}`;
  const inv = lookup?.invite;

  let body: React.ReactNode;
  if (failed) {
    body = (
      <Problem title="تعذّر فتح الدعوة" text="تحقق من الاتصال ثم أعد المحاولة.">
        <button type="button" onClick={load} className={cn(buttonClass("dark"), "mt-6 w-full")}>
          إعادة المحاولة
        </button>
      </Problem>
    );
  } else if (isPending || !lookup) {
    body = (
      <div className="grid min-h-72 place-items-center" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
        <span className="sr-only">جارٍ فتح الدعوة…</span>
      </div>
    );
  } else if (!inv) {
    body = <Problem title="رابط الدعوة غير صحيح" text="تأكد من نسخ الرابط كاملًا، أو اطلب من مدير المكتب دعوة جديدة." />;
  } else if (inv.state !== "open") {
    const text = {
      expired: "انتهت صلاحية هذه الدعوة. اطلب من مدير المكتب إعادة إرسالها.",
      used: "استُخدمت هذه الدعوة من قبل. إن كنت أنت من قبلها فادخل مكتبك مباشرة.",
      revoked: "ألغى المكتب هذه الدعوة. تواصل مع مدير المكتب إن كان ذلك خطأ.",
    }[inv.state];
    body = (
      <Problem title={`دعوة «${inv.workspaceName}»`} text={text}>
        {inv.state === "used" ? (
          <a href="/app" className={cn(buttonClass("dark"), "mt-6 w-full")}>
            الذهاب إلى مكتبي
          </a>
        ) : null}
      </Problem>
    );
  } else {
    const matches = lookup.signedInEmail?.toLowerCase() === inv.email.toLowerCase();
    body = (
      <>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-lg font-bold text-pine-deep">
            {officeInitial(inv.workspaceName) || <Scale className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate">
              {inv.inviterName ? `${inv.inviterName} يدعوك للانضمام إلى` : "دعوة للانضمام إلى"}
            </p>
            <h1 className="truncate text-xl font-extrabold tracking-tight">{inv.workspaceName}</h1>
          </div>
        </div>
        <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-slate">الصلاحية</dt>
            <dd className="font-bold">{ROLE_LABELS[inv.role]}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-slate">البريد المدعو</dt>
            <dd dir="ltr" className="truncate font-ui font-semibold">
              {inv.email}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-slate">صالحة حتى</dt>
            <dd className="font-semibold">{dateAr(inv.expiresAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-relaxed text-slate">{ROLE_HINTS[inv.role]}</p>

        <div className="mt-6">
          {!user ? (
            <>
              <p className="mb-4 text-sm font-semibold">ادخل أو أنشئ حسابك بالبريد المدعو لقبول الدعوة:</p>
              <DealSignIn callbackURL={here} initialMode="up" initialEmail={inv.email} />
            </>
          ) : matches ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void accept()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep hover:bg-[#b3bf28] disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? "جارٍ الانضمام…" : "قبول الدعوة والانضمام"}
              {!busy ? <ArrowLeft className="size-4" aria-hidden="true" /> : null}
            </button>
          ) : (
            <div className="rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed">
              <p>
                أنت داخل الآن بـ{" "}
                <span dir="ltr" className="font-ui font-semibold">
                  {lookup.signedInEmail}
                </span>
                ، والدعوة مرسلة إلى{" "}
                <span dir="ltr" className="font-ui font-semibold">
                  {inv.email}
                </span>
                . ادخل بالبريد المدعو لقبولها.
              </p>
              {authEnabled ? (
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => {
                    setLeaving(true);
                    void signOut(here).catch(() => setLeaving(false));
                  }}
                  className={cn(buttonClass("dark"), "mt-4 w-full")}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {leaving ? "جارٍ الخروج…" : "الدخول بالبريد المدعو"}
                </button>
              ) : null}
            </div>
          )}
          {err ? (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {err}
            </p>
          ) : null}
        </div>
      </>
    );
  }

  return <OnboardingShell aside={ASIDE}>{body}</OnboardingShell>;
}

function Problem({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
        <MailX className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate">{text}</p>
      {children}
    </div>
  );
}
