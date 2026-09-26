import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { MODES, type ConsultMode } from "./options";
import { bookingForm, memberId, slugField } from "./schemas";
import type { BookingSettings } from "./schedule-core";
import type { SlotDay } from "./slots";
import type { JoinInfo, ProviderId } from "./video/types";

/**
 * Public «مكتب المحامي» server functions — no account needed:
 *   - the office booking page (/o/<slug>/book): office info, free slots, book;
 *   - the client's meeting page (/meet/<token>): status and the join token.
 *
 * Each is reachable only through an office slug (booking) or a meeting token
 * (only its SHA-256 is stored) and returns only what the page shows. Writes
 * and token minting are same-site only, rate-limited per visitor (hashed IP),
 * and the booking form carries a honeypot and a minimum fill time.
 */

const core = () => import("./schedule-core");

async function sameSite() {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  assertSameSiteRequest();
}

async function throttle(key: string, limit: number, windowSeconds: number) {
  const { takeHit, visitorId, RateLimitError } = await import("@/lib/rate-limit.server");
  try {
    await takeHit(`${key}:${visitorId()}`, limit, windowSeconds);
  } catch (err) {
    if (err instanceof RateLimitError) throw new Error(PUBLIC_ERRORS.busy);
    throw err;
  }
}

/** Messages the public pages show as-is (the server throws them). */
export const PUBLIC_ERRORS = {
  closed: "الحجز الإلكتروني غير متاح لهذا المكتب حاليًا.",
  slot: "لم يعد هذا الموعد متاحًا. اختر وقتًا آخر.",
  busy: "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.",
  tooFast: "أُرسل النموذج بسرعة كبيرة. راجع بياناتك ثم أرسل مرة أخرى.",
  invalid: "بعض البيانات غير صحيحة. راجعها وحاول مرة أخرى.",
  link: "رابط الاستشارة غير صحيح أو أُلغي.",
  notYet: "لم يحن موعد الدخول بعد. يفتح الدخول قبل الموعد بعشر دقائق.",
  ended: "انتهى وقت هذه الاستشارة.",
  notConfirmed: "لم يؤكد المكتب الاستشارة بعد.",
  notVideo: "هذه الاستشارة ليست مكالمة فيديو.",
  video: "تعذّر تجهيز غرفة الفيديو. حاول بعد لحظات.",
  phone: "أدخل رقم جوال عليه واتساب. مثال: 0501234567",
  code: "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.",
  send: "تعذّر إرسال الرمز عبر واتساب. تأكد من الرقم وحاول بعد لحظات.",
} as const;

/** Thrown when the booking needs the WhatsApp code first (the page then asks for it). */
export const NEED_CODE = "OTP:need_code";

/* ------------------------------------------------------------------------ */
/* Booking page                                                              */
/* ------------------------------------------------------------------------ */

export type BookingOffice = {
  name: string;
  city: string;
  slug: string;
  open: boolean;
  modes: ConsultMode[];
  lawyers: { id: string; name: string }[];
  slotMinutes: number;
  note: string;
  horizonDays: number;
  /** The client confirms their number with a WhatsApp code before booking. */
  verifyPhone: boolean;
  /** «مركز التواصل»: the web-chat widget is on (null when off). */
  chat: { welcome: string } | null;
};

async function verifyPhoneOn(): Promise<boolean> {
  const { bookingOtpSender: otpSender } = await import("@/lib/otp/otp.server");
  return otpSender() !== null;
}

function publicView(o: {
  name: string;
  city: string;
  slug: string;
  open: boolean;
  modes: ConsultMode[];
  lawyers: { id: string; name: string }[];
  settings: BookingSettings;
}, verifyPhone: boolean, chat: BookingOffice["chat"] = null): BookingOffice {
  return {
    name: o.name,
    city: o.city,
    slug: o.slug,
    open: o.open,
    modes: o.open ? o.modes : [],
    lawyers: o.open ? o.lawyers : [],
    slotMinutes: o.settings.slotMinutes,
    note: o.open ? o.settings.bookingNote : "",
    horizonDays: o.settings.horizonDays,
    verifyPhone,
    chat,
  };
}

export const getBookingOffice = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const r = z.object({ slug: slugField }).safeParse(input);
    return r.success ? r.data : { slug: "" };
  })
  .handler(async ({ data }): Promise<BookingOffice | null> => {
    if (!data.slug) return null;
    const { publicOfficeCore } = await core();
    const { getSql } = await import("@/lib/db");
    const office = await publicOfficeCore((await getSql()) as never, data.slug);
    if (!office) return null;
    const { chatOfficeCore } = await import("./inbox-core");
    const chat = await chatOfficeCore((await getSql()) as never, data.slug);
    return publicView(office, await verifyPhoneOn(), chat?.open ? { welcome: chat.settings.welcome } : null);
  });

