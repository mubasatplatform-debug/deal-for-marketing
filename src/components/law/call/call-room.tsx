import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useChat,
  useConnectionQualityIndicator,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useMediaDeviceSelect,
  useParticipantPermissions,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTrackToggle,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  Track,
  type Participant,
  type RemoteParticipant,
} from "livekit-client";
import {
  Camera,
  CameraOff,
  Hourglass,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Settings2,
  ShieldCheck,
  SignalHigh,
  SignalLow,
  SignalMedium,
  UserCheck,
  Volume2,
  X,
} from "lucide-react";
import type { DeviceChoices } from "./prejoin";
import { cn } from "@/lib/utils";

/**
 * The embedded LiveKit call — «مكتب المحامي» brand, Arabic, RTL. Lazy-loaded
 * (only the call pages import it), so livekit-client never weighs on other
 * pages.
 *
 * Waiting room: a guest whose token cannot publish/subscribe sees a waiting
 * screen; the host sees them as "في الانتظار" with an «اسمح بالدخول» button
 * (`onAdmit` asks the server, which upgrades the participant). The guest's
 * screen switches to the call by itself when the new permissions arrive.
 */
export type CallRoomProps = {
  serverUrl: string;
  token: string;
  role: "host" | "guest";
  choices: DeviceChoices;
  title: string;
  subtitle?: string;
  /** Host only: let the waiting client in. */
  onAdmit?: (identity: string) => Promise<void>;
  onLeave: (reason: "left" | "ended" | "error", detail?: string) => void;
};

export default function CallRoom(props: CallRoomProps) {
  const { choices } = props;
  const lobby = props.role === "guest";
  const options = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : undefined,
      audioCaptureDefaults: choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : undefined,
    }),
    [choices.videoDeviceId, choices.audioDeviceId],
  );
  // LiveKitRoom reconnects when its callbacks change identity, so they must be
  // stable across parent re-renders (a new arrow each render = a reconnect).
  const leaveRef = useRef(props.onLeave);
  leaveRef.current = props.onLeave;
  const onDisconnected = useCallback(
    (reason?: DisconnectReason) =>
      leaveRef.current(reason === DisconnectReason.CLIENT_INITIATED ? "left" : "ended", reason ? String(reason) : undefined),
    [],
  );
  const onError = useCallback((err: Error) => leaveRef.current("error", err.message), []);
  return (
    <LiveKitRoom
      serverUrl={props.serverUrl}
      token={props.token}
      connect
      // A guest may still be waiting: publishing starts once permitted (see GuestGate).
      audio={lobby ? false : choices.audioEnabled}
      video={lobby ? false : choices.videoEnabled}
      options={options}
      onDisconnected={onDisconnected}
      onError={onError}
      className="flex h-dvh flex-col bg-[#0b1f21] text-snow"
      data-lk-theme="none"
    >
      <Stage {...props} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function Stage(props: CallRoomProps) {
  const state = useConnectionState();
  const perms = useLocalParticipantPermissions();
  // A guest is in the call only once the server says they may subscribe.
  const waiting = props.role === "guest" && perms?.canSubscribe !== true;
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  if (state !== ConnectionState.Connected && state !== ConnectionState.Reconnecting && state !== ConnectionState.SignalReconnecting) {
    return <Centered icon={<Loader2 className="size-8 animate-spin text-lime" />} title="جارٍ الاتصال بالغرفة…" />;
  }
  if (perms === undefined) {
    return <Centered icon={<Loader2 className="size-8 animate-spin text-lime" />} title="جارٍ الاتصال بالغرفة…" />;
  }
  if (waiting) {
    return (
      <>
        <TopBar {...props} />
        <Centered
          icon={
            <span className="grid size-16 place-items-center rounded-full bg-lime/15 text-lime motion-safe:animate-pulse">
              <Hourglass className="size-7" />
            </span>
          }
          title="أنت في غرفة الانتظار"
          body="أبلغنا المحامي بوصولك، وسيسمح لك بالدخول خلال لحظات. أبقِ هذه الصفحة مفتوحة."
        >
          <LeaveButton label="إلغاء الانتظار والخروج" />
        </Centered>
      </>
    );
  }
  return (
    <>
      <TopBar {...props} />
      {props.role === "guest" ? <GuestGate choices={props.choices} /> : null}
      {props.role === "host" && props.onAdmit ? <WaitingBanner onAdmit={props.onAdmit} /> : null}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-2 sm:p-3">
          <Tiles />
        </div>
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onUnread={() => setUnread((n) => (chatOpen ? 0 : n + 1))}
        />
      </div>
      <Controls
        chatOpen={chatOpen}
        unread={unread}
        onChat={() => {
          setChatOpen((v) => !v);
          setUnread(0);
        }}
      />
      <StartAudioPrompt />
    </>
  );
}

/** Once the lawyer admits the guest, publish what they chose in the pre-join check. */
function GuestGate({ choices }: { choices: DeviceChoices }) {
  const { localParticipant } = useLocalParticipant();
  const perms = useLocalParticipantPermissions();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !perms?.canPublish) return;
    done.current = true;
    if (choices.audioEnabled) {
      void localParticipant.setMicrophoneEnabled(true, choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : undefined).catch(() => {});
    }
    if (choices.videoEnabled) {
      void localParticipant.setCameraEnabled(true, choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : undefined).catch(() => {});
    }
  }, [localParticipant, choices, perms?.canPublish]);
  return null;
}

