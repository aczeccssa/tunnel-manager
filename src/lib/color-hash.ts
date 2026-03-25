// Generate a consistent color from a string (e.g., profile name)
// Returns an HSL color string

const PRESET_COLORS = [
  { h: 211, s: 94, l: 53 },  // Blue
  { h: 142, s: 71, l: 45 },  // Green
  { h: 30, s: 95, l: 54 },   // Orange
  { h: 340, s: 82, l: 55 },  // Pink
  { h: 263, s: 52, l: 58 },  // Purple
  { h: 175, s: 63, l: 40 },  // Teal
  { h: 15, s: 91, l: 55 },   // Red
  { h: 45, s: 93, l: 49 },   // Yellow
  { h: 200, s: 80, l: 52 },  // Cyan
  { h: 280, s: 60, l: 55 },  // Violet
  { h: 0, s: 0, l: 55 },     // Gray
  { h: 25, s: 90, l: 52 },   // Amber
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getColorForString(str: string): {
  bg: string;
  text: string;
  border: string;
} {
  const index = hashString(str) % PRESET_COLORS.length;
  const color = PRESET_COLORS[index];
  return {
    bg: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
    text: `hsl(${color.h}, ${color.s}%, 95%)`,
    border: `hsl(${color.h}, ${color.s}%, ${color.l - 10}%)`,
  };
}

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
