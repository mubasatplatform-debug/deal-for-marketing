import { useState } from "react";
import { Ban, KeyRound, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Pill } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { whenAr } from "@/components/law/format";
import { ConfirmDialog, useCan, useLoad } from "@/components/law/kit";
import { ShareLink } from "@/components/law/share-link";
import { createPortalLink, getPortalStatus, revokePortalLink } from "@/lib/law/portal";
import type { PortalStatus } from "@/lib/law/portal-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";

/**
 * «بوابة العميل» card on the client page: create / rotate / revoke the
 * client's private link. Only the link's hash is stored, so the full URL is
 * shown once, right after it is created.
 */
export function ClientPortalCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { active } = useLawApp();
  const allowed = useCan();
  const manage = allowed("client.portal");
  const ws = active.workspace.id;
  const res = useLoad(() => getPortalStatus({ data: { workspaceId: ws, clientId } }), [ws, clientId]);
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "rotate" | "revoke">(null);
  const s = status ?? res.data;

  async function create() {
    setBusy(true);
    try {
      const r = await createPortalLink({ data: { workspaceId: ws, clientId } });
      setUrl(r.url);
      setStatus(r.status);
      toast.success("أُنشئ رابط البوابة. انسخه أو أرسله الآن");
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    try {
      const r = await revokePortalLink({ data: { workspaceId: ws, clientId } });
      setStatus(r);
      setUrl(null);
      toast.success("أُوقف رابط البوابة");
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    }
  }

  const state = s?.state ?? "none";

  return (
    <Card className="pb-5">
      <CardHeader
        title="بوابة العميل"
        description="رابط خاص يرى منه العميل قضاياه ومواعيده والمستندات التي تشاركها معه، دون حساب."
        actions={
          s ? (
            state === "active" ? (
              <Pill tone="lime">فعّال</Pill>
            ) : state === "revoked" ? (
              <Pill tone="danger">موقوف</Pill>
            ) : (
              <Pill>غير مفعّل</Pill>
            )
          ) : null
        }
      />
      <div className="mt-4 space-y-3 px-5 md:px-6">
        {!s ? (
          res.error ? (
            <p className="text-[13px] text-slate">{res.error}</p>
          ) : (
            <div className="h-10 animate-pulse rounded-xl bg-pine-50/60" />
          )
        ) : (
          <>
            {url ? (
              <div className="space-y-2 rounded-xl bg-lime-50/60 p-3 ring-1 ring-lime/40">
                <ShareLink
                  url={url}
                  label="رابط بوابة العميل"
                  message={`مرحبًا ${clientName}، هذا رابطك الخاص لمتابعة قضاياك ومواعيدك ومستنداتك لدى ${active.workspace.name}:`}
                />
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-pine-deep">
                  <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  يظهر الرابط كاملًا الآن فقط، فنحن لا نحتفظ إلا ببصمته. انسخه أو أرسله قبل مغادرة الصفحة، وإن فقدته أنشئ رابطًا جديدًا.
                </p>
              </div>
            ) : state === "active" ? (
              <p className="text-[13px] leading-relaxed text-slate">
                الرابط مفعّل منذ {whenAr(s.created_at)}. لا يمكن عرضه مجددًا لأننا لا نحتفظ به كاملًا؛ أنشئ رابطًا جديدًا إن احتجت إلى إرساله مرة أخرى.
              </p>
            ) : state === "revoked" ? (
              <p className="text-[13px] leading-relaxed text-slate">أوقفت الرابط في {whenAr(s.revoked_at)}. لم يعد العميل يستطيع فتحه.</p>
            ) : (
              <p className="text-[13px] leading-relaxed text-slate">لم يُنشأ رابط لهذا العميل بعد.</p>
            )}

            {state !== "none" ? (
              <p className="text-xs text-slate">
                آخر فتح: <span className="font-semibold text-pine-deep">{s.last_seen_at ? whenAr(s.last_seen_at) : "لم يُفتح بعد"}</span>
              </p>
            ) : null}

            {manage ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {state === "active" ? (
                  <>
                    <Button size="sm" icon={busy ? Loader2 : RefreshCw} disabled={busy} onClick={() => setConfirm("rotate")}>
                      إنشاء رابط جديد يلغي القديم
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Ban}
                      disabled={busy}
                      onClick={() => setConfirm("revoke")}
                      className="hover:bg-red-50 hover:text-red-700"
                    >
                      إيقاف الرابط
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="dark" icon={busy ? Loader2 : Link2} disabled={busy} onClick={() => void create()}>
                    {state === "revoked" ? "إنشاء رابط جديد" : "إنشاء رابط البوابة"}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate">إدارة الرابط متاحة للمحامين ومديري المكتب.</p>
            )}
          </>
        )}
      </div>

      {confirm === "rotate" ? (
        <ConfirmDialog
          title="إنشاء رابط جديد؟"
          body="سيتوقف الرابط الحالي فورًا، وعليك إرسال الرابط الجديد إلى العميل."
          confirmLabel="إنشاء رابط جديد"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await create();
            setConfirm(null);
          }}
        />
      ) : null}
      {confirm === "revoke" ? (
        <ConfirmDialog
          title="إيقاف رابط البوابة؟"
          body="لن يستطيع العميل فتح البوابة بعد الآن. يمكنك إنشاء رابط جديد لاحقًا."
          confirmLabel="إيقاف الرابط"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await revoke();
            setConfirm(null);
          }}
        />
      ) : null}
    </Card>
  );
}
