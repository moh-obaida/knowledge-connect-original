import { useMemo, useState } from "react";
import { loadAppSettings, saveAppSettings, type AppSettings } from "../lib/appSettings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const update = (next: Partial<AppSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveAppSettings(merged);
  };
  const textScale = useMemo(() => (settings.largerText ? 1.08 : 1), [settings.largerText]);
  return { settings, update, textScale };
}
