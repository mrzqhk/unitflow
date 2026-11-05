/**
 * UsersScreen.tsx — Owner-only user management screen.
 *
 * Features:
 *  - List all users in a clean table
 *  - Create new users (all 8 roles)
 *  - Edit name, role, and optionally reset password
 *  - Enable / disable accounts (toggle)
 *  - Backup Now button for the owner
 *
 * Role-check: this screen is only rendered when currentUser.role === 'owner'.
 * The IPC handlers also enforce this on the main process side.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Users as UsersIcon,
  PlusCircle,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  HardDriveDownload,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { usersApi, backupApi } from "../lib/api";
import { User, Role } from "../types";
import { ROLE_LABELS } from "../lib/permissions";

// ── Roles list (for selects) ─────────────────────────────────────────────────
const ALL_ROLES: Role[] = [
  "owner", "sales", "designer", "supervisor", "worker", "store", "delivery", "accountant",
];

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: number }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    owner:      "bg-purple-50 text-purple-700 border-purple-200",
    sales:      "bg-blue-50   text-blue-700   border-blue-200",
    designer:   "bg-pink-50   text-pink-700   border-pink-200",
    supervisor: "bg-amber-50  text-amber-700  border-amber-200",
    worker:     "bg-slate-50  text-slate-600  border-slate-200",
    store:      "bg-teal-50   text-teal-700   border-teal-200",
    delivery:   "bg-orange-50 text-orange-700 border-orange-200",
    accountant: "bg-green-50  text-green-700  border-green-200",
  };
  return (
    <span className={`inline-flex text-xs font-medium border rounded-full px-2.5 py-0.5 ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── User Form Modal ───────────────────────────────────────────────────────────
interface UserFormProps {
  editUser?: User;
  onClose:  () => void;
  onSaved:  () => void;
  callerRole: string;
  t: (k: string) => string;
}

function UserFormModal({ editUser, onClose, onSaved, callerRole, t }: UserFormProps) {
  const [form, setForm] = useState({
    full_name: editUser?.full_name ?? "",
    username:  editUser?.username  ?? "",
    role:      (editUser?.role ?? "worker") as Role,
    password:  "",
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function up(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editUser) {
        await usersApi.update({
          id:        editUser.id,
          full_name: form.full_name,
          role:      form.role,
          password:  form.password || undefined,
          callerRole,
        });
      } else {
        if (!form.password || form.password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await usersApi.create({
          full_name: form.full_name,
          username:  form.username,
          password:  form.password,
          role:      form.role,
          callerRole,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message ?? t("general.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-7 animate-fade-in">
        <h2 className="text-lg font-bold text-slate-800 mb-5">
          {editUser ? t("users.edit_title") : t("users.create_title")}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("users.name")}</label>
            <input
              type="text" value={form.full_name} required
              onChange={e => up("full_name", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>

          {/* Username (only for new users) */}
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("users.username")}</label>
              <input
                type="text" value={form.username} required
                onChange={e => up("username", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("users.role")}</label>
            <select
              value={form.role}
              onChange={e => up("role", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {editUser ? t("users.new_password") : t("auth.password")}
            </label>
            <input
              type="password" value={form.password}
              required={!editUser}
              onChange={e => up("password", e.target.value)}
              placeholder={editUser ? "Leave blank to keep current" : "Min. 6 characters"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 mt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
            >
              {t("general.cancel")}
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("general.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main UsersScreen ──────────────────────────────────────────────────────────
export default function UsersScreen() {
  const { currentUser, t } = useApp();
  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<User | undefined>(undefined);
  const [backupMsg,  setBackupMsg]  = useState("");
  const [toggling,   setToggling]   = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await usersApi.list();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleToggle(user: User) {
    if (!currentUser) return;
    setToggling(user.id);
    try {
      await usersApi.toggleActive({
        id: user.id,
        active: user.active === 0, // flip it
        callerRole: currentUser.role,
      });
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setToggling(null);
    }
  }

  async function handleBackupNow() {
    setBackupMsg("");
    try {
      const path = await backupApi.now();
      setBackupMsg(`✅ ${t("backup.success")} — ${path}`);
    } catch (err: any) {
      setBackupMsg(`❌ ${t("backup.fail")}: ${err.message}`);
    }
    setTimeout(() => setBackupMsg(""), 6000);
  }

  if (!currentUser || currentUser.role !== "owner") {
    return (
      <div className="p-8 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("users.title")}</h1>
            <p className="text-sm text-slate-500">{users.length} users registered</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Backup Now */}
          <button
            onClick={handleBackupNow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600
                       hover:bg-slate-50 hover:border-slate-300 transition text-sm font-medium"
          >
            <HardDriveDownload className="w-4 h-4" />
            {t("backup.button")}
          </button>

          {/* Add User */}
          <button
            onClick={() => { setEditTarget(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-semibold transition"
          >
            <PlusCircle className="w-4 h-4" />
            {t("users.add_user")}
          </button>
        </div>
      </div>

      {/* Backup message */}
      {backupMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
          {backupMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">#</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t("users.name")}</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t("users.username")}</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t("users.role")}</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t("users.status")}</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5 text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{u.full_name}</td>
                  <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{u.username}</td>
                  <td className="px-5 py-3.5"><RoleBadge role={u.role as Role} /></td>
                  <td className="px-5 py-3.5"><StatusBadge active={u.active} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => { setEditTarget(u); setShowForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle active — prevent disabling yourself */}
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id}
                          className={`p-1.5 rounded-lg transition ${
                            u.active
                              ? "hover:bg-red-50 text-slate-400 hover:text-red-600"
                              : "hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
                          }`}
                          title={u.active ? "Disable user" : "Enable user"}
                        >
                          {toggling === u.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : u.active
                              ? <XCircle className="w-3.5 h-3.5" />
                              : <CheckCircle2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <UserFormModal
          editUser={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={loadUsers}
          callerRole={currentUser.role}
          t={t}
        />
      )}
    </div>
  );
}
