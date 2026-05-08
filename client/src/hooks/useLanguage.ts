import { useEffect, useState } from 'react';
import { applyLanguage, getDirection, getLanguage, setLanguage, subscribeLanguage, t, toggleLanguage, type Language } from '@/lib/i18n';

export function useLanguage() {
  const [language, setLangState] = useState<Language>(getLanguage());
  useEffect(() => {
    applyLanguage(language);
    return subscribeLanguage(() => setLangState(getLanguage()));
  }, [language]);
  return { language, dir: getDirection(language), t: (key: string) => t(key, language), setLanguage, toggleLanguage };
}
