/**
 * MainLayout.tsx — Shell layout after login.
 *
 * Structure:
 *   ┌──────────┬────────────────────────┐
 *   │ Sidebar  │  Header                │
 *   │          ├────────────────────────┤
 *   │          │  <screen content>      │
 *   └──────────┴────────────────────────┘
 *
 * Route guard: if the user navigates to a screen they cannot access,
 * they are redirected to the dashboard.
 */

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header  from "./Header";
import { Screen, canAccess } from "../lib/permissions";
import { useApp } from "../context/AppContext";
import DashboardScreen from "../screens/DashboardScreen";
import UsersScreen     from "../screens/UsersScreen";
import CustomersScreen from "../screens/CustomersScreen";
import ProductsScreen  from "../screens/ProductsScreen";
import QuotationsScreen from "../screens/QuotationsScreen";
import OrdersScreen    from "../screens/OrdersScreen";

// Placeholder component for screens not yet built
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-8 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">🚧</div>
      <p className="text-lg font-medium text-slate-600 capitalize">{name}</p>
      <p className="text-sm">This module is coming soon.</p>
    </div>
  );
}

// Map screen → component
function ScreenRenderer({ screen }: { screen: Screen }) {
  switch (screen) {
    case "dashboard":  return <DashboardScreen />;
    case "customers":  return <CustomersScreen />;
    case "products":   return <ProductsScreen />;
    case "quotations": return <QuotationsScreen />;
    case "orders":     return <OrdersScreen />;
    case "users":      return <UsersScreen />;
    case "sales":      return <QuotationsScreen />;
    case "design":     return <ComingSoon name="Design" />;
    case "production": return <ComingSoon name="Production" />;
    case "store":      return <ComingSoon name="Store" />;
    case "delivery":   return <ComingSoon name="Delivery" />;
    case "accounts":   return <ComingSoon name="Accounts" />;
    default:           return <DashboardScreen />;
  }
}

interface Props {
  onLogout: () => void;
}

export default function MainLayout({ onLogout }: Props) {
  const { currentUser } = useApp();
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");

  // Route guard: if somehow the user ends up on a forbidden screen, redirect
  function handleNavigate(screen: Screen) {
    if (!currentUser) return;
    if (!canAccess(currentUser.role, screen)) {
      console.warn(`[Auth] Role "${currentUser.role}" tried to access "${screen}". Blocked.`);
      setActiveScreen("dashboard");
      return;
    }
    setActiveScreen(screen);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        onLogout={onLogout}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <ScreenRenderer screen={activeScreen} />
        </main>
      </div>
    </div>
  );
}
