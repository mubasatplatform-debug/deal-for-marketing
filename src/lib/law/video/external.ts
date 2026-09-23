import type { JoinInfo, VideoProvider, VideoRoom } from "./types.ts";

/**
 * `external` provider: the lawyer pastes their own Zoom / Google Meet / Teams
 * (or Webex / Jitsi) link on a consultation. Pure — the allow-list check runs
 * in the browser for instant feedback and again on the server.
 */
const ALLOWED_HOSTS: readonly (string | RegExp)[] = [
  "zoom.us",
  /^[a-z0-9-]+\.zoom\.us$/,
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  /^[a-z0-9-]+\.webex\.com$/,
  "meet.jit.si",
];

export const EXTERNAL_HOSTS_LABEL = "Zoom، Google Meet، Microsoft Teams، Webex، Jitsi";

/** A normalized https link on an allowed host, or null. */
export function validateExternalUrl(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > 500) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const ok = ALLOWED_HOSTS.some((h) => (typeof h === "string" ? h === host : h.test(host)));
  if (!ok) return null;
  return url.toString();
}

export function externalProvider(url: string): VideoProvider {
  return {
    id: "external",
    async createRoom(): Promise<VideoRoom> {
      return { provider: "external", roomName: "external", roomUrl: url };
    },
    async joinUrl(room): Promise<JoinInfo> {
      return {
        kind: "link",
        provider: "external",
        url: room.roomUrl,
        note: "تُعقد هذه الاستشارة عبر رابط خارجي أضافه المكتب، وتفتح في نافذة جديدة.",
      };
    },
  };
}
