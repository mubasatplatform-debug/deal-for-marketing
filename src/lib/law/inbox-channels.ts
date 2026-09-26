/**
 * «مركز التواصل» channel adapters — pure (no app aliases), shared by the
 * inbox core (the send path) and the UI (channel names and status).
 *
 * Every channel the inbox speaks is one adapter:
 *
 *   { id, canSend(conv), send(conv, body) }
 *
 * The core stores an outbound message and then asks the conversation's
 * adapter to deliver it; whatever the adapter returns (a provider id, a
 * delivery state) is kept in the message's `channel_meta`. Inbound messages
 * reach the core through `receiveInboundCore` (inbox-core.ts), which any
 * webhook can call with the channel id and the contact's address.
 *
 * Phase 1 ships web chat (delivery = the visitor's widget polls, so `send`
 * has nothing to push). WhatsApp, SMS, voice and email are declared here so
 * the data model and the UI are ready; their `send` throws until connected.
 */

export const CHANNEL_IDS = ["webchat", "whatsapp", "sms", "email", "voice"] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

/** What an adapter needs to know about a conversation to reach the contact. */
export type ChannelConversation = {
  id: string;
  workspace_id: string;
  channel: ChannelId;
  contact_phone: string | null;
  contact_email: string | null;
  visitor_key: string | null;
};

/**
 * The outcome of a send, stored in the message's `channel_meta`:
 *   - 'pull': nothing pushed, the contact's client fetches it (web chat);
 *   - 'queued' / 'sent': handed to a provider (`externalId` is its id).
 */
export type SendResult = {
  delivery: "pull" | "queued" | "sent";
  externalId?: string;
  meta?: Record<string, unknown>;
};

export type ChannelAdapter = {
  id: ChannelId;
  /** Whether the office can reply on this channel right now. */
  connected: boolean;
  /** This conversation can receive a reply (the contact is reachable). */
  canSend(conv: ChannelConversation): boolean;
  /** Deliver `body` to the contact. Throws `ChannelNotConnectedError` when off. */
  send(conv: ChannelConversation, body: string): Promise<SendResult>;
};

export class ChannelNotConnectedError extends Error {
  readonly channel: ChannelId;
  constructor(channel: ChannelId) {
    super(`${CHANNEL_LABELS[channel]} غير متصلة بعد. سيتاح الرد عبرها قريبًا.`);
    this.name = "ChannelNotConnectedError";
    this.channel = channel;
  }
}

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  webchat: "الدردشة المباشرة",
  whatsapp: "واتساب",
  sms: "الرسائل النصية",
  email: "البريد الإلكتروني",
  voice: "المكالمات",
};

export const CHANNEL_SHORT: Record<ChannelId, string> = {
  webchat: "دردشة",
  whatsapp: "واتساب",
  sms: "SMS",
  email: "بريد",
  voice: "مكالمة",
};

/** Web chat: the visitor's widget polls, so a reply is delivered by storing it. */
export const webchatAdapter: ChannelAdapter = {
  id: "webchat",
  connected: true,
  canSend: (conv) => conv.channel === "webchat" && Boolean(conv.visitor_key),
  send: async () => ({ delivery: "pull" }),
};

/** A channel whose provider is not wired yet (phase 2 / 3). */
function comingSoon(id: ChannelId): ChannelAdapter {
  return {
    id,
    connected: false,
    canSend: () => false,
    send: async () => {
      throw new ChannelNotConnectedError(id);
    },
  };
}

export const ADAPTERS: Record<ChannelId, ChannelAdapter> = {
  webchat: webchatAdapter,
  whatsapp: comingSoon("whatsapp"),
  sms: comingSoon("sms"),
  email: comingSoon("email"),
  voice: comingSoon("voice"),
};

export function adapterFor(channel: ChannelId): ChannelAdapter {
  return ADAPTERS[channel] ?? comingSoon(channel);
}

/** The channels shown in the inbox settings, in order, with their state. */
export const CHANNEL_LIST: { id: ChannelId; label: string; connected: boolean }[] = (
  ["webchat", "whatsapp", "sms", "voice"] as const
).map((id) => ({ id, label: CHANNEL_LABELS[id], connected: ADAPTERS[id].connected }));
