/**
 * DashboardScreen.tsx — Landing page after login.
 *
 * Shows a personalised greeting and role badge.
 * Future modules will add stat cards and charts here.
 */

import React from "react";
import { LayoutDashboard } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ROLE_LABELS } from "../lib/permissions";

export default function DashboardScreen() {
  const { currentUser, t } = useApp();
  if (!currentUser) return null;

  const roleKey = `role.${currentUser.role}` as const;

  return (
    <div className="p-8 animate-fade-in">
      {/* Page heading */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {t("dashboard.welcome")}, {currentUser.full_name}!
          </h1>
          <p className="text-slate-500 text-sm">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      {/* Role badge card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
          {t("dashboard.role_label")}
        </p>
        <span className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full text-sm">
          {t(roleKey) || ROLE_LABELS[currentUser.role]}
        </span>
        <p className="mt-4 text-slate-500 text-sm leading-relaxed">
          You are logged in as <strong>{currentUser.username}</strong>.
          Use the sidebar to navigate to the modules available for your role.
        </p>
      </div>
    </div>
  );
}
