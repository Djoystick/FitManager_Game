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
        } else {
          const sdkModule = await import('@twa-dev/sdk');
          const WebApp = sdkModule.default;
          const twaLang = WebApp.initDataUnsafe?.user?.language_code;
          if (twaLang === 'ru') {
            setLanguageState('ru');
          } else {
            setLanguageState('en');
          }
        }
      } catch (e) {
        console.warn('LanguageContext init error', e);
      }
    };
    initLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fitmanager_lang', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
