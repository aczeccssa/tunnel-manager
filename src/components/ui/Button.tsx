import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  loading,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer select-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-5 py-2.5 text-base rounded-xl",
  };

  const variantClasses = {
    primary: "text-on-primary shadow-sm hover:shadow active:scale-[0.98] bg-primary hover:bg-primary-dim border border-transparent",
    secondary: "text-on-surface bg-surface-container border border-outline-variant shadow-sm hover:bg-surface-container-high active:scale-[0.98]",
    danger: "text-on-error bg-error shadow-sm hover:shadow active:scale-[0.98] border border-transparent hover:bg-error-dim",
    ghost: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-[0.98]",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled || loading ? "opacity-50 cursor-not-allowed hover:shadow-none" : ""} ${className}`}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
