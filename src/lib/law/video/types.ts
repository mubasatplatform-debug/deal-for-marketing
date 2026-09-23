/**
 * Video consultation provider adapter — the contract every provider meets.
 * Pure types; implementations live beside this file (livekit.ts is
 * server-only, it holds the API secret).
 *
 *   createRoom({ consultationId, startsAt, endsAt }) -> { provider, roomName, roomUrl }
 *   joinUrl(room, { role, identity, name, admitted }, { endsAt, now })
 *     -> embed (LiveKit: server URL + short-lived participant token)
 *      | link  (Jitsi / external: a URL to open in a new tab)
 */
export type ProviderId = "livekit" | "jitsi" | "external";

export type VideoRoom = {
  provider: ProviderId;
  /** Unguessable per-consultation room name (stored in law_appointments.video_room). */
  roomName: string;
  /** Where the room lives: the LiveKit server, the Jitsi URL, or the pasted link. */
  roomUrl: string;
};

export type ParticipantRole = "host" | "guest";

export type Participant = {
  role: ParticipantRole;
  /** Stable per person per consultation (a second tab replaces the first). */
  identity: string;
  /** Display name shown to the other side. */
  name: string;
  /**
   * Guests only: the lawyer already let them in. A guest who was not admitted
   * joins the waiting room (connected, but cannot publish, subscribe or chat).
   */
  admitted: boolean;
};

export type JoinWindow = {
  /** ISO end of the consultation; tokens stop working 30 minutes after it. */
  endsAt: string;
  now?: number;
};

export type JoinInfo =
  | {
      kind: "embed";
      provider: "livekit";
      serverUrl: string;
      token: string;
      /** ISO instant the token stops admitting new connections. */
      expiresAt: string;
      /** The guest starts in the waiting room. */
      lobby: boolean;
    }
  | {
      kind: "link";
      provider: "jitsi" | "external";
      url: string;
      /** Arabic note to show next to the button, when there is one. */
      note: string | null;
    };

export interface VideoProvider {
  readonly id: ProviderId;
  createRoom(input: { consultationId: string; startsAt: string; endsAt: string }): Promise<VideoRoom>;
  joinUrl(room: VideoRoom, participant: Participant, window: JoinWindow): Promise<JoinInfo>;
  /**
   * Let a waiting guest in (LiveKit only). Resolves true when the live
   * participant was updated, false when they are not connected right now (the
   * next token they get is already a full one).
   */
  admit?(room: VideoRoom, identity: string): Promise<boolean>;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Unguessable room name `<prefix>-<32 chars of [a-z0-9]>` (~165 bits) from
 * the platform CSPRNG (Web Crypto: Node 22 and browsers). Rejection sampling
 * keeps every character uniform.
 */
export function randomRoomName(prefix = "maktab"): string {
  let out = "";
  while (out.length < 32) {
    const bytes = new Uint8Array(48);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 252 && out.length < 32) out += ALPHABET[b % 36];
    }
  }
  return `${prefix}-${out}`;
}

export const ROOM_NAME_RE = /^[a-z0-9]+-[a-z0-9]{32}$/;

/** Tokens and links stop admitting people this long after the scheduled end. */
export const GRACE_AFTER_END_MIN = 30;
/** The "join" button opens this long before the start. */
export const OPEN_BEFORE_START_MIN = 10;

/** Whether now is inside the join window [start - 10 min, end + 30 min]. */
export function joinWindowState(
  startsAt: string,
  endsAt: string,
  now = Date.now(),
): "early" | "open" | "ended" {
  const start = Date.parse(startsAt) - OPEN_BEFORE_START_MIN * 60_000;
  const end = Date.parse(endsAt) + GRACE_AFTER_END_MIN * 60_000;
  if (now < start) return "early";
  if (now > end) return "ended";
  return "open";
}
