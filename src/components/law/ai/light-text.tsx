import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toLatinDigits } from "@/components/law/ai/text-utils";

/**
 * The light format the assistant writes (answers and drafts): «# » title,
 * «## » / «### » headings, numbered and «-»/«•» lists, **bold**, paragraphs.
 * No HTML, links or images are ever rendered — markdown images are dropped and
 * links reduced to their text. Citation markers like [م2 ص5] can be turned into
 * chips by `cite`.
 */

type Block =
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; lines: string[] }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: { n: number; text: string }[] }
  | { t: "hr" };


function parse(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", lines: para });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      out.push({ t: "h", level: Math.min(3, m[1].length) as 1 | 2 | 3, text: m[2].replace(/#+\s*$/, "") });
    } else if (/^([-*_])\1{2,}$/.test(line)) {
      flush();
      out.push({ t: "hr" });
    } else if ((m = /^[-•*▪◦]\s+(.*)$/.exec(line))) {
      flush();
      const last = out[out.length - 1];
      if (last?.t === "ul") last.items.push(m[1]);
      else out.push({ t: "ul", items: [m[1]] });
    } else if ((m = /^([0-9٠-٩]{1,3})[.)\-–]\s+(.*)$/.exec(line))) {
      flush();
      const n = Number(toLatinDigits(m[1]));
      const last = out[out.length - 1];
      if (last?.t === "ol") last.items.push({ n, text: m[2] });
      else out.push({ t: "ol", items: [{ n, text: m[2] }] });
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

const CITE_RE = /\[\s*م\s*[0-9٠-٩]+[^\]\n]{0,60}\]/;
const INLINE_RE = new RegExp(`\\*\\*([^*]+?)\\*\\*|${CITE_RE.source}`, "g");

function clean(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images: never shown
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:|\/)[^)]*\)/g, "$1") // links → text
    .replace(/<[^>]+>/g, "");
}

function inline(text: string, cite?: (raw: string, key: string) => ReactNode): ReactNode[] {
  const s = clean(text);
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(s.slice(last, at));
    const key = `i${i++}`;
    if (m[1] !== undefined) {
      out.push(
        <strong key={key} className="font-bold text-pine-deep">
          {m[1]}
        </strong>,
      );
    } else {
      out.push(cite ? cite(m[0], key) : m[0]);
    }
    last = at + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function LightText({
  text,
  cite,
  size = "md",
  className,
}: {
  text: string;
  cite?: (raw: string, key: string) => ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  const blocks = parse(text);
  const body = size === "lg" ? "text-[15.5px] leading-[2]" : "text-[14px] leading-[1.9]";
  return (
    <div dir="rtl" className={cn("space-y-3 break-words text-pine-deep", body, className)}>
      {blocks.map((b, i) => {
        if (b.t === "h") {
          const cls =
            b.level === 1
              ? "text-center text-[18px] font-extrabold md:text-[20px]"
              : b.level === 2
                ? "pt-2 text-[16px] font-extrabold"
                : "pt-1 text-[14.5px] font-bold";
          const Tag = b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4";
          return (
            <Tag key={i} className={cls}>
              {inline(b.text, cite)}
            </Tag>
          );
        }
        if (b.t === "hr") return <hr key={i} className="border-line" />;
        if (b.t === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1.5 ps-6 marker:text-pine/60">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, cite)}</li>
              ))}
            </ul>
          );
        }
        if (b.t === "ol") {
          return (
            <ol key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 font-ui font-bold text-pine tabular-nums">{it.n}.</span>
                  <span className="min-w-0 flex-1">{inline(it.text, cite)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(l, cite)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
