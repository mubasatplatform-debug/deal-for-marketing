import { Download } from "lucide-react";
import { formatBytes, kindFromName } from "@/lib/files/validate";
import { extLabel, fileIcon, isImage } from "./file-meta";
import { fileUrl, type ThreadFile } from "@/lib/thread";
import { cn } from "@/lib/utils";

/** A message's attachments: image thumbnails, then file chips. */
export function Attachments({ files, own }: { files: ThreadFile[]; own: boolean }) {
  const images = files.filter((f) => isImage(f.name));
  const others = files.filter((f) => !isImage(f.name));
  return (
    <div className="space-y-1.5">
      {images.length ? (
        <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((f) => (
            <a
              key={f.id}
              href={fileUrl(f.id, true)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${f.name} · ${formatBytes(f.size)}`}
              className={cn(
                "group relative block overflow-hidden rounded-xl bg-paper ring-1",
                own ? "ring-white/15" : "ring-line",
                images.length === 1 ? "aspect-[4/3] w-full max-w-[280px]" : "aspect-square",
              )}
            >
              <img
                src={fileUrl(f.id, true)}
                alt={f.name}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-pine-deep/70 to-transparent px-2 pt-5 pb-1.5 text-start text-[11px] font-semibold text-snow opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {f.name}
              </span>
            </a>
          ))}
        </div>
      ) : null}
      {others.map((f) => (
        <FileChip key={f.id} file={f} own={own} />
      ))}
    </div>
  );
}

function FileChip({ file, own }: { file: ThreadFile; own: boolean }) {
  const Icon = fileIcon(file.name);
  const pdf = kindFromName(file.name) === "pdf";
  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2",
        own ? "bg-white/10 ring-1 ring-white/10" : "bg-paper ring-1 ring-line",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          own ? "bg-lime text-pine-deep" : "bg-pine-50 text-pine",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <a
        href={pdf ? fileUrl(file.id, true) : fileUrl(file.id)}
        target={pdf ? "_blank" : undefined}
        rel={pdf ? "noopener noreferrer" : undefined}
        className="min-w-0 flex-1"
      >
        <span className={cn("block truncate text-[13px] font-semibold", own ? "text-snow" : "text-pine-deep")}>
          {file.name}
        </span>
        <span className={cn("block font-ui text-[11px]", own ? "text-snow/60" : "text-slate")}>
          <bdi>{extLabel(file.name)}</bdi> · <bdi>{formatBytes(file.size)}</bdi>
        </span>
      </a>
      <a
        href={fileUrl(file.id)}
        download={file.name}
        aria-label={`تنزيل ${file.name}`}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
          own ? "text-snow/70 hover:bg-white/10 hover:text-snow" : "text-slate hover:bg-surface hover:text-pine-deep",
        )}
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}
