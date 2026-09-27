import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";

/**
 * A draft's text → a right-to-left Word file — **server-only**. Understands
 * the light format the drafts use: «# » title, «## » headings, numbered and
 * «- » items, **bold** spans; everything else is a justified paragraph.
 */

const FONT = "Traditional Arabic";
const BODY_SIZE = 32; // half-points: 16 pt
const TITLE_SIZE = 40;
const HEADING_SIZE = 34;

function runs(text: string, opts: { bold?: boolean; size?: number } = {}): TextRun[] {
  const out: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const p of parts) {
    const bold = p.startsWith("**") && p.endsWith("**");
    out.push(
      new TextRun({
        text: bold ? p.slice(2, -2) : p,
        bold: opts.bold || bold,
        size: opts.size ?? BODY_SIZE,
        font: { name: FONT, cs: FONT, hint: "cs" },
        rightToLeft: true,
        boldComplexScript: opts.bold || bold,
        sizeComplexScript: opts.size ?? BODY_SIZE,
      }),
    );
  }
  return out;
}

function para(children: TextRun[], extra: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.BOTH,
    spacing: { after: 120, line: 360 },
    ...extra,
    children,
  });
}

export function draftParagraphs(body: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#\s+/.test(line)) {
      out.push(para(runs(line.replace(/^#\s+/, ""), { bold: true, size: TITLE_SIZE }), { alignment: AlignmentType.CENTER, spacing: { after: 280 } }));
    } else if (/^#{2,}\s+/.test(line)) {
      out.push(para(runs(line.replace(/^#{2,}\s+/, ""), { bold: true, size: HEADING_SIZE }), { alignment: undefined, spacing: { before: 240, after: 120 } }));
    } else if (/^[-•*]\s+/.test(line)) {
      out.push(para(runs(`• ${line.replace(/^[-•*]\s+/, "")}`), { indent: { start: 360 } }));
    } else if (/^[0-9٠-٩]+[.)-]\s+/.test(line)) {
      out.push(para(runs(line), { indent: { start: 360 } }));
    } else {
      out.push(para(runs(line)));
    }
  }
  return out.length ? out : [para(runs(" "))];
}

export async function draftToDocx(body: string, meta: { title: string; office: string }): Promise<Uint8Array> {
  const doc = new Document({
    title: meta.title,
    creator: meta.office,
    styles: {
      default: {
        document: { run: { font: { name: FONT, cs: FONT }, size: BODY_SIZE, rightToLeft: true } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1300, right: 1300 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], size: 20, font: FONT }),
                ],
              }),
            ],
          }),
        },
        children: draftParagraphs(body),
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
