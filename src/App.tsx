/**
 * App.tsx — Root component.
 *
 * Decision tree on render:
 *   1. Loading → spinner
 *   2. No owner exists (first run) → CreateOwnerScreen
 *   3. Not logged in → LoginScreen
 *   4. Logged in → MainLayout
 */

import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import LoginScreen       from "./screens/LoginScreen";
import CreateOwnerScreen from "./screens/CreateOwnerScreen";
import MainLayout        from "./components/MainLayout";
import { authApi }       from "./lib/api";
import { Loader2 }       from "lucide-react";

function AppInner() {
  const { currentUser, setCurrentUser } = useApp();
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null); // null = loading

  // On mount, check if an owner account exists
  useEffect(() => {
    authApi
      .checkOwnerExists()
      .then(setOwnerExists)
      .catch(() => setOwnerExists(false)); // safe default on error
  }, []);

  // Called after the owner account is created successfully
  function handleOwnerCreated() {
    setOwnerExists(true);
  }

  // Logout: clear the session
  function handleLogout() {
    setCurrentUser(null);
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (ownerExists === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // ── First run: create owner ────────────────────────────────────────────
  if (!ownerExists) {
    return <CreateOwnerScreen onCreated={handleOwnerCreated} />;
  }

  // ── Not logged in: show login ──────────────────────────────────────────
  if (!currentUser) {
    return <LoginScreen />;
  }

  // ── Logged in: show main app ───────────────────────────────────────────
  return <MainLayout onLogout={handleLogout} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