export const getBookingSlots = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        slug: slugField,
        mode: z.enum(MODES),
        lawyerId: memberId.nullish(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
        days: z.number().int().min(1).max(31).default(14),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ days: { date: string; weekday: number; slots: { start: string; time: string }[] }[] }> => {
    await sameSite();
    await throttle("book-slots", 120, 600);
    const { publicOfficeCore, busyCore, availabilityOf } = await core();
    const { computeSlots } = await import("./slots");
    const { addDays, riyadhDayStart, riyadhYmd } = await import("./time");
    const { getSql } = await import("@/lib/db");
    const sql = (await getSql()) as never;
    const office = await publicOfficeCore(sql, data.slug);
    if (!office?.open || !office.modes.includes(data.mode)) return { days: [] };
    const lawyers = data.lawyerId
      ? office.lawyers.filter((l) => l.id === data.lawyerId).map((l) => l.id)
      : office.lawyers.map((l) => l.id);
    if (lawyers.length === 0) return { days: [] };
    const now = Date.now();
    const from = data.from && data.from > riyadhYmd(now) ? data.from : riyadhYmd(now);
    const busy = await busyCore(
      sql,
      office.id,
      lawyers,
      new Date(riyadhDayStart(from) - 86_400_000).toISOString(),
      new Date(riyadhDayStart(addDays(from, data.days + 1))).toISOString(),
    );
    const days: SlotDay[] = computeSlots({
      availability: availabilityOf(office.settings),
      lawyers,
      busy,
      now,
      fromYmd: from,
      days: data.days,
    });
    // Who is free is the server's business; the page only needs the times.
    return { days: days.map((d) => ({ date: d.date, weekday: d.weekday, slots: d.slots.map((s) => ({ start: s.start, time: s.time })) })) };
  });

/** Send the WhatsApp code that confirms the booking phone. */
export const sendBookingCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ slug: slugField, phone: z.string().max(40) }).parse(input))
  .handler(async ({ data }): Promise<{ phone: string }> => {
    await sameSite();
    const { whatsappPhone, maskPhone, OtpError } = await import("@/lib/otp/otp-core");
    const { bookingOtpSender: otpSender } = await import("@/lib/otp/otp.server");
    const phone = whatsappPhone(data.phone);
    if (!phone) throw new Error(PUBLIC_ERRORS.phone);
    const sender = otpSender();
    if (!sender) throw new Error(PUBLIC_ERRORS.send);
    const { publicOfficeCore } = await core();
    const { getSql } = await import("@/lib/db");
    const office = await publicOfficeCore((await getSql()) as never, data.slug);
    if (!office?.open) throw new Error(PUBLIC_ERRORS.closed);
    await throttle("book-otp", 5, 3600);
    const { takeHit, RateLimitError } = await import("@/lib/rate-limit.server");
    try {
      await takeHit(`book-otp-phone:${phone}`, 3, 900);
      await takeHit("otp-send:all", 1000, 86_400);
    } catch (err) {
      if (err instanceof RateLimitError) throw new Error(PUBLIC_ERRORS.busy);
      throw err;
    }
    try {
      await sender.start(phone);
    } catch (err) {
      if (err instanceof OtpError && err.code === "rate_limited") throw new Error(PUBLIC_ERRORS.busy);
      if (err instanceof OtpError && err.code === "bad_phone") throw new Error(PUBLIC_ERRORS.phone);
      throw new Error(PUBLIC_ERRORS.send);
    }
    return { phone: maskPhone(phone) };
  });

/**
 * The booking phone check: passes when the relay is off, when this visitor
 * proved this number in the last 30 minutes, or with a correct code now.
 */
async function assertBookingPhone(sql: never, phone: string, otpCode: string | null | undefined) {
  const { bookingOtpSender: otpSender } = await import("@/lib/otp/otp.server");
  const sender = otpSender();
  if (!sender) return;
  const { phoneRememberedCore, rememberPhoneCore, OtpError } = await import("@/lib/otp/otp-core");
  const { visitorId } = await import("@/lib/rate-limit.server");
  const visitor = visitorId();
  if (await phoneRememberedCore(sql, "book", phone, visitor)) return;
  if (!otpCode) throw new Error(NEED_CODE);
  await throttle("book-otp-check", 10, 900);
  let ok = false;
  try {
    ok = await sender.check(phone, otpCode);
  } catch (err) {
    if (err instanceof OtpError && err.code === "rate_limited") throw new Error(PUBLIC_ERRORS.busy);
    throw new Error(PUBLIC_ERRORS.code);
  }
  if (!ok) throw new Error(PUBLIC_ERRORS.code);
  await rememberPhoneCore(sql, "book", phone, visitor);
}

