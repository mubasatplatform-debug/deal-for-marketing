import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Grid3x3, Loader2, Mic, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { toast } from "sonner";
import type { Call, Device } from "@twilio/voice-sdk";
import { useLawApp } from "@/components/law/app-context";
import { phoneAr } from "@/components/law/format";
import { CALLS_CHANGED, SoftphoneContext, useSoftphone, type CallTarget, type SoftphoneApi } from "@/components/law/voice/softphone-context";
import { getVoiceSetup, getVoiceToken, startCall, type VoiceSetup } from "@/lib/law/voice";
import { formatDuration, saudiPhone } from "@/lib/law/voice-options";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

/**
 * «مركز الاتصال» softphone: one floating call panel for the whole app,
 * mounted once in the app layout. `useSoftphone().call({ to, label, … })`
 * places an outbound call from the browser:
 *
 *   1. the microphone is checked first (a clear message if it is blocked);
 *   2. a short-lived Twilio token (`getVoiceToken`) while `@twilio/voice-sdk`
 *      is imported (only now, never in the main bundle); then the server
 *      records the call and signs its parameters (`startCall`);
 *   3. the SDK dials through the relay.
 *
 * The panel shows the state (جارٍ الاتصال / يرن / متصل 00:42 / انتهت), mute,
 * a keypad (DTMF) and hang-up. When the relay is not configured or the plan
 * has no calls, `ready` is false and callers fall back to `tel:` links.
 */

type Phase = "mic" | "starting" | "connecting" | "ringing" | "connected" | "ended" | "error";

type ActiveCall = {
  target: CallTarget;
  phase: Phase;
  to: string;
  recorded: boolean;
  connectedAt: number | null;
  endedAfter: number | null;
  muted: boolean;
  error: string | null;
};

const PHASE_LABELS: Record<Phase, string> = {
  mic: "جارٍ التحقق من الميكروفون…",
  starting: "جارٍ تجهيز المكالمة…",
  connecting: "جارٍ الاتصال…",
  ringing: "يرن…",
  connected: "متصل",
  ended: "انتهت المكالمة",
  error: "تعذّر الاتصال",
};

const LIVE: Phase[] = ["mic", "starting", "connecting", "ringing", "connected"];

function micError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "المتصفح يمنع الوصول إلى الميكروفون. اسمح به من رمز القفل بجوار عنوان الصفحة ثم أعد المحاولة.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "لم نعثر على ميكروفون متصل بجهازك. وصّل سماعة بميكروفون ثم أعد المحاولة.";
  }
  if (name === "NotReadableError") return "الميكروفون مستخدم في تطبيق آخر. أغلقه ثم أعد المحاولة.";
  return "تعذّر تشغيل الميكروفون. تحقق من إعدادات المتصفح ثم أعد المحاولة.";
}

