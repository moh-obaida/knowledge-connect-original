import { safeLoad, safeSave } from "./localData";

export type AppSettings = {
  theme: "light" | "dark" | "soft" | "high-contrast";
  colorBlindMode: boolean;
  reducedMotion: boolean;
  largerText: boolean;
  visualFeedback: boolean;
};

const KEY = "kc_app_settings";
const defaults: AppSettings = { theme: "dark", colorBlindMode: false, reducedMotion: false, largerText: false, visualFeedback: true };

export function loadAppSettings(): AppSettings {
  const s = safeLoad<AppSettings>(KEY, defaults);
  const old = typeof window !== "undefined" ? localStorage.getItem("kc_appearance") : null;
  if (old === "contrast") s.theme = "high-contrast";
  if (old === "soft" || old === "mid") s.theme = "soft";
  if (old === "light") s.theme = "light";
  return { ...defaults, ...s };
}

export function saveAppSettings(settings: AppSettings) {
  safeSave(KEY, settings);
  if (typeof window !== "undefined") localStorage.setItem("kc_appearance", settings.theme === "high-contrast" ? "contrast" : settings.theme);
}
