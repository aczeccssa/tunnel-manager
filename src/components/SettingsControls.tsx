import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-6 bg-primary rounded-full"></span>
        <h3 className="font-headline text-lg font-semibold text-on-surface">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors ${
        checked ? "bg-primary" : "bg-surface-container"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full transition-transform ${
          checked ? "translate-x-5 bg-on-primary" : "translate-x-0 bg-on-surface-variant"
        }`}
      />
    </button>
  );
}
