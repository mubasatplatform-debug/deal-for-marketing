-- WhatsApp one-time codes (Twilio Verify, via the deal-otp relay).
--
-- 1. Two-step sign-in for «مكتب المحامي» members: a verified WhatsApp number
--    per user; each Better Auth session must pass a code once before any
--    office data is served (src/lib/otp/otp-core.ts, requireWorkspace).
-- 2. Booking-form phone checks: a verified (phone, visitor) pair is remembered
--    briefly so a retry after a taken slot needs no second code.
-- Codes themselves live only at Twilio; nothing here can reproduce one.

create table if not exists user_whatsapp_2fa (
  user_id text primary key references "user" ("id") on delete cascade,
  phone text not null,
  enabled_at timestamptz not null default now()
);

create table if not exists session_second_factor (
  session_id text primary key references "session" ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  verified_at timestamptz not null default now()
);
create index if not exists session_second_factor_user_idx on session_second_factor (user_id);

create table if not exists verified_phones (
  key text primary key, -- sha256 of scope | phone | visitor
  expires_at timestamptz not null
);
