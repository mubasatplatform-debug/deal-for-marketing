import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Camera, CameraOff, Mic, MicOff, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pre-join camera / microphone check — plain getUserMedia, no call SDK, so
 * it works (and explains itself) before any video provider loads. Used by
 * the client's /meet page and the lawyer's call page.
 */
export type DeviceChoices = {
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoDeviceId: string | undefined;
  audioDeviceId: string | undefined;
};

type Problem = "denied" | "missing" | "busy" | "insecure" | "policy" | "unsupported" | "other";

const PROBLEM_TEXT: Record<Problem, { title: string; body: string }> = {
  denied: {
    title: "لم يُسمح بالكاميرا أو الميكروفون",
    body: "اضغط أيقونة القفل بجوار عنوان الصفحة في المتصفح، واسمح بالكاميرا والميكروفون، ثم أعد المحاولة.",
  },
  missing: {
    title: "لم نجد كاميرا أو ميكروفونًا",
    body: "تأكد من توصيل السماعة أو الكاميرا. يمكنك الدخول بالصوت فقط أو دون كاميرا.",
  },
  busy: {
    title: "الكاميرا مستخدمة في تطبيق آخر",
    body: "أغلق التطبيقات الأخرى التي تستخدم الكاميرا (Zoom، Teams…) ثم أعد المحاولة.",
  },
  insecure: {
    title: "الصفحة تحتاج اتصالًا آمنًا",
    body: "افتح الرابط كما وصلك (يبدأ بـ https) ليعمل الفيديو.",
  },
  policy: {
    title: "المتصفح منع الكاميرا في هذه الصفحة",
    body: "أعد تحميل الصفحة. إن استمرت المشكلة افتح الرابط في نافذة مستقلة.",
  },
  unsupported: {
    title: "المتصفح لا يدعم مكالمات الفيديو",
    body: "استخدم أحدث إصدار من Chrome أو Safari أو Edge أو Firefox.",
  },
  other: {
    title: "تعذّر تشغيل الكاميرا أو الميكروفون",
    body: "أعد المحاولة. يمكنك أيضًا الدخول مع إيقاف الكاميرا.",
  },
};

function classify(err: unknown): Problem {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return policyBlocked() ? "policy" : "denied";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "other";
}

/** Whether this document's Permissions-Policy forbids the camera. */
export function policyBlocked(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature: (f: string) => boolean };
    featurePolicy?: { allowsFeature: (f: string) => boolean };
  };
  const p = doc.permissionsPolicy ?? doc.featurePolicy;
  try {
    return p ? !p.allowsFeature("camera") || !p.allowsFeature("microphone") : false;
  } catch {
    return false;
  }
}

