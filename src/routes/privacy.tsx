import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow } from "@/components/site-ui";
import { mobile, phone } from "@/lib/content";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "سياسة الخصوصية",
      description:
        "كيف تجمع ديل للتسويق بياناتك وتستخدمها وتحميها، وفق نظام حماية البيانات الشخصية.",
      path: "/privacy",
    }),
  component: Privacy,
});

const UPDATED = "٢٣ سبتمبر ٢٠٢٦";

const sections: { title: string; body: string[] }[] = [
  {
    title: "من نحن",
    body: [
      "ديل للتسويق (DEAL FOR MARKETING)، القصيم — بريدة، هي الجهة المسؤولة عن معالجة البيانات الشخصية التي تُجمع عبر هذا الموقع، وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية ولوائحه التنفيذية.",
    ],
  },
  {
    title: "البيانات التي نجمعها",
    body: [
      "عند إرسال طلب خدمة: الاسم، رقم الجوال، اسم الجهة (اختياري)، ووصف الاحتياج.",
      "عند الدخول بحساب Google أو X: الاسم والبريد الإلكتروني وصورة الحساب كما يرسلها مزوّد الدخول، مع بيانات الجلسة (عنوان IP ونوع المتصفح) لحماية الحساب.",
      "عند استخدام «خط ديل»: نص المحادثة التي تكتبها، ويُحفظ مؤقتًا في متصفحك فقط.",
      "مصدر الزيارة الأولى: اسم الحملة أو الموقع الذي أوصلك إلينا (مثل سناب شات أو قوقل) وأول صفحة فتحتها، ونحفظه في متصفحك ٣٠ يومًا ويُرفق بطلبك إن أرسلته، لنعرف أي قنواتنا تجلب الطلبات. لا نستخدم ملفات تعريف ارتباط (cookies) للتتبع ولا أدوات تتبع من جهات أخرى.",
      "لمنع الإساءة والطلبات الآلية عند إرسال طلب أو استخدام «خط ديل»: بصمة أحادية الاتجاه (hash) لعنوان IP الخاص بك لا يمكن استرجاع العنوان منها، ولا نحفظ العنوان نفسه، وتُحذف تلقائيًا خلال ٢٤ ساعة على الأكثر.",
    ],
  },
  {
    title: "لماذا نستخدمها",
    body: [
      "للتواصل معك بخصوص طلبك وتقديم الخدمة التي طلبتها، ولحماية الموقع من الإساءة والطلبات الآلية. لا نبيع بياناتك ولا نستخدمها لإعلانات جهات أخرى.",
    ],
  },
  {
    title: "مع من نشاركها",
    body: [
      "مزوّدو الاستضافة وقاعدة البيانات الذين يشغّلون الموقع.",
      "«خط ديل» تجربة ذكاء اصطناعي: تُرسل رسائلك إلى مزوّد نموذج لغوي (Anthropic Claude، أو xAI احتياطيًا) لتوليد الرد، وقد تتم المعالجة خارج المملكة. لا تكتب في الخط بيانات حساسة.",
      "أداة إشعار داخلية توصل طلبك لفريق ديل.",
    ],
  },
  {
    title: "مدة الاحتفاظ",
    body: [
      "نحتفظ بكل طلب خدمة سنتين من تاريخ إرساله، ثم يُحذف تلقائيًا من قاعدة بياناتنا (تجري عملية الحذف مرة يوميًا، فقد يتأخر أيامًا قليلة). ولك أن تطلب حذفه قبل ذلك في أي وقت.",
      "الرسائل والملفات المتبادلة بينك وبين فريق ديل حول طلب ما تُحفظ مع ذلك الطلب، ويراها صاحب الطلب وفريق ديل فقط، وتُحذف معه.",
      "بصمة عنوان IP المستخدمة لمنع الإساءة تُحذف تلقائيًا خلال ٢٤ ساعة على الأكثر.",
    ],
  },
  {
    title: "حقوقك",
    body: [
      "لك حق العلم بمعالجة بياناتك، والوصول إليها، وطلب تصحيحها أو إتلافها، وسحب موافقتك في أي وقت. راسلنا على info@mubasat.net أو اتصل على الرقم أدناه، ونرد خلال ٣٠ يومًا. ولك حق تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).",
    ],
  },
];

function Privacy() {
  return (
    <SiteChrome>
      <main className="bg-paper pt-24 pb-20 md:pt-32 md:pb-28">
        <div className={cn(wrap, "grid gap-10 lg:grid-cols-12 lg:gap-14")}>
          <header className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Eyebrow>الخصوصية</Eyebrow>
              <h1 className="mt-4 font-display text-[2.3rem] leading-[1.25] text-pine-deep md:text-5xl">سياسة الخصوصية</h1>
              <p className="mt-3 text-sm text-slate">آخر تحديث: {UPDATED}</p>
              <nav aria-label="أقسام السياسة" className="mt-8 hidden lg:block">
                <ol className="space-y-1 border-s border-line">
                  {sections.map((sec, i) => (
                    <li key={sec.title}>
                      <a
                        href={`#p-${i + 1}`}
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
            <div className="rounded-3xl bg-surface p-6 ring-1 ring-line md:p-10">
              <div className="space-y-10">
                {sections.map((sec, i) => (
                  <section key={sec.title} id={`p-${i + 1}`} aria-labelledby={`p-${i + 1}-h`} className="scroll-mt-28">
                    <h2 id={`p-${i + 1}-h`} className="flex items-center gap-3 font-display text-xl text-pine-deep md:text-2xl">
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
              <div>
                <p className="font-bold text-pine-deep">للتواصل بخصوص بياناتك</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                  <a href="mailto:info@mubasat.net" className="inline-flex min-h-11 items-center font-semibold text-pine underline-offset-4 hover:underline" dir="ltr">
                    info@mubasat.net
                  </a>
                  <a href={`tel:${phone.tel}`} className="inline-flex min-h-11 items-center font-ui font-bold text-pine" dir="ltr">
                    {phone.display}
                  </a>
                  <a href={phone.wa} className="inline-flex min-h-11 items-center font-ui font-bold text-pine" dir="ltr">
                    {mobile.display}
                  </a>
                </p>
              </div>
              <Link to="/start" className={siteButton("primary")}>
                اطلب خدمتك
              </Link>
            </div>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
