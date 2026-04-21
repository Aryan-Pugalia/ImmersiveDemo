import React, { createContext, useContext, useState } from "react";
import { en, type Translations } from "@/i18n/en";
import { ko } from "@/i18n/ko";

export type Language = "en" | "ko";

const LANGS: Record<Language, Translations> = { en, ko };

interface LanguageContextValue {
  language: Language;
  setLanguage: (l: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem("fabstudio_lang");
    return (stored === "en" || stored === "ko") ? stored : "en";
  });

  const setLanguage = (l: Language) => {
    setLang(l);
    localStorage.setItem("fabstudio_lang", l);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: LANGS[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
