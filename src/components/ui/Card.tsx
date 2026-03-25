import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = "", onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[var(--color-surface)] rounded-[var(--radius-card)]
        border border-[var(--color-border)]
        shadow-sm
        transition-all duration-300 ease-out
        ${hoverable ? "cursor-pointer hover:border-outline" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
