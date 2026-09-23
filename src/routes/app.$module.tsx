import { createFileRoute, notFound } from "@tanstack/react-router";
import { Check, ExternalLink, Hourglass } from "lucide-react";
import { Card } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { PageHead } from "@/components/law/app-frame";
import { moduleById } from "@/components/law/modules";

/** Practice modules not built yet (phase 2): a calm "قريبًا" page. */
export const Route = createFileRoute("/app/$module")({
  loader: ({ params }) => {
    const m = moduleById(params.module);
    if (!m) throw notFound();
    return { id: m.id };
  },
  component: ComingSoon,
});

function ComingSoon() {
  const { id } = Route.useLoaderData();
  const m = moduleById(id)!;
  return (
    <>
      <PageHead title={m.title} subtitle={m.blurb} />
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-5">
          <div className="p-6 md:p-10 lg:col-span-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1 text-xs font-bold text-lime-600 ring-1 ring-lime/40 ring-inset">
              <Hourglass className="size-3.5" aria-hidden="true" />
              قريبًا في مكتبك
            </span>
            <h2 className="mt-5 text-2xl leading-snug font-extrabold md:text-[28px]">
              نبني «{m.label}» الآن، وتصلك تلقائيًا.
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-slate">
              لا تحتاج إعدادًا إضافيًا: حين تجهز الوحدة تظهر هنا لكل أعضاء مكتبك، بالصلاحيات التي حددتها في
              «الفريق».
            </p>
            <ul className="mt-6 space-y-2.5">
              {m.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px]">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-pine text-lime">
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-2">
              <a href={m.demo} target="_blank" rel="noopener" className={buttonClass("dark")}>
                شاهد العرض التوضيحي
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-3 text-xs text-slate">العرض التوضيحي ببيانات تجريبية، لا يمس بيانات مكتبك.</p>
          </div>
          <div aria-hidden="true" className="relative hidden min-h-72 bg-pine-deep lg:col-span-2 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_30%_20%,rgba(194,207,48,0.18),transparent_70%)]" />
            <div className="absolute inset-8 grid grid-rows-[auto_1fr] gap-3">
              <div className="flex gap-2">
                <span className="h-3 w-24 rounded-full bg-white/15" />
                <span className="h-3 w-12 rounded-full bg-lime/60" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span
                    key={i}
                    className={i === 4 ? "rounded-xl bg-lime/80" : "rounded-xl bg-white/[0.07] ring-1 ring-white/10 ring-inset"}
                  />
                ))}
              </div>
            </div>
            <m.icon className="absolute end-8 bottom-8 size-14 text-lime/80" />
          </div>
        </div>
      </Card>
    </>
  );
}
