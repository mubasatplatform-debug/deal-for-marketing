import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A QR code drawn as one SVG path in the browser (qrcode-generator, pure
 * JS) — crisp on screen and in print, no network, no canvas.
 */
export function QrCode({ value, size = 132, label }: { value: string; size?: number; label: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) {
        if (qr.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
      }
    }
    return { d: path, n: count + 8 };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="block bg-white"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
