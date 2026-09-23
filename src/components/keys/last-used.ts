import { formatRelative } from "@/components/admin/format";

/** "Last used" in words: relative time, or a never-used note. */
export function lastUsedText(iso: string | null, now: number) {
  return iso ? formatRelative(new Date(iso), now) : "لم يُستخدم بعد";
}
