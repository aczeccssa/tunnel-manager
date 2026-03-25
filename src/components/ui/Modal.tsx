import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showClose?: boolean;
}

const sizeWidths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "xl",
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className={`
          w-full ${sizeWidths[size]}
          glass-panel rounded-xl
          shadow-[var(--shadow-modal)]
          overflow-hidden flex flex-col max-h-[90vh]
          animate-in fade-in zoom-in-95 duration-200 ease-out
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simple Header for general modals like Delete */}
        {title && (
          <header className="px-6 py-4 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              {title}
            </h2>
            {showClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </header>
        )}

        {/* Content (No padding here so custom forms can handle it) */}
        {children}
      </div>
    </div>
  );
}
