interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

export function Input({
  label,
  error,
  hint,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  required,
  className = "",
  autoFocus,
  onBlur,
}: InputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-[var(--color-text-primary)] pl-1">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onBlur={onBlur}
        className={`
          w-full px-3.5 py-2.5 text-sm
          bg-[var(--color-surface)]/60 backdrop-blur-md text-[var(--color-text-primary)]
          border border-[var(--color-border)] rounded-[var(--radius-input)] shadow-sm
          placeholder:text-[var(--color-text-tertiary)]
          focus:outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--color-surface)]
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:border-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)]/80
          ${error ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20" : ""}
        `}
      />
      {error && (
        <span className="text-xs text-[var(--color-error)] pl-1">{error}</span>
      )}
      {hint && !error && (
        <span className="text-xs text-[var(--color-text-tertiary)] pl-1">{hint}</span>
      )}
    </div>
  );
}
