import { ChevronLeft, Info, Mail, MessageCircle, Phone, Smartphone } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Card, Num } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { mobile, phone } from "@/lib/content";
import { cn } from "@/lib/utils";
import { TEAM_EMAIL, followUpText, waLink } from "./status";

/** "فريقك في ديل" — one place to reach a person, never a form. */
export function SupportCard({ latestId, latestService }: { latestId?: number; latestService?: string }) {
  return (
    <Card className="overflow-hidden">
      <div id="contact" className="scroll-mt-24 px-5 pt-5 md:px-6">
        <div className="flex items-center gap-3">
          <TeamMark />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-pine-deep">فريقك في ديل</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-lime" />
              نرد خلال ساعات العمل
            </p>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-slate">
          شخص من الفريق يتابع طلبك من أول رسالة حتى التسليم. اسألنا عن أي تفصيل.
        </p>
        <a
          href={waLink(followUpText(latestId, latestService))}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonClass("primary"), "mt-4 w-full")}
        >
          <MessageCircle className="size-4" />
          راسلنا على واتساب
        </a>
      </div>
      <ul className="mt-5 border-t border-line">
        <ContactRow href={`tel:${mobile.tel}`} icon={Smartphone} label="الجوال وواتساب">
          <Num>
            <bdi>{mobile.display}</bdi>
          </Num>
        </ContactRow>
        <ContactRow href={`tel:${phone.tel}`} icon={Phone} label="الهاتف الثابت">
          <Num>
            <bdi>{phone.display}</bdi>
          </Num>
        </ContactRow>
        <ContactRow href={`mailto:${TEAM_EMAIL}`} icon={Mail} label="البريد الإلكتروني">
          <span dir="ltr" className="font-ui">
            {TEAM_EMAIL}
          </span>
        </ContactRow>
      </ul>
    </Card>
  );
}

function ContactRow({
  href,
  icon: Icon,
  label,
  children,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <a
        href={href}
        className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/70 focus-visible:bg-paper focus-visible:outline-none md:px-6"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper text-pine">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate">{label}</span>
          <span className="block truncate text-sm font-semibold text-pine-deep">{children}</span>
        </span>
        <ChevronLeft
          aria-hidden="true"
          className="size-4 text-slate/50 transition-[color,transform] group-hover:-translate-x-0.5 group-hover:text-pine-deep"
        />
      </a>
    </li>
  );
}

/** The brand's play mark on pine: the team's avatar, not a stock face. */
function TeamMark() {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-pine-deep">
      <svg viewBox="0 0 18 20" className="h-3.5 w-auto translate-x-px text-lime">
        <polygon points="1,1 17,10 1,19" fill="currentColor" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function GuestNote() {
  return (
    <div className="flex gap-3 rounded-2xl border border-line px-5 py-4">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate" />
      <p className="text-[13px] leading-relaxed text-slate">
        طلبات أرسلتها بدون دخول تصلك متابعتها على جوالك، ولا تظهر في هذه القائمة.
      </p>
    </div>
  );
}
