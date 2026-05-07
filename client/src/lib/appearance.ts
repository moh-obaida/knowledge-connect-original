export type AppearanceMode = "light" | "mid" | "dark";
export type VisualTheme = "classic" | "school" | "space" | "ramadan" | "science" | "vibrant";

export const APPEARANCE_KEY = "kc_appearance";
export const THEME_KEY = "kc_theme";

export const themeAccent: Record<VisualTheme, string> = {
  classic: "#f59e0b",
  school: "#0ea5e9",
  space: "#8b5cf6",
  ramadan: "#22c55e",
  science: "#06b6d4",
  vibrant: "#ec4899",
};

export function readAppearanceMode(): AppearanceMode {
  const v = typeof window !== "undefined" ? localStorage.getItem(APPEARANCE_KEY) : null;
  return v === "light" || v === "mid" || v === "dark" ? v : "dark";
}

export function readVisualTheme(): VisualTheme {
  const v = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
  return v === "classic" || v === "school" || v === "space" || v === "ramadan" || v === "science" || v === "vibrant" ? v : "classic";
}

export function appearanceSurface(mode: AppearanceMode) {
  if (mode === "light") return { bg: "#f8fafc", card: "#ffffff", text: "#0f172a", muted: "#475569", border: "#dbe2ea" };
  if (mode === "mid") return { bg: "#141b2d", card: "#1a2335", text: "#e2e8f0", muted: "#94a3b8", border: "#2a3448" };
  return { bg: "#090d18", card: "#0f1623", text: "#f0ede8", muted: "#94a3b8", border: "#1a2332" };
}

export function appearanceGradient(mode: AppearanceMode, theme: VisualTheme) {
  const accent = themeAccent[theme];
  if (mode === "light") return `radial-gradient(circle at top, ${accent}20 0%, #f8fafc 55%)`;
  if (mode === "mid") return `radial-gradient(circle at top, ${accent}33 0%, #141b2d 60%)`;
  return `radial-gradient(circle at top, ${accent}33 0%, #090d18 60%)`;
}