function callError(err: unknown): string {
  const code = (err as { code?: number } | null)?.code;
  if (code === 31401 || code === 31402 || code === 31208) return micError({ name: "NotAllowedError" } as Error);
  if (code === 31005 || code === 31009 || code === 53000) return "انقطع الاتصال بالخادم الصوتي. تحقق من الإنترنت ثم أعد المحاولة.";
  if (code === 31486) return "الرقم مشغول حاليًا.";
  if (code === 31480) return "لم يُرد على المكالمة.";
  return "تعذّر إكمال المكالمة. حاول مرة أخرى بعد قليل.";
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const readOnly = active.lifecycle.readOnly;
  const [setup, setSetup] = useState<VoiceSetup | null>(null);
  const [cur, setCur] = useState<ActiveCall | null>(null);
  const device = useRef<Device | null>(null);
  const call = useRef<Call | null>(null);
  const curRef = useRef<ActiveCall | null>(null);
  curRef.current = cur;

  const reloadSetup = useCallback(async () => {
    try {
      setSetup(await getVoiceSetup({ data: { workspaceId: wsId } }));
    } catch {
      setSetup(null);
    }
  }, [wsId]);

  useEffect(() => {
    setSetup(null);
    void reloadSetup();
  }, [reloadSetup]);

  const teardown = useCallback(() => {
    const d = device.current;
    device.current = null;
    call.current = null;
    try {
      d?.disconnectAll();
      d?.destroy();
    } catch {
      /* already gone */
    }
  }, []);

  // Leaving the app hangs up.
  useEffect(() => teardown, [teardown]);

  const patch = useCallback((p: Partial<ActiveCall>) => setCur((c) => (c ? { ...c, ...p } : c)), []);

  const finish = useCallback(
    (p: Partial<ActiveCall>) => {
      setCur((c) => {
        if (!c || c.phase === "ended" || c.phase === "error") return c;
        const endedAfter = c.connectedAt ? Math.round((Date.now() - c.connectedAt) / 1000) : null;
        return { ...c, phase: "ended", endedAfter, muted: false, ...p };
      });
      teardown();
      window.dispatchEvent(new Event(CALLS_CHANGED));
    },
    [teardown],
  );

  const place = useCallback(
    async (target: CallTarget) => {
      const to = saudiPhone(target.to);
      if (!to) {
        toast.error("الاتصال من المنصة متاح للأرقام السعودية فقط.");
        return;
      }
      if (curRef.current && LIVE.includes(curRef.current.phase)) {
        toast.error("لديك مكالمة جارية. أنهِها أولًا.");
        return;
      }
      setCur({ target, phase: "mic", to, recorded: false, connectedAt: null, endedAfter: null, muted: false, error: null });

      // 1. The microphone, before anything is recorded or dialled.
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        patch({ phase: "error", error: micError(err) });
        return;
      }

      // 2. A token and the SDK, then the call row + signed parameters.
      patch({ phase: "starting" });
      let started: Awaited<ReturnType<typeof startCall>>;
      let token: string;
      let sdk: typeof import("@twilio/voice-sdk");
      try {
        // Token and SDK first, so a refusal there leaves no call row behind.
        const [t, m] = await Promise.all([getVoiceToken({ data: { workspaceId: wsId } }), import("@twilio/voice-sdk")]);
        token = t.token;
        sdk = m;
        started = await startCall({
          data: {
            workspaceId: wsId,
            to,
            clientId: target.clientId ?? null,
            conversationId: target.conversationId ?? null,
          },
        });
      } catch (err) {
        patch({ phase: "error", error: workspaceErrorMessage(err) });
        window.dispatchEvent(new Event(CALLS_CHANGED));
        return;
      }
      if (curRef.current?.phase !== "starting") return; // closed meanwhile
      patch({ phase: "connecting", recorded: started.rec === "1", to: started.to });

      // 3. Dial.
      try {
        const d = new sdk.Device(token, { closeProtection: "المكالمة ما زالت جارية. هل تريد مغادرة الصفحة؟", logLevel: "error" });
        device.current = d;
        d.on("error", (e: unknown) => {
          if (curRef.current && LIVE.includes(curRef.current.phase)) {
            patch({ phase: "error", error: callError(e) });
            teardown();
          }
        });
        const c = await d.connect({
          params: { To: started.to, callId: started.callId, rec: started.rec, sig: started.sig },
        });
        call.current = c;
        c.on("ringing", () => patch({ phase: "ringing" }));
        c.on("accept", () => patch({ phase: "connected", connectedAt: Date.now() }));
        c.on("disconnect", () => finish({}));
        c.on("cancel", () => finish({}));
        c.on("reject", () => finish({}));
        c.on("mute", (m: boolean) => patch({ muted: m }));
        c.on("error", (e: unknown) => {
          patch({ phase: "error", error: callError(e) });
          teardown();
          window.dispatchEvent(new Event(CALLS_CHANGED));
        });
      } catch (err) {
        patch({ phase: "error", error: callError(err) });
        teardown();
        window.dispatchEvent(new Event(CALLS_CHANGED));
      }
    },
    [wsId, patch, finish, teardown],
  );

  const hangUp = useCallback(() => {
    const c = call.current;
    if (c) c.disconnect();
    else finish({});
  }, [finish]);

  const api = useMemo<SoftphoneApi>(
    () => ({
      setup,
      ready: Boolean(setup?.configured && setup.planAllows && !readOnly),
      busy: Boolean(cur && LIVE.includes(cur.phase)),
      call: (t) => void place(t),
      reloadSetup,
    }),
    [setup, readOnly, cur, place, reloadSetup],
  );

  return (
    <SoftphoneContext.Provider value={api}>
      {children}
      {cur ? (
        <CallPanel
          cur={cur}
          onHangUp={hangUp}
          onMute={() => {
            const c = call.current;
            if (c) c.mute(!c.isMuted());
          }}
          onDigit={(d) => call.current?.sendDigits(d)}
          onClose={() => {
            teardown();
            setCur(null);
          }}
        />
      ) : null}
    </SoftphoneContext.Provider>
  );
}

