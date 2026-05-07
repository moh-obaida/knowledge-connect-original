export function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSave<T>(key: string, value: T) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage unavailability
  }
}

export function safeRemove(key: string) {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
