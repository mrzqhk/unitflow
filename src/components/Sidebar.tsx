/**
 * Sidebar.tsx — Left navigation sidebar.
 *
 * Only shows menu items the logged-in user's role is permitted to access.
 * Permission check uses lib/permissions.ts (same logic as the main process).
 */

import React from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Palette,
  Factory,
  Boxes,
  Truck,
  BookOpen,
  UserCog,
  LogOut,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { canAccess, Screen } from "../lib/permissions";
import { cn } from "../lib/utils";

// Map each screen to its nav item config
const NAV_ITEMS: {
  screen: Screen;
  labelKey: string;
  icon: React.ElementType;
}[] = [
  { screen: "dashboard",  labelKey: "nav.dashboard",  icon: LayoutDashboard },
  { screen: "customers",  labelKey: "nav.customers",  icon: Users },
  { screen: "products",   labelKey: "nav.products",   icon: Package },
  { screen: "sales",      labelKey: "nav.sales",       icon: ShoppingCart },
  { screen: "design",     labelKey: "nav.design",      icon: Palette },
  { screen: "production", labelKey: "nav.production",  icon: Factory },
  { screen: "store",      labelKey: "nav.store",       icon: Boxes },
  { screen: "delivery",   labelKey: "nav.delivery",    icon: Truck },
  { screen: "accounts",   labelKey: "nav.accounts",    icon: BookOpen },
  { screen: "users",      labelKey: "nav.users",       icon: UserCog },
];

interface Props {
  activeScreen: Screen;
  onNavigate:   (screen: Screen) => void;
  onLogout:     () => void;
}

export default function Sidebar({ activeScreen, onNavigate, onLogout }: Props) {
  const { currentUser, t } = useApp();
  if (!currentUser) return null;

  return (
    <aside
      className="flex flex-col shrink-0 h-full select-none"
      style={{ width: "var(--sidebar-width)", background: "#1e2a3a" }}
    >
      {/* ── Logo area ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          UF
        </div>
        <div>
          <span className="text-white font-semibold text-base tracking-tight block leading-tight">UnitFlow</span>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Manufacturing</span>
        </div>
      </div>

      {/* ── Nav items ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV_ITEMS.filter(item => canAccess(currentUser.role, item.screen)).map(item => {
          const Icon     = item.icon;
          const isActive = activeScreen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => onNavigate(item.screen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-primary-600 text-white shadow-md font-semibold"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* ── User info + logout ─────────────────────────────────────────── */}
      <div className="border-t border-white/5 px-3 py-3">
        {/* User name & role */}
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-medium leading-tight truncate">
            {currentUser.full_name}
          </p>
          <p className="text-xs text-slate-400 capitalize truncate">{currentUser.role}</p>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400
                     hover:bg-white/8 hover:text-white transition"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