/* ------------------------------------------------------------------------ */
/* The floating panel                                                        */
/* ------------------------------------------------------------------------ */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function useTicker(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

function CallPanel({
  cur,
  onHangUp,
  onMute,
  onDigit,
  onClose,
}: {
  cur: ActiveCall;
  onHangUp: () => void;
  onMute: () => void;
  onDigit: (d: string) => void;
  onClose: () => void;
}) {
  const [keypad, setKeypad] = useState(false);
  const [typed, setTyped] = useState("");
  const live = LIVE.includes(cur.phase);
  const connected = cur.phase === "connected";
  const now = useTicker(connected);
  const elapsed = connected && cur.connectedAt ? Math.max(0, Math.round((now - cur.connectedAt) / 1000)) : 0;
  const status =
    cur.phase === "connected"
      ? `متصل ${formatDuration(elapsed)}`
      : cur.phase === "ended" && cur.endedAfter !== null
        ? `انتهت · ${formatDuration(cur.endedAfter)}`
        : PHASE_LABELS[cur.phase];

  // A finished call closes itself after a few seconds; an error stays.
  useEffect(() => {
    if (cur.phase !== "ended") return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [cur.phase, onClose]);

  useEffect(() => {
    if (!connected) setKeypad(false);
  }, [connected]);

  const press = (d: string) => {
    onDigit(d);
    setTyped((t) => `${t}${d}`.slice(-16));
  };

  return (
    <section
      role="region"
      aria-label="المكالمة الجارية"
      dir="rtl"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-2xl bg-pine-deep p-4 font-dash text-snow shadow-[0_24px_64px_-12px_rgba(16,38,40,0.55)] ring-1 ring-white/10 sm:inset-x-auto sm:start-6 sm:bottom-6 sm:w-[340px]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            cur.phase === "error" ? "bg-red-500/20 text-red-200" : "bg-lime text-pine-deep",
            (cur.phase === "ringing" || cur.phase === "connecting") && "motion-safe:animate-pulse",
          )}
        >
          {live && !connected && cur.phase !== "ringing" ? <Loader2 className="size-5 animate-spin" /> : <Phone className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">
            <bdi>{cur.target.label}</bdi>
          </p>
          <p dir="ltr" className="text-end font-ui text-[12.5px] text-snow/60">
            {phoneAr(cur.to)}
          </p>
          <p role="status" aria-live="polite" className={cn("mt-1 text-[13px] font-semibold", cur.phase === "error" ? "text-red-200" : "text-lime")}>
            <span className="font-ui tabular-nums">{status}</span>
          </p>
        </div>
        {!live ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-me-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-snow/60 hover:bg-white/10 hover:text-snow"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {cur.error ? <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-[13px] leading-relaxed text-snow/85">{cur.error}</p> : null}
      {cur.recorded && live ? (
        <p className="mt-2 text-[12px] text-snow/50">هذه المكالمة مسجّلة وفق إعدادات المكتب، ويسمع الطرف الآخر تنبيهًا بذلك.</p>
      ) : null}

      {keypad && connected ? (
        <div className="mt-3">
          <p dir="ltr" aria-live="polite" className="h-6 text-center font-ui text-[15px] tracking-widest text-snow/80">
            {typed}
          </p>
          <div role="group" aria-label="لوحة الأرقام" dir="ltr" className="mt-1 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="h-11 rounded-xl bg-white/10 font-ui text-lg font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-lime"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {live ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onMute}
            disabled={!connected}
            aria-pressed={cur.muted}
            aria-label={cur.muted ? "إلغاء كتم الصوت" : "كتم الصوت"}
            className={cn(
              "grid size-12 place-items-center rounded-full transition-colors disabled:opacity-40",
              cur.muted ? "bg-snow text-pine-deep" : "bg-white/10 hover:bg-white/15",
            )}
          >
            {cur.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => setKeypad((k) => !k)}
            disabled={!connected}
            aria-pressed={keypad}
            aria-label="لوحة الأرقام"
            className={cn(
              "grid size-12 place-items-center rounded-full transition-colors disabled:opacity-40",
              keypad ? "bg-snow text-pine-deep" : "bg-white/10 hover:bg-white/15",
            )}
          >
            <Grid3x3 className="size-5" />
          </button>
          <button
            type="button"
            onClick={onHangUp}
            aria-label="إنهاء المكالمة"
            className="grid size-12 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* «اتصال» button                                                           */
/* ------------------------------------------------------------------------ */

/**
 * «اتصال»: dials from the browser when calls are available and the number is
 * Saudi; otherwise a plain `tel:` link (the device's own phone).
 */
export function CallButton({
  phone,
  label,
  clientId,
  conversationId,
  className,
  children,
}: {
  phone: string;
  label: string;
  clientId?: string | null;
  conversationId?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const sp = useSoftphone();
  const saudi = saudiPhone(phone);
  const content = children ?? (
    <>
      <Phone className="size-4 text-pine" aria-hidden="true" />
      اتصال
    </>
  );
  if (!sp.ready || !saudi) {
    return (
      <a href={`tel:${phone}`} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={sp.busy}
      onClick={() => sp.call({ to: saudi, label, clientId, conversationId })}
      title="اتصال من المتصفح"
      className={cn(className, "disabled:opacity-50")}
    >
      {content}
    </button>
  );
}
