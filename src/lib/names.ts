/**
 * Words that only make sense with the word after them: a kunya (أبو فيصل،
 * أم خالد), a compound of عبد (عبد الله) or a patronymic (بن سعد). Greeting
 * someone by the first word alone would say "أهلًا، أبو".
 */
const BOUND = new Set(["أبو", "ابو", "أبا", "ابا", "أم", "ام", "عبد", "بن", "ابن", "بنت"]);

/** The name to greet someone by: the first word, or the first two when it's a kunya/compound. */
export function firstName(fullName: string | null | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length > 1 && BOUND.has(words[0])) return `${words[0]} ${words[1]}`;
  return words[0];
}
