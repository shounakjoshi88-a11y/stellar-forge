import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmWord?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmWord,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const requireWord = !!confirmWord;
  const ready = !requireWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  const handleConfirm = () => {
    if (!ready) return;
    onConfirm();
    onClose();
    setTyped("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4">
      <div className="paper-card w-full max-w-md p-8 animate-fade-up">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span
              className={`w-11 h-11 border-2 border-ink flex items-center justify-center ${
                destructive ? "bg-red text-paper" : "bg-lime text-ink"
              }`}
            >
              <TriangleAlert className="w-6 h-6" />
            </span>
            <h2 className="display text-3xl leading-none">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 border-2 border-ink bg-paper-2 flex items-center justify-center hover:bg-red hover:text-paper transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-ink-soft mb-6">{message}</p>

        {requireWord && (
          <div className="space-y-2 mb-6">
            <label className="label-mono text-ink">
              Type <span className="bg-red text-paper px-1.5 py-0.5 border-2 border-ink">{confirmWord}</span> to {confirmLabel.toLowerCase()}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder={confirmWord}
              className="input"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleConfirm}
            disabled={!ready}
            className={`btn flex-1 ${destructive ? "btn-red" : "btn-ink"} disabled:opacity-40 disabled:pointer-events-none`}
          >
            {confirmLabel}
          </button>
          <button onClick={onClose} className="btn btn-ghost">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