function TopBar({ title, subtitle }: CallRoomProps) {
  // A guest still in the waiting room is not in the call yet.
  const participants = useParticipants().filter((p) => p.isLocal || p.permissions?.canSubscribe !== false);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] px-3 sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime text-pine-deep">
        <ShieldCheck className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        {subtitle ? <p className="truncate text-[11px] text-snow/55">{subtitle}</p> : null}
      </div>
      <span className="hidden items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-snow/70 sm:inline-flex">
        <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
        <span className="font-ui tabular-nums">{participants.length}</span> في الغرفة
      </span>
      <ElapsedClock />
    </header>
  );
}

function ElapsedClock() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((now - start) / 1000);
  return (
    <span className="font-ui text-xs text-snow/60 tabular-nums" aria-label="مدة المكالمة">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** Host: guests who joined but may not publish yet (the waiting room). */
function WaitingBanner({ onAdmit }: { onAdmit: (identity: string) => Promise<void> }) {
  const participants = useParticipants();
  const waiting = participants.filter(
    (p): p is RemoteParticipant => !p.isLocal && p.identity.startsWith("client:") && p.permissions?.canSubscribe === false,
  );
  if (waiting.length === 0) return null;
  return (
    <div className="border-b border-lime/20 bg-lime/10 px-3 py-2.5 sm:px-5" role="status">
      {waiting.map((p) => (
        <WaitingRow key={p.identity} p={p} onAdmit={onAdmit} />
      ))}
    </div>
  );
}

function WaitingRow({ p, onAdmit }: { p: RemoteParticipant; onAdmit: (identity: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const perms = useParticipantPermissions({ participant: p });
  if (perms?.canSubscribe) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-lime text-pine-deep">
        <Hourglass className="size-4" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <strong className="font-bold">{p.name || "العميل"}</strong> في الانتظار
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onAdmit(p.identity);
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-pine-deep hover:bg-[#b3bf28] disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
        اسمح بالدخول
      </button>
    </div>
  );
}

function Tiles() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  // Waiting guests are not part of the call yet.
  const visible = tracks.filter((t) => t.participant.isLocal || t.participant.permissions?.canSubscribe !== false);
  const guestWaiting = useParticipants().some(
    (p) => !p.isLocal && p.identity.startsWith("client:") && p.permissions?.canSubscribe === false,
  );
  const share = visible.find((t) => t.source === Track.Source.ScreenShare && isTrackReference(t));
  const cams = visible.filter((t) => t.source === Track.Source.Camera);
  const local = cams.find((t) => t.participant.isLocal);
  const remote = cams.filter((t) => !t.participant.isLocal);

  if (share) {
    return (
      <div className="flex h-full flex-col gap-2 lg:flex-row">
        <div className="min-h-0 flex-1">
          <Tile trackRef={share} contain />
        </div>
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-60 lg:flex-col lg:overflow-y-auto">
          {cams.map((t) => (
            <div key={`${t.participant.identity}-cam`} className="aspect-video w-40 shrink-0 lg:w-full">
              <Tile trackRef={t} small />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (remote.length === 0) {
    return (
      <div className="relative h-full">
        {local ? <Tile trackRef={local} /> : null}
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <span className="rounded-full bg-black/45 px-4 py-2 text-sm backdrop-blur">
            {guestWaiting ? "العميل في غرفة الانتظار — اسمح له بالدخول من الشريط أعلاه" : "بانتظار انضمام الطرف الآخر…"}
          </span>
        </div>
      </div>
    );
  }
  if (remote.length === 1 && local) {
    // One-to-one consultation: the other side fills the stage, you in a corner.
    return (
      <div className="relative h-full">
        <Tile trackRef={remote[0]} />
        <div className="absolute end-3 bottom-3 aspect-video w-32 overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/15 sm:w-56">
          <Tile trackRef={local} small />
        </div>
      </div>
    );
  }
  const n = cams.length;
  return (
    <div className={cn("grid h-full gap-2", n <= 2 ? "grid-rows-2 sm:grid-cols-2 sm:grid-rows-1" : "grid-cols-2", n > 4 && "lg:grid-cols-3")}>
      {cams.map((t) => (
        <Tile key={`${t.participant.identity}-cam`} trackRef={t} />
      ))}
    </div>
  );
}

function Tile({ trackRef, small, contain }: { trackRef: TrackReferenceOrPlaceholder; small?: boolean; contain?: boolean }) {
  const p = trackRef.participant;
  const speaking = useIsSpeaking(p);
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const micPub = p.getTrackPublication(Track.Source.Microphone);
  const micRef: TrackReferenceOrPlaceholder = micPub
    ? { participant: p, source: Track.Source.Microphone, publication: micPub }
    : { participant: p, source: Track.Source.Microphone };
  const micMuted = useIsMuted(micRef);
  const name = p.isLocal ? "أنت" : p.name || "مشارك";
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl bg-[#12302f] transition-shadow",
        speaking && "ring-2 ring-lime",
      )}
    >
      {hasVideo && isTrackReference(trackRef) ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "h-full w-full",
            contain ? "object-contain" : "object-cover",
            p.isLocal && trackRef.source === Track.Source.Camera && "-scale-x-100",
          )}
        />
      ) : (
        <div className="grid h-full place-items-center">
          <span className={cn("grid place-items-center rounded-full bg-lime font-bold text-pine-deep", small ? "size-12 text-lg" : "size-24 text-3xl")}>
            {initials(p.name || name)}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2">
        {micMuted ? <MicOff className="size-3.5 shrink-0 text-red-400" aria-label="الميكروفون مكتوم" /> : null}
        <span className={cn("truncate font-semibold", small ? "text-[11px]" : "text-[13px]")}>
          {trackRef.source === Track.Source.ScreenShare ? `شاشة ${name}` : name}
        </span>
        <Quality participant={p} />
      </div>
    </div>
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "؟"
  );
}

function Quality({ participant }: { participant: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });
  const label =
    quality === ConnectionQuality.Excellent
      ? "اتصال ممتاز"
      : quality === ConnectionQuality.Good
        ? "اتصال جيد"
        : quality === ConnectionQuality.Poor
          ? "اتصال ضعيف"
          : quality === ConnectionQuality.Lost
            ? "انقطع الاتصال"
            : "";
  if (!label) return null;
  const Icon = quality === ConnectionQuality.Excellent ? SignalHigh : quality === ConnectionQuality.Good ? SignalMedium : SignalLow;
  return (
    <Icon
      className={cn(
        "ms-auto size-4 shrink-0",
        quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good ? "text-lime" : "text-amber-400",
      )}
      aria-label={label}
    />
  );
}

function Controls({ chatOpen, unread, onChat }: { chatOpen: boolean; unread: number; onChat: () => void }) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare, captureOptions: { audio: false } });
  const [devicesOpen, setDevicesOpen] = useState(false);
  const canShare = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
  return (
    <footer className="relative flex shrink-0 items-center justify-center gap-2 border-t border-white/[0.07] px-3 py-3 sm:gap-3">
      <CtrlButton on={mic.enabled} busy={mic.pending} onClick={() => void mic.toggle()} label={mic.enabled ? "كتم الميكروفون" : "تشغيل الميكروفون"}>
        {mic.enabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </CtrlButton>
      <CtrlButton on={cam.enabled} busy={cam.pending} onClick={() => void cam.toggle()} label={cam.enabled ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}>
        {cam.enabled ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
      </CtrlButton>
      {canShare ? (
        <CtrlButton
          on
          active={screen.enabled}
          busy={screen.pending}
          onClick={() => void screen.toggle()}
          label={screen.enabled ? "إيقاف مشاركة الشاشة" : "مشاركة الشاشة"}
          className="hidden sm:grid"
        >
          <MonitorUp className="size-5" />
        </CtrlButton>
      ) : null}
      <CtrlButton on active={chatOpen} onClick={onChat} label="المحادثة">
        <MessageSquare className="size-5" />
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 grid size-5 place-items-center rounded-full bg-lime font-ui text-[11px] font-bold text-pine-deep">
            {unread}
          </span>
        ) : null}
      </CtrlButton>
      <CtrlButton on active={devicesOpen} onClick={() => setDevicesOpen((v) => !v)} label="الأجهزة">
        <Settings2 className="size-5" />
      </CtrlButton>
      <LeaveButton />
      {devicesOpen ? <DevicesPopover onClose={() => setDevicesOpen(false)} /> : null}
    </footer>
  );
}

