import { externalProvider } from "./external.ts";
import { jitsiProvider } from "./jitsi.ts";
import { liveKitConfig, liveKitProvider } from "./livekit.ts";
import type { ProviderId, VideoProvider, VideoRoom } from "./types.ts";

/**
 * Provider selection — **server-only** (livekit.ts holds the secret).
 *
 *   external link on the consultation  -> `external` (the lawyer's choice wins)
 *   LIVEKIT_URL + _API_KEY + _API_SECRET -> `livekit` (embedded, waiting room)
 *   otherwise                            -> `jitsi` (meet.jit.si, new tab)
 *
 * The room name stored on the row is provider-neutral, so adding LiveKit keys
 * later upgrades existing video consultations without touching them.
 */
export function activeProviderId(env: Record<string, string | undefined> = process.env): "livekit" | "jitsi" {
  return liveKitConfig(env) ? "livekit" : "jitsi";
}

export function providerById(
  id: ProviderId,
  env: Record<string, string | undefined> = process.env,
  externalUrl?: string | null,
): VideoProvider {
  if (id === "external") {
    if (!externalUrl) throw new Error("external provider needs a URL");
    return externalProvider(externalUrl);
  }
  if (id === "livekit") {
    const cfg = liveKitConfig(env);
    if (!cfg) throw new Error("LiveKit is not configured");
    return liveKitProvider(cfg);
  }
  return jitsiProvider();
}

/** The provider a consultation uses right now. */
export function providerFor(
  row: { external_url: string | null },
  env: Record<string, string | undefined> = process.env,
): VideoProvider {
  if (row.external_url) return externalProvider(row.external_url);
  return providerById(activeProviderId(env), env);
}

/** Rebuild the room of a stored consultation for `provider`. */
export function roomOf(
  provider: VideoProvider,
  row: { video_room: string | null; external_url: string | null },
  env: Record<string, string | undefined> = process.env,
): VideoRoom | null {
  if (provider.id === "external") {
    return row.external_url ? { provider: "external", roomName: "external", roomUrl: row.external_url } : null;
  }
  if (!row.video_room) return null;
  if (provider.id === "livekit") {
    const cfg = liveKitConfig(env);
    return cfg ? { provider: "livekit", roomName: row.video_room, roomUrl: cfg.url } : null;
  }
  return { provider: "jitsi", roomName: row.video_room, roomUrl: `https://meet.jit.si/${row.video_room}` };
}

export { validateExternalUrl } from "./external.ts";