export function PreJoin({
  onJoin,
  joinLabel,
  joinDisabled,
  joinHint,
  children,
}: {
  onJoin: (choices: DeviceChoices) => void;
  joinLabel: ReactNode;
  joinDisabled?: boolean;
  joinHint?: ReactNode;
  children?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  // What the person picked (drives getUserMedia) and what the browser chose by default.
  const [camId, setCamId] = useState<string | undefined>();
  const [micId, setMicId] = useState<string | undefined>();
  const [autoCam, setAutoCam] = useState<string | undefined>();
  const [autoMic, setAutoMic] = useState<string | undefined>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [starting, setStarting] = useState(true);
  const [level, setLevel] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let ctx: AudioContext | null = null;
    async function start() {
      setStarting(true);
      stop();
      if (!window.isSecureContext) {
        setProblem("insecure");
        setStarting(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("unsupported");
        setStarting(false);
        return;
      }
      if (!videoOn && !audioOn) {
        setProblem(null);
        setStarting(false);
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: videoOn ? { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: audioOn ? { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true } : false,
        });
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        setProblem(null);
        if (video.current) video.current.srcObject = videoOn ? s : null;
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!alive) return;
        setCams(devices.filter((d) => d.kind === "videoinput" && d.deviceId));
        setMics(devices.filter((d) => d.kind === "audioinput" && d.deviceId));
        const vt = s.getVideoTracks()[0];
        const at = s.getAudioTracks()[0];
        if (vt) setAutoCam(vt.getSettings().deviceId);
        if (at) setAutoMic(at.getSettings().deviceId);
        if (at) {
          const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AC) {
            ctx = new AC();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            ctx.createMediaStreamSource(new MediaStream([at])).connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteFrequencyData(data);
              let sum = 0;
              for (const v of data) sum += v;
              setLevel(Math.min(1, sum / data.length / 70));
              raf = requestAnimationFrame(tick);
            };
            tick();
          }
        }
      } catch (err) {
        if (alive) setProblem(classify(err));
      } finally {
        if (alive) setStarting(false);
      }
    }
    void start();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => {});
      stop();
    };
  }, [videoOn, audioOn, camId, micId, attempt, stop]);

  const p = problem ? PROBLEM_TEXT[problem] : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-pine-deep ring-1 ring-pine/20">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className={cn("h-full w-full -scale-x-100 object-cover", (!videoOn || problem) && "invisible")}
          />
          {!videoOn || problem ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-snow">
              {p ? (
                <div className="max-w-sm">
                  <AlertTriangle className="mx-auto size-8 text-lime" aria-hidden="true" />
                  <p className="mt-3 font-bold">{p.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-snow/75">{p.body}</p>
                  <button
                    type="button"
                    onClick={() => (problem === "policy" ? window.location.reload() : setAttempt((n) => n + 1))}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15"
                  >
                    <RotateCw className="size-4" aria-hidden="true" />
                    {problem === "policy" ? "إعادة تحميل الصفحة" : "إعادة المحاولة"}
                  </button>
                </div>
              ) : (
                <div>
                  <CameraOff className="mx-auto size-8 text-snow/60" aria-hidden="true" />
                  <p className="mt-2 text-sm text-snow/70">الكاميرا متوقفة</p>
                </div>
              )}
            </div>
          ) : null}
          {starting ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-snow/70">جارٍ تشغيل الكاميرا…</div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/50 to-transparent p-4">
            <RoundToggle on={audioOn} onClick={() => setAudioOn((v) => !v)} label={audioOn ? "كتم الميكروفون" : "تشغيل الميكروفون"}>
              {audioOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
            </RoundToggle>
            <RoundToggle on={videoOn} onClick={() => setVideoOn((v) => !v)} label={videoOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}>
              {videoOn ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
            </RoundToggle>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        {children}
        <div className="space-y-3">
          <DeviceSelect label="الكاميرا" value={camId ?? autoCam} devices={cams} disabled={!videoOn} onChange={setCamId} />
          <DeviceSelect label="الميكروفون" value={micId ?? autoMic} devices={mics} disabled={!audioOn} onChange={setMicId} />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-pine-deep">مستوى الصوت</p>
            <div className="flex h-2.5 gap-1" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className={cn("flex-1 rounded-full transition-colors", audioOn && level * 12 > i ? "bg-lime-600" : "bg-pine-50")}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-slate">تكلم قليلًا لتتأكد أن الميكروفون يلتقط صوتك.</p>
          </div>
        </div>
        <button
          type="button"
          disabled={joinDisabled}
          onClick={() => {
            stop();
            onJoin({
              videoEnabled: videoOn && !problem,
              audioEnabled: audioOn && !problem,
              videoDeviceId: camId ?? autoCam,
              audioDeviceId: micId ?? autoMic,
            });
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] disabled:cursor-not-allowed disabled:bg-pine-50 disabled:text-slate"
        >
          {joinLabel}
        </button>
        {joinHint ? <div className="text-center text-[13px] text-slate">{joinHint}</div> : null}
      </div>
    </div>
  );
}

function RoundToggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-12 place-items-center rounded-full transition-colors",
        on ? "bg-white/15 text-snow hover:bg-white/25" : "bg-red-600 text-snow hover:bg-red-700",
      )}
    >
      {children}
    </button>
  );
}

function DeviceSelect({
  label,
  value,
  devices,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  devices: MediaDeviceInfo[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-pine-deep">{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled || devices.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full cursor-pointer rounded-xl border border-line-strong bg-surface px-3 text-[13px] text-pine-deep outline-none focus:border-pine focus:ring-4 focus:ring-pine/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-slate"
      >
        {devices.length === 0 ? <option value="">الجهاز الافتراضي</option> : null}
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
