import { createFileRoute } from "@tanstack/react-router";
import { DealLogo } from "@/components/logo";
import { DealSignIn } from "@/components/deal-sign-in";
import { LimeWave } from "@/components/lime-wave";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-ink px-6 pt-10 pb-24">
      <div className="flex items-center justify-between">
        <a href="/" className="font-ui text-sm text-mist hover:text-lime">
          الرئيسية
        </a>
        <DealLogo />
      </div>
      <div className="mx-auto mt-24 max-w-md text-center">
        <p className="text-kicker text-lime">دخول العميل //</p>
        <h1 className="mt-4 font-display text-poster text-snow">اطلب خدمتك من ديل</h1>
        <p className="mt-4 text-mist">ادخل لحسابك، اختر الخدمة، وأرسل طلبك مباشرة.</p>
        <div className="mt-10">
          <SignedIn>
            <div className="space-y-6">
              <div className="flex justify-center text-snow">
                <UserButton />
              </div>
              <a href="/start" className="inline-flex h-12 items-center border border-lime px-8 font-display text-lime">
                ابدأ الطلب
              </a>
            </div>
          </SignedIn>
          <SignedOut>
            <DealSignIn callbackURL="/start" />
          </SignedOut>
        </div>
      </div>
      <LimeWave className="absolute inset-x-0 bottom-0 h-24" />
    </main>
  );
}
