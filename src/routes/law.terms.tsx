import { createFileRoute } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";
import { SiteChrome } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow } from "@/components/site-ui";
import { GRACE_DAYS, TRIAL_DAYS, VAT_RATE } from "@/lib/saas/plans";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * «مكتب المحامي» terms of use — DRAFT FOR LEGAL REVIEW. Plain statements of
 * how the product works today (trial, lifecycle, roles, payments, data
 * roles). It makes no claim that has not been built, and it has not been
 * reviewed by a lawyer: the banner says so until the owner replaces it.
 */
export const Route = createFileRoute("/law/terms")({
  head: () =>
    pageHead({
      title: "شروط استخدام مكتب المحامي",
      description: "شروط استخدام خدمة «مكتب المحامي» من ديل للتسويق — مسودة قيد المراجعة القانونية.",
      path: "/law/terms",
    }),
  component: Terms,
});

const UPDATED = "٢٣ سبتمبر ٢٠٢٦";

const sections: { title: string; body: string[] }[] = [
  {
    title: "الخدمة والأطراف",
    body: [
      "«مكتب المحامي» خدمة برمجية سحابية تقدمها ديل للتسويق (DEAL FOR MARKETING)، القصيم — بريدة، لإدارة مكاتب المحاماة. «المكتب» هو الجهة التي تنشئ مساحة عمل في الخدمة، و«المستخدم» كل شخص يدخل إليها بدعوة من المكتب.",
      "بعض الوحدات (المواعيد، العملاء، القضايا، المستندات) قيد التطوير وتُطلق على مراحل، ولا تلتزم ديل بموعد محدد لإطلاق كل وحدة ما لم يُتفق على ذلك كتابةً.",
    ],
  },
  {
    title: "الحساب والمكتب",
    body: [
      "يُنشئ المستخدم حسابه ببريده الإلكتروني، ومن ينشئ المكتب يصبح «مالكه». يضيف المالك أو المدير أعضاء الفريق بدعوة إلى بريدهم، ولكل عضو صلاحية (مالك، مدير، محامٍ، موظف) يحددها المكتب.",
      "المكتب مسؤول عن اختيار من يدعوهم، وعن صلاحياتهم، وعن إزالة من لم يعد يعمل لديه. ويبقى للمكتب مالك واحد على الأقل في كل الأحوال.",
      "على كل مستخدم الحفاظ على سرية كلمة مروره وإبلاغنا فورًا عند الاشتباه بدخول غير مصرح به.",
    ],
  },
  {
    title: "التجربة المجانية والاشتراك",
    body: [
      `يبدأ كل مكتب جديد بتجربة مجانية مدتها ${TRIAL_DAYS} يومًا دون الحاجة إلى وسيلة دفع.`,
      `الأسعار المعلنة بالريال السعودي ولا تشمل ضريبة القيمة المضافة (${Math.round(VAT_RATE * 100)}٪) التي تُضاف عند الدفع. يُدفع الاشتراك مقدمًا عن فترة شهرية أو سنوية، ويُفعّل بعد تأكيد الدفع.`,
      "يحدد كل اشتراك عددًا أقصى من المقاعد (الأعضاء والدعوات المعلّقة)، ولا تُقبل دعوات جديدة بعد بلوغه إلا بترقية الخطة.",
      "قد تعدّل ديل الأسعار أو الخطط مستقبلًا، ولا يسري التعديل على فترة مدفوعة قائمة.",
    ],
  },
  {
    title: "انتهاء التجربة أو الاشتراك",
    body: [
      `إذا انتهت التجربة أو الفترة المدفوعة دون تجديد، يبقى المكتب متاحًا كاملًا مدة ${GRACE_DAYS} أيام، ثم يتحول إلى وضع «القراءة فقط» فيمكن الاطلاع على البيانات دون تعديلها أو الإضافة إليها.`,
      "لا تحذف ديل بيانات المكتب تلقائيًا بسبب انتهاء الاشتراك. ولديل إيقاف المكتب مؤقتًا عند مخالفة هذه الشروط أو تعذّر السداد، مع بقاء البيانات محفوظة.",
    ],
  },
  {
    title: "البيانات والسرية",
    body: [
      "المكتب هو «جهة التحكم» في البيانات الشخصية لعملائه وموظفيه التي يُدخلها في الخدمة، وهو المسؤول عن وجود أساس نظامي لجمعها ومعالجتها وفق نظام حماية البيانات الشخصية ولوائحه، وعن التزاماته المهنية تجاه موكليه.",
      "ديل «جهة معالجة» لهذه البيانات: تعالجها نيابة عن المكتب ووفق تعليماته لغرض تشغيل الخدمة فقط، ولا تستخدمها لأي غرض آخر ولا تبيعها. بيانات كل مكتب معزولة عن غيره ولا يصل إليها إلا أعضاؤه.",
      "قد يطّلع فريق ديل على بيانات الاشتراك (اسم المكتب، الخطة، حالة الدفع، أعضاء الفريق) لإدارة الحسابات والفوترة والدعم.",
    ],
  },
  {
    title: "الاستخدام المقبول",
    body: [
      "يلتزم المكتب ومستخدموه باستخدام الخدمة في أغراض مشروعة، وعدم محاولة الوصول إلى بيانات مكاتب أخرى أو تعطيل الخدمة أو إساءة استخدامها.",
    ],
  },
  {
    title: "حدود المسؤولية",
    body: [
      "الخدمة أداة لتنظيم العمل ولا تقدم استشارة قانونية، ويبقى المحامي مسؤولًا عن عمله المهني ومراجعة ما يعتمده.",
      "تبذل ديل عناية معقولة لاستمرار الخدمة وحماية البيانات، ولا تتحمل الأضرار غير المباشرة الناشئة عن انقطاع الخدمة، في حدود ما يسمح به النظام.",
    ],
  },
  {
    title: "التواصل والنظام الحاكم",
    body: [
      "تخضع هذه الشروط لأنظمة المملكة العربية السعودية. للاستفسار: info@mubasat.net.",
    ],
  },
];

