interface FilterMenuItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function FilterMenuItem({ label, active, onClick }: FilterMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-2 text-[13px] font-medium text-left transition-colors
        hover:bg-surface-container
        ${active ? "text-primary" : "text-on-surface"}
      `}
    >
      {label}
      {active && <span className="material-symbols-outlined text-[16px]">check</span>}
    </button>
  );
}
