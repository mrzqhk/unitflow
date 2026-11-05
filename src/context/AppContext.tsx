/**
 * AppContext.tsx — Global state for the logged-in user and language.
 *
 * Provides:
 *  - currentUser / setCurrentUser
 *  - language / setLanguage
 *  - t() — translation function for the active language
 */

import React, { createContext, useContext, useState } from "react";
import { User, Language } from "../types";
import { getT } from "../i18n";

interface AppContextValue {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translate a key into the active language. Falls back to English. */
  t: (key: string) => string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Default language from localStorage so it persists across sessions
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem("uf_lang") as Language) ?? "en"
  );

  const setLanguage = (lang: Language) => {
    localStorage.setItem("uf_lang", lang);
    setLanguageState(lang);
  };

  const t = getT(language);

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, language, setLanguage, t }}>
      {children}
    </AppContext.Provider>
  );
}

/** Hook to access the app context from any component. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
