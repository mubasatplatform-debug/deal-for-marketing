import { useState } from "react";
import { Avatar, Num } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import {
  countOf,
  displayPhone,
  formatAbsolute,
  formatRelative,
  requestsWord,
  type Customer,
} from "./format";

const PAGE = 8;

export function CustomersList({
  customers,
  now,
  onOpen,
}: {
  customers: Customer[];
  now: number;
  onOpen: (id: number) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? customers : customers.slice(0, PAGE);
  return (
    <>
      <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_90px_120px] items-center gap-4 border-y border-line bg-paper/60 px-6 py-2.5 text-[12px] font-semibold text-slate md:grid">
        <span>العميل</span>
        <span>الجوال</span>
        <span>الخدمات</span>
        <span>الطلبات</span>
        <span>آخر طلب</span>
      </div>
      <ul className="divide-y divide-line border-t border-line md:border-t-0">
        {shown.map((c) => {
          const last = new Date(c.last);
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onOpen(c.latest.id)}
                title="فتح آخر طلب"
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-start transition-colors hover:bg-paper/70 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_90px_120px] md:px-6"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} className="size-8 bg-pine-50 text-[12px] text-pine" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-pine-deep">
                      {c.name}
                    </span>
                    <span className="block truncate text-xs text-slate">{c.company || "—"}</span>
                  </span>
                </span>
                <span className="hidden md:block">
                  <Num className="text-[13px] text-pine-deep">
                    <span dir="ltr">{c.phone ? displayPhone(c.phone) : "—"}</span>
                  </Num>
                </span>
                <span className="hidden truncate text-[13px] text-slate md:block">
                  {c.services.join("، ")}
                </span>
                <span className="text-end text-[13px] text-pine-deep md:text-start">
                  <span className="md:hidden">{countOf(c.count, requestsWord)}</span>
                  <Num className="hidden font-semibold md:inline">{c.count}</Num>
                </span>
                <time
                  dateTime={last.toISOString()}
                  title={formatAbsolute(last)}
                  className="col-span-2 ps-11 text-xs text-slate md:col-span-1 md:ps-0 md:text-[13px]"
                >
                  <span className="md:hidden">آخر طلب </span>
                  {formatRelative(last, now)}
                </time>
              </button>
            </li>
          );
        })}
      </ul>
      {customers.length > PAGE ? (
        <div className="border-t border-line px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className={buttonClass("ghost", "sm")}
          >
            {all ? "عرض أقل" : `عرض كل العملاء (${customers.length})`}
          </button>
        </div>
      ) : null}
    </>
  );
}
