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
          let isRussian = false;
          
          try {
            const sdkModule = await import('@twa-dev/sdk');
            const WebApp = sdkModule.default;
            if (WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase().startsWith('ru')) {
              isRussian = true;
            }
          } catch (e) {
            console.warn('TWA SDK not available for language check');
          }

          if (!isRussian && typeof navigator !== 'undefined' && navigator.language) {
            if (navigator.language.toLowerCase().startsWith('ru')) {
              isRussian = true;
            }
          }

          const langToSet = isRussian ? 'ru' : 'en';
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
