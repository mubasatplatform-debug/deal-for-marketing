import { randomUUID } from "node:crypto";
import { publicOrigin } from "@/lib/saas/guard.server";
import { deriveMeetToken, hashMeetToken, meetSecret, newMeetNonce } from "./meet-token";
import type { ConsultMode } from "./options";
import { randomRoomName } from "./video/types";

/**
 * Consultation plumbing shared by the office and public server functions —
 * **server-only**: meeting links, room names, and the consultation emails.
 */

/** A fresh id + meeting link for a consultation about to be inserted. */
export function newConsultIdentity(mode: ConsultMode) {
  const id = randomUUID();
  const nonce = newMeetNonce();
  const token = deriveMeetToken(meetSecret(), id, nonce);
  return {
    id,
    nonce,
    token,
    tokenHash: hashMeetToken(token),
    // Rooms are provider-neutral names; only video consultations get one.
    room: mode === "video" ? randomRoomName() : null,
  };
}

/** A new link for an existing consultation (revokes the old one). */
export function rotateMeet(id: string) {
  const nonce = newMeetNonce();
  const token = deriveMeetToken(meetSecret(), id, nonce);
  return { nonce, token, tokenHash: hashMeetToken(token) };
}

export function meetUrlFor(id: string, nonce: string | null): string | null {
  if (!nonce) return null;
  return `${publicOrigin()}/meet/${deriveMeetToken(meetSecret(), id, nonce)}`;
}

export function bookingUrlFor(slug: string): string {
  return `${publicOrigin()}/o/${slug}/book`;
}

export function officeConsultUrl(id: string): string {
  return `${publicOrigin()}/app/consultations/${id}`;
}

type MailRow = {
  id: string;
  mode: ConsultMode;
  starts_at: string;
  lawyer_name: string | null;
  meet_nonce: string | null;
};

/**
 * Tell the client about their consultation. Fire-and-forget safe: never
 * throws, returns whether the relay took it.
 */
export async function mailClient(
  kind: "requested" | "confirmed" | "cancelled" | "reminder",
  to: string | null,
  office: { name: string; slug: string },
  row: MailRow,
): Promise<boolean> {
  if (!to) return false;
  try {
    const { sendConsultEmail } = await import("@/lib/mail.server");
    const url = kind === "cancelled" ? bookingUrlFor(office.slug) : meetUrlFor(row.id, row.meet_nonce);
    if (!url) return false;
    return await sendConsultEmail({
      to,
      kind,
      audience: "client",
      office: office.name,
      lawyer: row.lawyer_name ?? "",
      when: row.starts_at,
      mode: row.mode,
      url,
    });
  } catch (err) {
    console.error("[law] consultation email failed:", err);
    return false;
  }
}

/** Tell the office (owners/admins + the assigned lawyer) about a new online booking. */
export async function mailOfficeRequested(
  emails: string[],
  office: { name: string },
  row: Omit<MailRow, "meet_nonce">,
): Promise<void> {
  try {
    const { sendConsultEmail } = await import("@/lib/mail.server");
    await Promise.all(
      emails.slice(0, 20).map((to) =>
        sendConsultEmail({
          to,
          kind: "requested",
          audience: "office",
          office: office.name,
          lawyer: row.lawyer_name ?? "",
          when: row.starts_at,
          mode: row.mode,
          url: officeConsultUrl(row.id),
        }),
      ),
    );
  } catch (err) {
    console.error("[law] office booking email failed:", err);
  }
}
