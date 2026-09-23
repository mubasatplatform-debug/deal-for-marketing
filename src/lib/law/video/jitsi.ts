import { randomRoomName, type JoinInfo, type VideoProvider, type VideoRoom } from "./types.ts";

/**
 * `jitsi` provider — the fallback when LiveKit is not configured. Rooms on the
 * public meet.jit.si service are opened in a NEW TAB (meet.jit.si limits
 * embedding); the unguessable room name is the only access control, so it is
 * never shown in lists and only reaches the lawyer and the client.
 */
export const JITSI_BASE = "https://meet.jit.si";

export function jitsiProvider(newName: () => string = () => randomRoomName()): VideoProvider {
  return {
    id: "jitsi",
    async createRoom(): Promise<VideoRoom> {
      const roomName = newName();
      return { provider: "jitsi", roomName, roomUrl: `${JITSI_BASE}/${roomName}` };
    },
    async joinUrl(room, participant): Promise<JoinInfo> {
      const name = participant.name.replace(/["\\]/g, "").slice(0, 60);
      const hash = [
        `userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}`,
        "config.prejoinConfig.enabled=true",
        `config.defaultLanguage=${encodeURIComponent('"ar"')}`,
      ].join("&");
      return {
        kind: "link",
        provider: "jitsi",
        url: `${JITSI_BASE}/${encodeURIComponent(room.roomName)}#${hash}`,
        note:
          participant.role === "host"
            ? "تفتح الغرفة في نافذة جديدة عبر Jitsi Meet. قد يُطلب منك تسجيل الدخول مرة واحدة (Google أو GitHub) لبدء الغرفة بصفتك المشرف، ثم يدخل العميل دون حساب."
            : "تفتح الاستشارة في نافذة جديدة عبر Jitsi Meet، ولا تحتاج حسابًا. إن ظهرت رسالة بانتظار المشرف فالمحامي لم يبدأ الغرفة بعد.",
      };
    },
  };
}
