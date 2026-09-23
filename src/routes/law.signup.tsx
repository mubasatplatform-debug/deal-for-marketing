import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Building2, Loader2, LogOut, PartyPopper, UserPlus } from "lucide-react";
import { DealSignIn } from "@/components/deal-sign-in";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { CITIES, TEAM_SIZE_OPTIONS, toLatinDigits } from "@/components/law/office-options";
import { OnboardingShell } from "@/components/law/onboarding-shell";
import { dateAr } from "@/components/law/format";
import { buttonClass } from "@/components/dash/button-class";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { TRIAL_DAYS } from "@/lib/saas/plans";
import { createWorkspace, getAppContext, type AppContext, type TeamSize } from "@/lib/saas/workspace";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/law/signup")({
  head: () =>
    pageHead({
      title: "ابدأ تجربتك المجانية — مكتب المحامي",
      description: `أنشئ مكتبك على «مكتب المحامي» من ديل وجرّبه ${TRIAL_DAYS} يومًا مجانًا.`,
      path: "/law/signup",
    }),
  validateSearch: (s: Record<string, unknown>): { new?: 1 } => (s.new === 1 || s.new === "1" ? { new: 1 } : {}),
  component: Signup,
});

type Phase =
  | { kind: "checking" }
  | { kind: "account" }
  | { kind: "has-office"; ctx: AppContext }
  | { kind: "office"; ctx: AppContext | null }
  | { kind: "done"; name: string };

function Signup() {
  const { new: wantNew } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  const userId = user?.id;
  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setPhase({ kind: "account" });
      return;
    }
    let live = true;
    getAppContext({ data: {} })
      .then((ctx) => {
        if (!live) return;
        setPhase(ctx.memberships.length > 0 && !wantNew ? { kind: "has-office", ctx } : { kind: "office", ctx });
      })
      .catch(() => live && setPhase({ kind: "office", ctx: null }));
    return () => {
      live = false;
    };
  }, [userId, isPending, wantNew]);

  const step = phase.kind === "account" ? 0 : phase.kind === "done" ? 2 : 1;

  return (
    <OnboardingShell step={phase.kind === "checking" || phase.kind === "has-office" ? undefined : step}>
      {phase.kind === "checking" ? (
        <div className="grid min-h-72 place-items-center" aria-busy="true">
          <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
          <span className="sr-only">جارٍ التحقق…</span>
        </div>
      ) : phase.kind === "account" ? (
        <>
          <h1 className="text-2xl font-extrabold tracking-tight">ابدأ تجربتك المجانية</h1>
          <p className="mt-1.5 mb-6 text-sm leading-relaxed text-slate">
            أنشئ حسابك أولًا، ثم نجهّز مكتبك في أقل من دقيقة. {TRIAL_DAYS} يومًا مجانًا، بلا بطاقة.
          </p>
          <DealSignIn callbackURL="/law/signup" initialMode="up" />
        </>
      ) : phase.kind === "has-office" ? (
        <HasOffice ctx={phase.ctx} />
      ) : phase.kind === "office" ? (
        <OfficeForm
          who={phase.ctx?.user.name || user?.displayName || ""}
          email={phase.ctx?.user.email || user?.primaryEmail || ""}
          onCreated={(name) => setPhase({ kind: "done", name })}
        />
      ) : (
        <Done name={phase.name} />
      )}
    </OnboardingShell>
  );
}

function HasOffice({ ctx }: { ctx: AppContext }) {
  const first = ctx.memberships[0];
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
        <Building2 className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">لديك مكتب بالفعل</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate">
        {ctx.memberships.length > 1
          ? `أنت عضو في ${ctx.memberships.length} مكاتب، منها «${first.name}».`
          : `أنت عضو في «${first.name}».`}
      </p>
      <div className="mt-6 grid gap-2">
        <a href="/app" className={cn(buttonClass("primary"), "h-12 text-[15px]")}>
          الذهاب إلى مكتبي
          <ArrowLeft className="size-4" aria-hidden="true" />
        </a>
        <a href="/law/signup?new=1" className={cn(buttonClass("secondary"), "h-12")}>
          إنشاء مكتب آخر
        </a>
      </div>
    </div>
  );
}

