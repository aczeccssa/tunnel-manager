import type { ReactNode } from "react";
import type { RuntimeStatus } from "../../types";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "idle";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-surface-variant/20 text-on-surface-variant",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  info: "bg-info/15 text-info",
  idle: "bg-surface-variant/10 text-on-surface-variant/60",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-[11px] font-medium",
  md: "px-2.5 py-1 text-xs font-medium",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-[var(--radius-badge)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Status badge specifically for runtime status
export function StatusBadge({ status }: { status: RuntimeStatus }) {
  const config: Record<RuntimeStatus, { label: string; variant: BadgeProps["variant"] }> = {
    IDLE: { label: "Idle", variant: "idle" },
    CONNECTING: { label: "Connecting", variant: "info" },
    RUNNING: { label: "Operational", variant: "success" },
    RECONNECTING: { label: "Reconnecting", variant: "warning" },
    STOPPING: { label: "Stopping", variant: "warning" },
    ERROR: { label: "Error", variant: "error" },
  };

  const { label, variant } = config[status];
  return (
    <Badge variant={variant} size="sm">
      {status === "RUNNING" && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {label}
    </Badge>
  );
}

// Mode badge for L/R/D
export function ModeBadge({ mode }: { mode: string }) {
  const labels: Record<string, string> = {
    LOCAL: "L1",
    REMOTE: "R1",
    DYNAMIC: "D1",
  };
  return (
    <Badge variant="success" size="sm" className="bg-success/15 text-success">
      {labels[mode] || mode}
    </Badge>
  );
}