export type BookingResult = {
  ok: true;
  startsAt: string;
  endsAt: string;
  mode: ConsultMode;
  lawyer: string | null;
  office: string;
  /** The client's own page for this consultation (status now, the call later). */
  meetUrl: string | null;
  emailed: boolean;
};

const MIN_FILL_MS = 3000;

export const createBooking = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: unknown) => {
    const r = bookingForm.safeParse(input);
    if (!r.success) throw new Error(PUBLIC_ERRORS.invalid);
    return r.data;
  })
  .handler(async ({ data }): Promise<BookingResult> => {
    // Only bots fill the honeypot: a convincing success, nothing written.
    if (data.website) {
      return { ok: true, startsAt: data.start, endsAt: data.start, mode: data.mode, lawyer: null, office: "", meetUrl: null, emailed: false };
    }
    if (data.fillMs < MIN_FILL_MS) throw new Error(PUBLIC_ERRORS.tooFast);
    await throttle("book", 5, 3600);
    const { publicOfficeCore, busyCore, availabilityOf, bookSlotCore, officeNotifyEmailsCore } = await core();
    const { isOfferedStart, freeLawyers } = await import("./slots");
    const { newConsultIdentity, mailClient, mailOfficeRequested } = await import("./consult.server");
    const { takeHit, RateLimitError } = await import("@/lib/rate-limit.server");
    const { getSql } = await import("@/lib/db");
    const sql = (await getSql()) as never;

    const office = await publicOfficeCore(sql, data.slug);
    if (!office?.open || !office.modes.includes(data.mode)) throw new Error(PUBLIC_ERRORS.closed);
    try {
      await takeHit(`book-office:${office.id}`, 60, 86_400);
    } catch (err) {
      if (err instanceof RateLimitError) throw new Error(PUBLIC_ERRORS.busy);
      throw err;
    }
    const availability = availabilityOf(office.settings);
    const now = Date.now();
    if (!isOfferedStart(availability, data.start, now)) throw new Error(PUBLIC_ERRORS.slot);
    const startsAt = new Date(data.start).toISOString();
    const endsAt = new Date(Date.parse(startsAt) + availability.slotMinutes * 60_000).toISOString();
    // The number is the client's: a WhatsApp code proves it (see sendBookingCode).
    await assertBookingPhone(sql, data.phone!, data.otpCode);

    const pool = data.lawyerId
      ? office.lawyers.filter((l) => l.id === data.lawyerId)
      : office.lawyers;
    if (pool.length === 0) throw new Error(PUBLIC_ERRORS.slot);
    // "Any lawyer": the least busy that day goes first; the database lock
    // re-checks each candidate before inserting.
    const dayStart = new Date(Date.parse(startsAt) - 12 * 3_600_000).toISOString();
    const dayEnd = new Date(Date.parse(startsAt) + 12 * 3_600_000).toISOString();
    const busy = await busyCore(sql, office.id, pool.map((l) => l.id), dayStart, dayEnd);
    const free = freeLawyers(
      pool.map((l) => l.id),
      busy,
      Date.parse(startsAt),
      Date.parse(endsAt),
      availability.bufferMinutes,
    );
    const load = (id: string) => busy.filter((b) => b.lawyerId === id).length;
    const candidates = [...free].sort((a, b) => load(a) - load(b));
    if (candidates.length === 0) throw new Error(PUBLIC_ERRORS.slot);

    const ident = newConsultIdentity(data.mode);
    const booked = await bookSlotCore(sql, {
      id: ident.id,
      workspaceId: office.id,
      candidates,
      mode: data.mode,
      startsAt,
      endsAt,
      bufferMinutes: availability.bufferMinutes,
      topic: data.topic,
      name: data.name,
      phone: data.phone!,
      email: data.email,
      // Never linked to an existing client by phone here: an anonymous visitor
      // could otherwise probe the office's client list through the meet page.
      // Staff link or convert the booking after reviewing it.
      clientId: null,
      room: ident.room,
      nonce: ident.nonce,
      tokenHash: ident.tokenHash,
    });
    if (!booked) throw new Error(PUBLIC_ERRORS.slot);
    const lawyer = office.lawyers.find((l) => l.id === booked.lawyerId)?.name ?? null;
    const row = { id: booked.id, mode: data.mode, starts_at: startsAt, lawyer_name: lawyer, meet_nonce: ident.nonce };
    // Emails never block the booking (each send swallows its own failure).
    const [emailed] = await Promise.all([
      mailClient("requested", data.email, { name: office.name, slug: office.slug }, row),
      officeNotifyEmailsCore(sql, office.id, booked.lawyerId).then((emails) =>
        mailOfficeRequested(emails, { name: office.name }, row),
      ),
    ]).catch(() => [false]);
    const { meetUrlFor } = await import("./consult.server");
    return {
      ok: true,
      startsAt,
      endsAt,
      mode: data.mode,
      lawyer,
      office: office.name,
      meetUrl: meetUrlFor(booked.id, ident.nonce),
      emailed: Boolean(emailed),
    };
  });

