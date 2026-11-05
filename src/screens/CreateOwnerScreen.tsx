/**
 * CreateOwnerScreen.tsx — First-run account setup.
 *
 * Shown exactly once: when no owner account exists in the database.
 * After the account is created, the app shows the normal login screen.
 */

import React, { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { authApi } from "../lib/api";
import { useApp } from "../context/AppContext";

interface Props {
  onCreated: () => void; // callback to switch to login screen
}

export default function CreateOwnerScreen({ onCreated }: Props) {
  const { t } = useApp();
  const [form, setForm] = useState({ full_name: "", username: "", password: "", confirm: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.createOwner({
        full_name: form.full_name,
        username:  form.username,
        password:  form.password,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message ?? t("general.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t("auth.create_owner")}</h1>
            <p className="text-sm text-slate-500">{t("auth.create_owner_desc")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("auth.full_name")}
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => update("full_name", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("auth.username")}
            </label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={e => update("username", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="admin"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("auth.password")}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={e => update("password", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="Min. 8 characters"
              required
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={e => update("confirm", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="Repeat password"
              required
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                       text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? t("auth.creating") : t("auth.create_account")}
          </button>
        </form>
      </div>
    </div>
  );
}
