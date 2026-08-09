import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  text: string;
}

interface ToastContextValue {
  toast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const MAX_TOASTS = 4;
const AUTO_DISMISS_MS = 3800;

const toastMeta: Record<ToastType, { cls: string; Icon: typeof Info }> = {
  success: { cls: "bg-lime text-ink", Icon: CheckCircle2 },
  error: { cls: "bg-red text-paper", Icon: XCircle },
  info: { cls: "bg-orange text-paper", Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, type, text }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-[360px] max-w-[calc(100vw-3rem)] pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => {
              const meta = toastMeta[t.type];
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 80, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 80, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className={`border-2 border-ink shadow-[6px_6px_0_#1c1813] p-4 flex items-start gap-3 pointer-events-auto ${meta.cls}`}
                >
                  <span className="flex items-center gap-2">
                    <meta.Icon className="w-5 h-5 shrink-0" />
                    <p className="font-mono text-xs font-bold uppercase tracking-wide leading-snug">{t.text}</p>
                  </span>
                  <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-auto opacity-70 hover:opacity-100 transition-opacity shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}