/* ------------------------------------------------------------------------ */
/* Meeting page                                                              */
/* ------------------------------------------------------------------------ */

export type MeetView = {
  office: string;
  officeSlug: string;
  lawyer: string | null;
  clientName: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  mode: ConsultMode;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  location: string;
  window: "early" | "open" | "ended";
  provider: ProviderId | null;
  /** Set when the viewer is signed in as a member of this office. */
  memberUrl: string | null;
  serverNow: string;
};

const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

async function lookup(token: string) {
  const { hashMeetToken } = await import("./meet-token");
  const { meetByHashCore } = await core();
  const { getSql } = await import("@/lib/db");
  return meetByHashCore((await getSql()) as never, hashMeetToken(token));
}

export const getMeet = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator((input: unknown) => {
    const r = tokenInput.safeParse(input);
    return r.success ? r.data : { token: "" };
  })
  .handler(async ({ context, data }): Promise<MeetView | null> => {
    if (!data.token) return null;
    const row = await lookup(data.token);
    if (!row) return null;
    const { joinWindowState } = await import("./video/types");
    const { providerFor } = await import("./video/index");
    let memberUrl: string | null = null;
    if (context.userId) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const [m] = await sql<{ role: string }>`
        select role from workspace_members where workspace_id = ${row.workspace_id} and user_id = ${context.userId}
      `;
      if (m) memberUrl = `/app/consultations/${row.id}`;
    }
    return {
      office: row.office_name,
      officeSlug: row.office_slug,
      lawyer: row.lawyer_name,
      clientName: row.client_name,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      mode: row.mode,
      status: row.status,
      location: row.mode === "in_office" ? row.location : "",
      window: joinWindowState(row.starts_at, row.ends_at),
      provider: row.mode === "video" ? providerFor(row).id : null,
      memberUrl,
      serverNow: new Date().toISOString(),
    };
  });

export const getMeetJoin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const r = tokenInput.safeParse(input);
    if (!r.success) throw new Error(PUBLIC_ERRORS.link);
    return r.data;
  })
  .handler(async ({ data }): Promise<JoinInfo> => {
    await sameSite();
    await throttle("meet-join", 30, 600);
    const row = await lookup(data.token);
    if (!row) throw new Error(PUBLIC_ERRORS.link);
    if (row.mode !== "video") throw new Error(PUBLIC_ERRORS.notVideo);
    if (row.status !== "confirmed") throw new Error(PUBLIC_ERRORS.notConfirmed);
    const { joinWindowState } = await import("./video/types");
    const w = joinWindowState(row.starts_at, row.ends_at);
    if (w === "early") throw new Error(PUBLIC_ERRORS.notYet);
    if (w === "ended") throw new Error(PUBLIC_ERRORS.ended);
    const { providerFor, roomOf } = await import("./video/index");
    const provider = providerFor(row);
    const room = roomOf(provider, row);
    if (!room) throw new Error(PUBLIC_ERRORS.video);
    const join = await provider.joinUrl(
      room,
      {
        role: "guest",
        identity: `client:${row.id}`,
        name: row.client_name ?? "العميل",
        admitted: Boolean(row.client_admitted_at),
      },
      { endsAt: row.ends_at },
    );
    if (join.kind === "embed") {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        values (${row.workspace_id}, null, 'consult_join',
                ${JSON.stringify({ id: row.id, role: "guest", provider: provider.id, lobby: join.lobby })}::jsonb)
      `;
    }
    return join;
  });
