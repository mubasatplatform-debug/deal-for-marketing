import { useCallback, useEffect, useRef, useState } from "react";

/** Copy text to the clipboard; `copied` stays true for a moment afterwards. */
export function useCopy(resetMs = 2500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // Clipboard API blocked (insecure origin, iframe policy): fall back.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
        ta.remove();
      }
      if (ok) {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetMs);
      }
      return ok;
    },
    [resetMs],
  );

  return { copied, copy };
}
