/** The inbox page tells the nav badge to refresh after reading or replying. */
export const INBOX_CHANGED = "law-inbox:changed";

export function inboxChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INBOX_CHANGED));
}
