interface SelectProps {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function Select({
  label,
  error,
  value,
  onChange,
  options,
  disabled,
  required,
  className = "",
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-[var(--color-text-primary)] pl-1">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={`
          w-full px-3.5 py-2.5 text-sm
          bg-[var(--color-surface)]/60 backdrop-blur-md text-[var(--color-text-primary)]
          border border-[var(--color-border)] rounded-[var(--radius-input)] shadow-sm
          focus:outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--color-surface)]
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:border-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)]/80
          cursor-pointer
          appearance-none
          ${error ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20" : ""}
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          paddingRight: "36px",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-[var(--color-error)] pl-1">{error}</span>
      )}
    </div>
  );
}
