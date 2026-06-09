'use client';

import React, { createContext, useState, ReactNode, useEffect } from 'react';

type Language = 'en' | 'ru';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const initLanguage = async () => {
      try {
        const saved = localStorage.getItem('fitmanager_lang');
        if (saved === 'ru' || saved === 'en') {
          setLanguageState(saved);
          document.cookie = `fitmanager_lang=${saved}; path=/; max-age=31536000`;
        } else {
          const sdkModule = await import('@twa-dev/sdk');
          const WebApp = sdkModule.default;
          const twaLang = WebApp.initDataUnsafe?.user?.language_code;
          const langToSet = twaLang === 'ru' ? 'ru' : 'en';
          setLanguageState(langToSet);
          localStorage.setItem('fitmanager_lang', langToSet);
          document.cookie = `fitmanager_lang=${langToSet}; path=/; max-age=31536000`;
        }
      } catch (e) {
        console.warn('LanguageContext init error', e);
      }
    };
    initLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    // Only reload if the language actually changes
    if (lang !== language) {
      setLanguageState(lang);
      localStorage.setItem('fitmanager_lang', lang);
      document.cookie = `fitmanager_lang=${lang}; path=/; max-age=31536000`;
      window.location.reload();
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
