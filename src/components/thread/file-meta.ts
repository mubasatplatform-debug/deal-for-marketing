import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { FILE_KINDS, kindFromName, type FileKind } from "@/lib/files/validate";

const ICON: Partial<Record<FileKind, LucideIcon>> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
  zip: FileArchive,
  mp4: FileVideo,
  mov: FileVideo,
  ai: FileImage,
  psd: FileImage,
};

export function fileIcon(name: string): LucideIcon {
  const kind = kindFromName(name);
  if (!kind) return File;
  return ICON[kind] ?? (FILE_KINDS[kind].image ? FileImage : File);
}

export function isImage(name: string): boolean {
  const kind = kindFromName(name);
  return Boolean(kind && FILE_KINDS[kind].image && FILE_KINDS[kind].inline);
}

/** "PDF" / "DOCX" badge text for a file name. */
export function extLabel(name: string): string {
  return (/\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1] ?? "").toUpperCase();
}

