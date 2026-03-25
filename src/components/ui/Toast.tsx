import { useEffect, useState, useRef } from "react";
import { create } from "zustand";

export interface ToastData {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastStore {
  toasts: ToastData[];
  add: (toast: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: Math.random().toString(36).slice(2) },
      ],
    })),
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// ============================================================
// Toast Container Component
// ============================================================

const toastStyles: Record<string, string> = {
  success: "border-[var(--color-success)] bg-[var(--color-success)]/10",
  error: "border-[var(--color-error)] bg-[var(--color-error)]/10",
  warning: "border-[var(--color-warning)] bg-[var(--color-warning)]/10",
  info: "border-[var(--color-accent)] bg-[var(--color-accent)]/10",
};

const iconStyles: Record<string, string> = {
  success: "text-[var(--color-success)]",
  error: "text-[var(--color-error)]",
  warning: "text-[var(--color-warning)]",
  info: "text-[var(--color-accent)]",
};

const iconPaths: Record<string, string> = {
  success: "M5 13l4 4L19 7",
  error: "M6 18L18 6M6 6l12 12",
  warning: "M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setVisible(true);
    const duration = toast.duration ?? 4000;
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3
        bg-[var(--color-bg)] border rounded-[var(--radius-card)]
        shadow-[var(--shadow-modal)]
        transition-all duration-200
        ${toastStyles[toast.type] ?? ""}
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}
      `}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconStyles[toast.type] ?? ""}
      >
        <path d={iconPaths[toast.type] ?? ""} />
      </svg>
      <span className="text-sm text-[var(--color-text-primary)]">{toast.message}</span>
      <button
        onClick={handleDismiss}
        className="ml-2 p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
