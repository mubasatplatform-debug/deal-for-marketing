import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "";
}

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = errorMessage(error);

  function retry() {
    reset();
    void router.invalidate();
  }

  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink px-6 text-center text-snow"
    >
      <span className="text-lime" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={1.6} />
      </span>
      <h1 className="font-display text-poster text-snow">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-mist">
        نعتذر، تعذّر عرض هذه الصفحة. حاول مرة أخرى أو ارجع للرئيسية.
      </p>
      {message ? (
        <p dir="auto" className="max-w-md font-ui text-xs break-words text-mist">
          {message}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-12 items-center border border-lime bg-lime px-8 font-display text-ink"
        >
          إعادة المحاولة
        </button>
        <a
          href="/"
          className="inline-flex h-12 items-center border border-lime px-8 font-display text-lime"
        >
          الرئيسية
        </a>
      </div>
    </main>
  );
}
