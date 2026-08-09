import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/** Real scannable QR for a ticket. Renders to canvas in the print-shop palette. */
export function TicketQR({
  value,
  size = 128,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1813", light: "#fffdf6" },
    }).catch(() => {
      /* value too long or unsupported — fall back to nothing */
    });
  }, [value, size]);

  if (!value) return null;

  return (
    <div className={className}>
      <canvas
        ref={ref}
        style={{ width: size, height: size }}
        className="border-2 border-ink bg-card"
        role="img"
        aria-label={`QR code for ticket ${value}`}
      />
    </div>
  );
}
