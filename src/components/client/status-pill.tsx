import { Check } from "lucide-react";
import { Pill } from "@/components/dash/ui";
import { isDelivered, statusLabel, statusTone } from "./status";

/** Status as a Pill. Delivered swaps the dot for a check and stays quiet. */
export function StatusPill({ status }: { status: string }) {
  const done = isDelivered(status);
  return (
    <Pill tone={statusTone(status)} dot={!done}>
      {done ? <Check aria-hidden="true" className="-ms-0.5 size-3" strokeWidth={3} /> : null}
      {statusLabel(status)}
    </Pill>
  );
}