function CtrlButton({
  on,
  active,
  busy,
  onClick,
  label,
  className,
  children,
}: {
  on: boolean;
  active?: boolean;
  busy?: boolean;
  onClick: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? on}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "relative grid size-12 place-items-center rounded-full transition-colors disabled:opacity-60",
        !on ? "bg-red-600 text-snow hover:bg-red-700" : active ? "bg-lime text-pine-deep" : "bg-white/10 text-snow hover:bg-white/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

function LeaveButton({ label }: { label?: string } = {}) {
  const room = useRoomContext();
  return (
    <button
      type="button"
      onClick={() => void room.disconnect()}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-snow hover:bg-red-700"
    >
      <PhoneOff className="size-5" aria-hidden="true" />
      {label ? (
        <span>{label}</span>
      ) : (
        <>
          <span className="hidden sm:inline">مغادرة</span>
          <span className="sr-only sm:hidden">مغادرة المكالمة</span>
        </>
      )}
    </button>
  );
}

function DevicesPopover({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="اختيار الأجهزة"
      className="absolute bottom-full start-1/2 z-30 mb-3 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl bg-surface p-4 text-pine-deep shadow-2xl ring-1 ring-line rtl:translate-x-1/2"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">الأجهزة</p>
        <button type="button" aria-label="إغلاق" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-paper">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3">
        <DevicePick kind="videoinput" label="الكاميرا" />
        <DevicePick kind="audioinput" label="الميكروفون" />
        <DevicePick kind="audiooutput" label="السماعة" />
      </div>
    </div>
  );
}

function DevicePick({ kind, label }: { kind: MediaDeviceKind; label: string }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  if (devices.length === 0) return null;
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-slate">{label}</span>
      <select
        value={activeDeviceId}
        onChange={(e) => void setActiveMediaDevice(e.target.value)}
        className="h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[13px] outline-none focus:border-pine"
      >
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChatPanel({ open, onClose, onUnread }: { open: boolean; onClose: () => void; onUnread: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (chatMessages.length > seen.current) {
      const fresh = chatMessages.slice(seen.current).filter((m) => !m.from?.isLocal).length;
      seen.current = chatMessages.length;
      if (fresh && !open) onUnread();
    }
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chatMessages, open, onUnread]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await send(t).catch(() => setText(t));
  }
  if (!open) return null;
  return (
    <aside
      aria-label="المحادثة"
      className="absolute inset-0 z-20 flex flex-col bg-[#0f2a2b] sm:static sm:w-80 sm:border-s sm:border-white/[0.07]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <p className="text-sm font-bold">المحادثة</p>
        <button type="button" aria-label="إغلاق المحادثة" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-white/10">
          <X className="size-4" />
        </button>
      </div>
      <ol ref={list} className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <li className="text-center text-[13px] text-snow/50">الرسائل هنا تصل للجميع في المكالمة ولا تُحفظ بعد انتهائها.</li>
        ) : (
          chatMessages.map((m) => {
            const mine = Boolean(m.from?.isLocal);
            return (
              <li key={m.id} className={cn("flex flex-col", mine ? "items-start" : "items-end")}>
                <span className="mb-0.5 text-[11px] text-snow/50">{mine ? "أنت" : m.from?.name || "مشارك"}</span>
                <span
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                    mine ? "bg-lime text-pine-deep" : "bg-white/10",
                  )}
                >
                  {m.message}
                </span>
              </li>
            );
          })
        )}
      </ol>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/[0.07] p-3">
        <label htmlFor="call-chat" className="sr-only">
          رسالة
        </label>
        <input
          id="call-chat"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة…"
          className="h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm text-snow outline-none placeholder:text-snow/40 focus:ring-2 focus:ring-lime/60"
        />
        <button
          type="submit"
          aria-label="إرسال"
          disabled={isSending || !text.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-pine-deep disabled:opacity-50"
        >
          <Send className="size-4 rtl:-scale-x-100" />
        </button>
      </form>
    </aside>
  );
}

function StartAudioPrompt() {
  const room = useRoomContext();
  const { mergedProps } = useStartAudio({ room, props: {} });
  if (mergedProps.style?.display === "none") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center">
      <button
        type="button"
        onClick={mergedProps.onClick}
        className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-bold text-pine-deep shadow-2xl"
      >
        <Volume2 className="size-4" aria-hidden="true" />
        اضغط لتشغيل الصوت
      </button>
    </div>
  );
}

function Centered({ icon, title, body, children }: { icon: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid place-items-center">{icon}</div>
        <p className="mt-5 text-xl font-extrabold">{title}</p>
        {body ? <p className="mt-2 text-[15px] leading-relaxed text-snow/70">{body}</p> : null}
        {children ? <div className="mt-6 flex justify-center">{children}</div> : null}
      </div>
    </div>
  );
}
