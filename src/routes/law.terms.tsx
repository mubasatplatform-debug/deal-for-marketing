import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { GRACE_DAYS, TRIAL_DAYS, VAT_RATE } from "@/lib/saas/plans";
import { pageHead } from "@/lib/seo";

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
      description: "شروط استخدام خدمة «مكتب المحامي» من ديل للتسويق.",
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
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">مكتب المحامي //</p>
        <h1 className="mt-4 font-display text-poster text-snow">شروط الاستخدام</h1>
        <p className="mt-3 text-sm text-dim">آخر تحديث: {UPDATED}</p>
        <p role="note" className="mt-8 max-w-2xl border-s-2 border-lime ps-4 text-sm leading-loose text-mist">
          <strong className="font-display text-lime">مسودة قيد المراجعة القانونية.</strong> تصف هذه الصفحة طريقة عمل الخدمة
          حاليًا، وستُستبدل بالنسخة المعتمدة بعد مراجعتها.
        </p>
        <div className="mt-12 max-w-2xl space-y-10">
          {sections.map((sec, i) => (
            <section key={sec.title} id={`t-${i + 1}`} aria-labelledby={`t-${i + 1}-h`} className="scroll-mt-24">
              <h2 id={`t-${i + 1}-h`} className="flex items-baseline gap-3 font-display text-xl text-snow">
                <span className="font-display text-sm text-lime">{String(i + 1).padStart(2, "0")}</span>
                {sec.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-loose text-mist">
                {sec.body.map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </div>
            </section>
          ))}
          <a
            href="/law/signup"
            className="inline-flex h-12 items-center justify-center bg-lime px-8 font-display text-base text-ink transition-opacity hover:opacity-90"
          >
            ابدأ تجربتك المجانية {TRIAL_DAYS} يومًا
          </a>
        </div>
      </main>
    </SiteChrome>
  );
}
