import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { phone } from "@/lib/content";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | ديل" },
      {
        name: "description",
        content: "كيف تجمع ديل للتسويق بياناتك وتستخدمها وتحميها، وفق نظام حماية البيانات الشخصية.",
      },
    ],
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
      "«خط ديل» تجربة ذكاء اصطناعي: تُرسل رسائلك إلى مزوّد نموذج لغوي (xAI) لتوليد الرد، وقد تتم المعالجة خارج المملكة. لا تكتب في الخط بيانات حساسة.",
      "أداة إشعار داخلية توصل طلبك لفريق ديل.",
    ],
  },
  {
    title: "مدة الاحتفاظ",
    body: [
      "نحتفظ بطلبات الخدمة طوال فترة التعامل ثم مدة لا تتجاوز سنتين بعد آخر تواصل، ما لم يُلزمنا نظام بمدة أطول، ثم نحذفها.",
    ],
  },
  {
    title: "حقوقك",
    body: [
      "لك حق العلم بمعالجة بياناتك، والوصول إليها، وطلب تصحيحها أو إتلافها، وسحب موافقتك في أي وقت. راسلنا على info@dealadv.sa أو اتصل على الرقم أدناه، ونرد خلال ٣٠ يومًا. ولك حق تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).",
    ],
  },
];

function Privacy() {
  return (
    <SiteChrome>
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">الخصوصية //</p>
        <h1 className="mt-4 font-display text-poster text-snow">سياسة الخصوصية</h1>
        <p className="mt-3 text-sm text-dim">آخر تحديث: {UPDATED}</p>
        <div className="mt-12 max-w-2xl space-y-10">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-xl text-snow">{s.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-loose text-mist">
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="text-sm text-mist">
            للتواصل:{" "}
            <a href="mailto:info@dealadv.sa" className="text-lime">
              info@dealadv.sa
            </a>{" "}
            ·{" "}
            <a href={`tel:${phone.tel}`} className="text-lime" dir="ltr">
              {phone.display}
            </a>
          </p>
          <Link to="/start" className="inline-flex font-display text-sm text-lime">
            اطلب خدمتك
          </Link>
        </div>
      </main>
    </SiteChrome>
  );
}
