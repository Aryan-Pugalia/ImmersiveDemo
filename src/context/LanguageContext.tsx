import React, { createContext, useContext, useEffect, useState } from "react";
import { en, type Translations } from "@/i18n/en";
import { ko } from "@/i18n/ko";
import { es } from "@/i18n/es";
import { fr } from "@/i18n/fr";
import { ar } from "@/i18n/ar";
import { zh } from "@/i18n/zh";

export type Language = "en" | "ko" | "es" | "fr" | "ar" | "zh";

const LANGS: Record<Language, Translations> = { en, ko, es, fr, ar, zh };

const VALID: Language[] = ["en", "ko", "es", "fr", "ar", "zh"];

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
    return VALID.includes(stored as Language) ? (stored as Language) : "en";
  });

  const setLanguage = (l: Language) => {
    setLang(l);
    localStorage.setItem("fabstudio_lang", l);
  };

  // Set HTML dir and lang attributes for RTL/LTR and accessibility
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: LANGS[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
