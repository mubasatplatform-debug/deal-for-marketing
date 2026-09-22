import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";

export function DealSignIn({ callbackURL = "/client" }: { callbackURL?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          onClick={() => signIn(p.providerId, { callbackURL })}
          className="h-12 border border-hair bg-card font-ui text-sm tracking-wide text-snow transition-colors hover:border-lime hover:text-lime"
        >
          الدخول عبر {p.label}
        </button>
      ))}
    </div>
  );
}