function Terms() {
  return (
    <SiteChrome>
      <main className="bg-paper pt-24 pb-20 md:pt-32 md:pb-28">
        <div className={cn(wrap, "grid gap-10 lg:grid-cols-12 lg:gap-14")}>
          <header className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Eyebrow>مكتب المحامي</Eyebrow>
              <h1 className="mt-4 font-display text-[2.3rem] leading-[1.25] text-pine-deep md:text-5xl">شروط الاستخدام</h1>
              <p className="mt-3 text-sm text-slate">آخر تحديث: {UPDATED}</p>
              <nav aria-label="أقسام الشروط" className="mt-8 hidden lg:block">
                <ol className="space-y-1 border-s border-line">
                  {sections.map((sec, i) => (
                    <li key={sec.title}>
                      <a
                        href={`#t-${i + 1}`}
                        className="-ms-px flex min-h-10 items-center border-s-2 border-transparent ps-4 text-[15px] font-semibold text-slate hover:border-pine hover:text-pine-deep"
                      >
                        {sec.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </header>

          <div className="lg:col-span-8">
            <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl bg-lime-50 p-5 ring-1 ring-lime/40">
              <FileWarning className="mt-0.5 size-5 shrink-0 text-lime-600" aria-hidden="true" />
              <p className="text-[15px] leading-relaxed text-pine-deep">
                <strong>مسودة قيد المراجعة القانونية.</strong> تصف هذه الصفحة طريقة عمل الخدمة حاليًا، وستُستبدل بالنسخة
                المعتمدة بعد مراجعتها.
              </p>
            </div>
            <div className="rounded-3xl bg-surface p-6 ring-1 ring-line md:p-10">
              <div className="space-y-10">
                {sections.map((sec, i) => (
                  <section key={sec.title} id={`t-${i + 1}`} aria-labelledby={`t-${i + 1}-h`} className="scroll-mt-28">
                    <h2 id={`t-${i + 1}-h`} className="flex items-center gap-3 font-display text-xl text-pine-deep md:text-2xl">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pine-50 font-ui text-sm font-bold text-pine">
                        {i + 1}
                      </span>
                      {sec.title}
                    </h2>
                    <div className="mt-4 space-y-3 text-[16px] leading-loose text-slate">
                      {sec.body.map((para) => (
                        <p key={para}>{para}</p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-pine-50 p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <p className="font-bold text-pine-deep">جاهز تجرب مكتب المحامي؟</p>
              <a href="/law/signup" className={siteButton("primary")}>
                ابدأ تجربتك المجانية {TRIAL_DAYS} يومًا
              </a>
            </div>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
