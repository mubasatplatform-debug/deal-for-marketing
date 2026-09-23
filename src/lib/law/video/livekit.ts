import { AccessToken, RoomServiceClient, type VideoGrant } from "livekit-server-sdk";
import {
  GRACE_AFTER_END_MIN,
  randomRoomName,
  type JoinInfo,
  type Participant,
  type VideoProvider,
  type VideoRoom,
} from "./types.ts";

/**
 * `livekit` provider — **server-only** (holds the API secret). The primary
 * provider whenever LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are
 * set. The call is fully embedded in our own pages (livekit-client +
 * @livekit/components-react, see src/components/law/call/*).
 *
 * - Rooms are created implicitly on first join; the unguessable per-
 *   consultation name is the room. No network call is needed to mint tokens.
 * - Tokens are short-lived: valid until the scheduled end + 30 minutes.
 * - Waiting room: a guest who was not admitted gets a token that can join
 *   but NOT publish, subscribe or send data. The lawyer sees them waiting and
 *   admits them; the server then (1) records the admission, so any later
 *   token is a full one, and (2) upgrades the live participant through the
 *   RoomService `UpdateParticipant` API.
 *
 * Recording (Egress) — TODO, deliberately not implemented: recording legal
 * consultations needs explicit client consent, a retention policy and a
 * storage target. The hook would be EgressClient.startRoomCompositeEgress
 * after both sides consent, stopped on leave.
 */
export type LiveKitConfig = { url: string; apiKey: string; apiSecret: string };

export function liveKitConfig(env: Record<string, string | undefined>): LiveKitConfig | null {
  const url = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  if (!/^wss?:\/\/[^\s/]+/i.test(url) && !/^https?:\/\/[^\s/]+/i.test(url)) return null;
  return { url: url.replace(/\/+$/, ""), apiKey, apiSecret };
}

/** The websocket URL the browser connects to. */
export function wsUrl(url: string): string {
  return url.replace(/^http(s?):\/\//i, "ws$1://");
}

/** The HTTPS origin of the server API. */
export function httpUrl(url: string): string {
  return url.replace(/^ws(s?):\/\//i, "http$1://");
}

export const LOBBY_GRANT = { canPublish: false, canSubscribe: false, canPublishData: false } as const;
export const FULL_GRANT = { canPublish: true, canSubscribe: true, canPublishData: true } as const;

/** The video grant for a participant — exported for the unit tests. */
export function grantFor(roomName: string, p: Participant): VideoGrant {
  const base: VideoGrant = { room: roomName, roomJoin: true, canUpdateOwnMetadata: false };
  if (p.role === "host") return { ...base, ...FULL_GRANT, roomAdmin: true };
  return { ...base, ...(p.admitted ? FULL_GRANT : LOBBY_GRANT) };
}

/** Token lifetime in seconds: until end + 30 min, at least 5 minutes. */
export function ttlSeconds(endsAt: string, now = Date.now()): number {
  const until = Date.parse(endsAt) + GRACE_AFTER_END_MIN * 60_000;
  return Math.max(300, Math.ceil((until - now) / 1000));
}

export function liveKitProvider(
  cfg: LiveKitConfig,
  opts: { newName?: () => string } = {},
): VideoProvider {
  const newName = opts.newName ?? (() => randomRoomName());
  return {
    id: "livekit",
    async createRoom(): Promise<VideoRoom> {
      return { provider: "livekit", roomName: newName(), roomUrl: wsUrl(cfg.url) };
    },
    async joinUrl(room, participant, window): Promise<JoinInfo> {
      const now = window.now ?? Date.now();
      const ttl = ttlSeconds(window.endsAt, now);
      const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
        identity: participant.identity,
        name: participant.name.slice(0, 80),
        ttl,
        attributes: { role: participant.role },
      });
      at.addGrant(grantFor(room.roomName, participant));
      return {
        kind: "embed",
        provider: "livekit",
        serverUrl: wsUrl(cfg.url),
        token: await at.toJwt(),
        expiresAt: new Date(now + ttl * 1000).toISOString(),
        lobby: participant.role === "guest" && !participant.admitted,
      };
    },
    async admit(room, identity): Promise<boolean> {
      const svc = new RoomServiceClient(httpUrl(cfg.url), cfg.apiKey, cfg.apiSecret, { failover: false });
      try {
        await svc.updateParticipant(room.roomName, identity, { permission: { ...FULL_GRANT } });
        return true;
      } catch (err) {
        // Not connected right now (404 / not_found): their next token is a full one.
        const status = (err as { status?: number }).status;
        const code = (err as { code?: string }).code;
        if (status === 404 || code === "not_found") return false;
        throw err;
      }
    },
  };
}