function OfficeForm({ who, email, onCreated }: { who: string; email: string; onCreated: (name: string) => void }) {
  const uid = useId();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [cr, setCr] = useState("");
  const [size, setSize] = useState<string>("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "city" | "cr" | "terms", string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) nameRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "اكتب اسم المكتب كما تريد أن يراه فريقك.";
    if (!city) next.city = "اختر مدينة المكتب.";
    if (cr && !/^[0-9]{10}$/.test(cr)) next.cr = "رقم السجل التجاري ١٠ أرقام.";
    if (!terms) next.terms = "وافق على شروط الاستخدام للمتابعة.";
    setErrors(next);
    setErr(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await createWorkspace({
        data: {
          name: name.trim(),
          city,
          crNumber: cr || null,
          teamSize: (size || null) as TeamSize | null,
          acceptTerms: true,
        },
      });
      onCreated(name.trim());
    } catch (error) {
      setErr(workspaceErrorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">عرّفنا بمكتبك</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate">
        {who ? `أهلًا ${who.split(/\s+/)[0]}. ` : ""}هذه البيانات تظهر لفريقك، ويمكنك تعديلها لاحقًا من الإعدادات.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-busy={busy}>
        <Field id={`${uid}-name`} label="اسم المكتب" error={errors.name}>
          <TextInput
            ref={nameRef}
            id={`${uid}-name`}
            value={name}
            maxLength={120}
            autoComplete="organization"
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مكتب العتيبي للمحاماة والاستشارات"
            invalid={Boolean(errors.name)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-city`} label="المدينة" error={errors.city}>
            <SelectInput id={`${uid}-city`} value={city} onChange={(e) => setCity(e.target.value)} invalid={Boolean(errors.city)}>
              <option value="" disabled>
                اختر المدينة
              </option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={`${uid}-size`} label="حجم الفريق" optional>
            <SelectInput id={`${uid}-size`} value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">اختر</option>
              {TEAM_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id={`${uid}-cr`} label="رقم السجل التجاري" optional error={errors.cr} hint="١٠ أرقام — يمكنك إضافته لاحقًا.">
          <TextInput
            id={`${uid}-cr`}
            inputMode="numeric"
            dir="ltr"
            maxLength={10}
            value={cr}
            onChange={(e) => setCr(toLatinDigits(e.target.value).replace(/\D/g, ""))}
            placeholder="1010xxxxxx"
            invalid={Boolean(errors.cr)}
            className="text-left font-ui"
          />
        </Field>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={Boolean(errors.terms) || undefined}
              className="mt-1 size-4 shrink-0 accent-[var(--color-pine)]"
            />
            <span>
              أوافق على{" "}
              <a href="/law/terms" target="_blank" rel="noopener" className="font-semibold text-pine underline underline-offset-4">
                شروط استخدام مكتب المحامي
              </a>
              ، وأقر بأن مكتبي مسؤول عن بيانات عملائه التي يضيفها.
            </span>
          </label>
          {errors.terms ? <p className="mt-1.5 text-[13px] text-red-700">{errors.terms}</p> : null}
        </div>

        {err ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ تجهيز مكتبك…" : `أنشئ المكتب وابدأ التجربة`}
        </button>
      </form>
      {email ? (
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-slate">
          <span>
            تسجّل باسم <span dir="ltr" className="font-ui">{email}</span>
          </span>
          {authEnabled ? (
            <button
              type="button"
              disabled={leaving}
              onClick={() => {
                setLeaving(true);
                void signOut("/law/signup").catch(() => setLeaving(false));
              }}
              className="inline-flex min-h-10 items-center gap-1 font-semibold text-pine hover:underline"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              ليس أنت؟
            </button>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

function Done({ name }: { name: string }) {
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-lime text-pine-deep">
        <PartyPopper className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">«{name}» جاهز</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate">
        بدأت تجربتك المجانية وتستمر حتى {dateAr(trialEnd)}. أدعُ فريقك الآن، أو ادخل مكتبك وتعرّف عليه.
      </p>
      <div className="mt-6 grid gap-2">
        <a href="/app" className={cn(buttonClass("primary"), "h-12 text-[15px]")}>
          ادخل مكتبك
          <ArrowLeft className="size-4" aria-hidden="true" />
        </a>
        <a href="/app/team" className={cn(buttonClass("secondary"), "h-12")}>
          <UserPlus className="size-4" aria-hidden="true" />
          ادعُ فريقك
        </a>
      </div>
    </div>
  );
}
