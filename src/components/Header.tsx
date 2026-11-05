/**
 * Header.tsx — Top header bar with language switch and environment status.
 */

import React from "react";
import { Globe, Monitor, Laptop } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Language } from "../types";
import { isElectron } from "../lib/api";

export default function Header() {
  const { language, setLanguage } = useApp();

  return (
    <header
      className="flex items-center justify-between px-6 bg-white border-b border-slate-100 shadow-sm shrink-0"
      style={{ height: "var(--header-height)" }}
    >
      {/* Environment indicator */}
      <div className="flex items-center gap-2">
        {isElectron ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Monitor className="w-3.5 h-3.5" />
            Desktop Mode (SQLite Active)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Laptop className="w-3.5 h-3.5" />
            Browser Preview
          </span>
        )}
      </div>

      {/* Language switcher */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-400" />
        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(["en", "ml"] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1.5 font-medium transition ${
                language === lang
                  ? "bg-primary-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lang === "en" ? "EN" : "മല"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
