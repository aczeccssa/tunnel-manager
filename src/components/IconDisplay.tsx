import { getColorForString, getInitials } from "../lib/color-hash";

interface IconDisplayProps {
  name: string;
  iconType: "custom" | "generated";
  iconPath?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export function IconDisplay({
  name,
  iconType,
  iconPath,
  size = "md",
  className = "",
}: IconDisplayProps) {
  if (iconType === "custom" && iconPath) {
    return (
      <img
        src={iconPath}
        alt={name}
        className={`${sizeMap[size]} rounded-[var(--radius-input)] object-cover ${className}`}
      />
    );
  }

  const { bg, text } = getColorForString(name);
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeMap[size]} rounded-[var(--radius-input)] flex items-center justify-center font-semibold select-none ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {initials}
    </div>
  );
}
