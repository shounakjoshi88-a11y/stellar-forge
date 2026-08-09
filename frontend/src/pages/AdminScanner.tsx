import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsQR from "jsqr";
import { ScanLine, Keyboard, Camera, Check, X, RotateCcw, AlertTriangle } from "lucide-react";
import { API_URL } from "../config.js";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<{ rawValue: string }[]>;
      };
    };
  }
}

// Camera capability is about getUserMedia, NOT about the browser exposing
// BarcodeDetector. Desktop Chrome has no BarcodeDetector but a perfectly good
// camera — we decode frames with jsQR in that case.
const supportsMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const supportsNativeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

interface ScanResult {
  key: number;
  valid: boolean;
  direction?: string;
  reason?: string;
  message: string;
  attendee?: string;
  eventCode?: string;
  usedCount?: number;
}

export function AdminScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef(false);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [cameraOk, setCameraOk] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [decoder, setDecoder] = useState<"native" | "jsqr">("jsqr");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [log, setLog] = useState<ScanResult[]>([]);

  const codeHandlerRef = useRef<(code: string) => void>(() => {});

  // Lifecycle of the camera stream. Always tries to open the camera (so the
  // permission prompt actually appears), then decodes QR frames either with the
  // native BarcodeDetector or jsQR-scanning a canvas snapshot.
  useEffect(() => {
    if (mode !== "camera") return;
    if (!supportsMedia) {
      setCameraDenied(true);
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraDenied(false);
        setCameraOk(true);

        const detector =
          supportsNativeDetector && window.BarcodeDetector
            ? new window.BarcodeDetector({ formats: ["qr_code"] })
            : null;
        setDecoder(detector ? "native" : "jsqr");

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");

        interval = setInterval(async () => {
          const video = videoRef.current;
          if (!video || !canvas || !ctx) return;
          try {
            let raw: string | null = null;
            if (detector) {
              const codes = await detector.detect(video);
              raw = codes[0]?.rawValue ?? null;
            } else {
              // jsQR fallback: grab the current frame onto a canvas.
              const w = Math.max(1, Math.floor((video.videoWidth || 640) / 2));
              const h = Math.max(1, Math.floor((video.videoHeight || 480) / 2));
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const code = jsQR(img.data, w, h);
              raw = code?.data ?? null;
            }
            if (raw && raw.trim() && !cooldownRef.current) {
              codeHandlerRef.current(raw);
            }
          } catch {
            /* keep scanning */
          }
        }, 250);
      } catch {
        // Permission denied, no camera, or getUserMedia blocked.
        setCameraOk(false);
        setCameraDenied(true);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  const retryCamera = () => {
    setCameraDenied(false);
    // Bounce through Manual → Camera to force a fresh stream request.
    if (mode === "camera") setMode("manual");
    setTimeout(() => setMode("camera"), 50);
  };

  const handleCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    cooldownRef.current = true;

    try {
      const res = await axios.post(`${API_URL}/admin/tickets/scan`, { code: trimmed });
      const d = res.data;
      const r: ScanResult = {
        key: Date.now(),
        valid: d.valid,
        direction: d.direction,
        usedCount: d.usedCount,
        attendee: d.attendee,
        eventCode: d.event?.title,
        message: d.message || (d.direction === "entry" ? "Entry is clear — welcome to the floor." : "Exit confirmed. Door's open."),
      };
      setResult(r);
      setLog((prev) => [r, ...prev].slice(0, 8));
    } catch (err: any) {
      const r: ScanResult = {
        key: Date.now(),
        valid: false,
        message: err.response?.data?.message || "Scanner jammed — couldn't reach the door.",
        reason: err.response?.data?.reason,
      };
      setResult(r);
      setLog((prev) => [r, ...prev].slice(0, 8));
    } finally {
      cooldownRef.current = false;
      setManualCode("");
    }
  };

  codeHandlerRef.current = handleCode;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    handleCode(manualCode);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-4 mb-5">
          <span className="stamp text-green">DOOR 01</span>
          <span className="label-mono text-ink-soft">SCAN-TO-ENTER · SCAN-TO-LEAVE</span>
        </div>
        <h1 className="display text-5xl md:text-6xl mb-4">
          Gate <span className="bg-lime text-ink px-2 border-2 border-ink inline-block -rotate-1">Scanner</span>
        </h1>
        <p className="text-ink-soft">One pass per ticket: first scan opens the door, second scan closes it.</p>
      </header>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
        {/* Scanner */}
        <div className="paper-card p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="label-mono text-ink-soft">LIVE FEED</span>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("camera")}
                disabled={!supportsMedia}
                className={`btn !px-3 !py-1.5 text-xs ${mode === "camera" ? "btn-ink" : "btn-ghost"} ${!supportsMedia ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Camera className="w-4 h-4" /> Camera
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`btn !px-3 !py-1.5 text-xs ${mode === "manual" ? "btn-ink" : "btn-ghost"}`}
              >
                <Keyboard className="w-4 h-4" /> Manual
              </button>
            </div>
          </div>

          <div className="relative aspect-video bg-ink border-2 border-ink overflow-hidden">
            {mode === "camera" ? (
              !supportsMedia ? (
                <div className="absolute inset-0 flex items-center justify-center text-paper">
                  <p className="label-mono text-center px-4">This browser can't access a camera. Switch to Manual.</p>
                </div>
              ) : (
                <>
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraOk && !cameraDenied && (
                    <div className="absolute inset-0 flex items-center justify-center text-paper">
                      <p className="label-mono text-center px-4 animate-blink">
                        Requesting camera access…
                      </p>
                    </div>
                  )}
                  {cameraDenied && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-paper px-6 text-center">
                      <AlertTriangle className="w-8 h-8 text-orange" />
                      <p className="label-mono">
                        No camera feed. Grant camera permission in the browser address bar,
                        plug in a webcam, then try again.
                      </p>
                      <button onClick={retryCamera} className="btn btn-lime !py-2">
                        <RotateCcw className="w-4 h-4" /> Retry Camera
                      </button>
                    </div>
                  )}
                  {cameraOk && (
                    <span className="absolute top-3 left-3 bg-paper text-ink label-mono text-[9px] px-2 py-1 border-2 border-ink">
                      ● LIVE — POINT AT QR • {decoder === "native" ? "NATIVE" : "JSW"}
                    </span>
                  )}
                </>
              )
            ) : (
              <form onSubmit={submitManual} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                <p className="label-mono text-paper">USB SCANNERS TYPE HERE + ENTER</p>
                <input
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="TKT-…"
                  className="w-full max-w-sm bg-paper text-ink font-mono px-4 py-3 border-2 border-ink placeholder:text-ink-soft outline-none"
                />
                <button type="submit" className="btn btn-lime !py-2">
                  <ScanLine className="w-4 h-4" /> Scan
                </button>
              </form>
            )}
          </div>

          {/* Result + log */}
          <div className="mt-5 min-h-[150px]">
            {result ? (
              <div
                key={result.key}
                className={`border-4 p-5 animate-fade-up ${
                  result.valid
                    ? result.direction === "entry"
                      ? "border-ink bg-lime text-ink"
                      : "border-ink bg-blue text-paper"
                    : "bg-red text-paper border-ink"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="display text-3xl">
                    {result.valid
                      ? result.direction === "entry"
                        ? "ENTRY GRANTED"
                        : "EXIT CONFIRMED"
                      : "REJECTED"}
                  </span>
                  {result.valid ? <Check className="w-8 h-8" /> : <X className="w-8 h-8" />}
                </div>
                <p className="font-mono text-sm">{result.message}</p>
                {result.attendee && (
                  <p className="font-mono text-xs uppercase tracking-wider mt-1 opacity-80">
                    {result.attendee} · {result.eventCode}
                    {typeof result.usedCount === "number" && ` · use ${result.usedCount}/2`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-ink-soft label-mono text-center py-10">Awaiting first scan…</p>
            )}
          </div>
        </div>

        {/* Recent scans */}
        <div className="paper-card p-6">
          <h2 className="display text-xl mb-5 flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-orange" /> Recent Scans
          </h2>
          {log.length === 0 ? (
            <p className="text-ink-soft font-mono text-xs uppercase tracking-widest">Nothing scanned yet</p>
          ) : (
            <ul className="space-y-3">
              {log.map((s, i) => (
                <li key={s.key} className="border-b-2 border-dashed border-ink pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 ${s.valid ? (s.direction === "entry" ? "bg-lime" : "bg-blue") : "bg-red"} border-2 border-ink`}
                    />
                    <span className="font-mono text-xs font-bold uppercase tracking-wide">
                      {s.valid ? `use ${s.usedCount}/2 · ${s.direction}` : "rejected"}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-ink-soft mt-1">{s.attendee ? `${s.attendee} · ${s.eventCode}` : s.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}