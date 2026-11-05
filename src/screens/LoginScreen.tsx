/**
 * LoginScreen.tsx — Username / password login form.
 *
 * Shows UnitFlow branding on the left and the login form on the right.
 * On successful login, sets the currentUser in AppContext and the parent
 * App component switches to the main layout.
 */

import React, { useState } from "react";
import { Loader2, Lock, User as UserIcon } from "lucide-react";
import { authApi } from "../lib/api";
import { useApp } from "../context/AppContext";

export default function LoginScreen() {
  const { setCurrentUser, t } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");
    try {
      const user = await authApi.login({ username, password });
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message ?? t("general.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen">
      {/* ── Left panel — brand ──────────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-col items-center justify-center w-[420px] shrink-0 text-white"
        style={{ background: "linear-gradient(145deg, #1e3a5f 0%, #2563eb 100%)" }}
      >
        <div className="flex flex-col items-center gap-4 px-10 text-center animate-fade-in">
          {/* Logo mark */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl font-bold shadow-lg">
            UF
          </div>
          <h1 className="text-3xl font-bold tracking-tight">UnitFlow</h1>
          <p className="text-blue-200 text-base leading-relaxed">
            {t("auth.tagline")}
          </p>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-xl bg-primary-600 items-center justify-center text-white text-2xl font-bold mb-2">
              UF
            </div>
            <h1 className="text-2xl font-bold text-slate-800">UnitFlow</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            {t("auth.welcome_back")}
          </h2>
          <p className="text-slate-500 mb-8 text-sm">{t("auth.sign_in")} to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("auth.username")}
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  placeholder="your.username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("auth.password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                         text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? t("auth.signing_in") : t("auth.sign_in")}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            UnitFlow v1.0 · Manufacturing Management System
          </p>
        </div>
      </div>
    </div>
  );
}
