/**
 * ProductsScreen.tsx — Product Catalog, Pricing & Wholesale Tier Slabs.
 *
 * Implements:
 * 1. Product master table (searchable, filterable by category and status).
 * 2. Retail price, wholesale base price, and tiered wholesale slabs display.
 * 3. Add / Edit / Disable product workflows.
 * 4. Role enforcement:
 *    - Only owner can edit prices and tiered slabs.
 *    - Main process independently blocks price tampering by non-owners.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package,
  Search,
  Plus,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Layers,
  Trash2,
  Tag,
  Loader2,
  Coins,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { productsApi } from "../lib/api";
import { Product, WholesaleSlab } from "../types";
import { canEditPrices } from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: number }) {
  return active === 1 ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <XCircle className="w-3 h-3 text-slate-400" /> Inactive
    </span>
  );
}

// ── Add / Edit Product Modal ──────────────────────────────────────────────────

interface ProductModalProps {
  editProduct?: Product | null;
  onClose: () => void;
  onSaved: (saved: Product) => void;
}

const COMMON_CATEGORIES = [
  "Apparel",
  "Fabric",
  "Raw Material",
  "Hardware",
  "Accessories",
  "Packaging",
  "General",
];

const COMMON_UNITS = ["pcs", "meter", "kg", "box", "roll", "set", "pair"];

function ProductModal({ editProduct, onClose, onSaved }: ProductModalProps) {
  const { currentUser, t } = useApp();
  const isOwner = currentUser ? canEditPrices(currentUser.role) : false;

  const [name, setName] = useState(editProduct?.name ?? "");
  const [category, setCategory] = useState(editProduct?.category ?? "Apparel");
  const [unit, setUnit] = useState(editProduct?.unit ?? "pcs");
  const [retailPrice, setRetailPrice] = useState<number | string>(
    editProduct ? editProduct.retail_price : 0
  );
  const [wholesalePrice, setWholesalePrice] = useState<number | string>(
    editProduct ? editProduct.wholesale_price : 0
  );
  const [slabs, setSlabs] = useState<WholesaleSlab[]>(
    editProduct?.slabs ? JSON.parse(JSON.stringify(editProduct.slabs)) : []
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleAddSlab() {
    if (!isOwner) return;
    setSlabs(prev => [...prev, { min_quantity: 10, price: 0 }]);
  }

  function handleUpdateSlab(index: number, field: "min_quantity" | "price", value: number) {
    if (!isOwner) return;
    setSlabs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function handleRemoveSlab(index: number) {
    if (!isOwner) return;
    setSlabs(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cleanSlabs = slabs
        .filter(s => Number(s.min_quantity) > 0 && Number(s.price) >= 0)
        .map(s => ({ min_quantity: Number(s.min_quantity), price: Number(s.price) }))
        .sort((a, b) => a.min_quantity - b.min_quantity);

      if (editProduct) {
        const updated = await productsApi.update({
          id: editProduct.id,
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          retail_price: Number(retailPrice) || 0,
          wholesale_price: Number(wholesalePrice) || 0,
          slabs: cleanSlabs,
          callerRole: currentUser.role,
          callerUsername: currentUser.username,
        });
        onSaved(updated);
      } else {
        const created = await productsApi.create({
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          retail_price: Number(retailPrice) || 0,
          wholesale_price: Number(wholesalePrice) || 0,
          slabs: cleanSlabs,
          callerRole: currentUser.role,
          callerUsername: currentUser.username,
        });
        onSaved(created);
      }
    } catch (err: any) {
      setError(err?.message ?? t("general.error"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editProduct ? t("products.edit") : t("products.add")}
              </h2>
              <p className="text-xs text-slate-500">
                {editProduct ? "Modify item specifications and pricing" : "Add an item to the product master catalogue"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              {t("products.name")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Premium Cotton Shirt"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("products.category")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="category-suggestions"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Select or type..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <datalist id="category-suggestions">
                  {COMMON_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                {t("products.unit")}
              </label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing Section (Owner Lock Guard) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-primary-500" /> Pricing & Rates
              </h3>
              {!isOwner && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Lock className="w-3 h-3" /> Owner Only
                </span>
              )}
            </div>

            {!isOwner && (
              <p className="text-xs text-amber-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 mb-3">
                {t("products.price_owner_only")}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("products.retail_price")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!isOwner}
                    value={retailPrice}
                    onChange={e => setRetailPrice(e.target.value)}
                    className={cn(
                      "w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
                      !isOwner && "bg-slate-100 text-slate-500 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {t("products.wholesale_price")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!isOwner}
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(e.target.value)}
                    className={cn(
                      "w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
                      !isOwner && "bg-slate-100 text-slate-500 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Wholesale Quantity Slabs */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" /> {t("products.slabs_title")}
                </h3>
                <p className="text-xs text-slate-400">{t("products.slabs_desc")}</p>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={handleAddSlab}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg border border-primary-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("products.add_slab")}
                </button>
              )}
            </div>

            {slabs.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3.5 py-2">{t("products.min_qty")}</th>
                      <th className="px-3.5 py-2">{t("products.slab_price")}</th>
                      {isOwner && <th className="px-3.5 py-2 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slabs.map((slab, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2">
                          <input
                            type="number"
                            min="1"
                            disabled={!isOwner}
                            value={slab.min_quantity}
                            onChange={e =>
                              handleUpdateSlab(i, "min_quantity", parseFloat(e.target.value) || 0)
                            }
                            className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />{" "}
                          <span className="text-slate-400">{unit}</span>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              disabled={!isOwner}
                              value={slab.price}
                              onChange={e =>
                                handleUpdateSlab(i, "price", parseFloat(e.target.value) || 0)
                              }
                              className="w-28 px-2 py-1 rounded-lg border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold"
                            />
                          </div>
                        </td>
                        {isOwner && (
                          <td className="px-3.5 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSlab(i)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {t("products.no_slabs")}
              </p>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
            >
              {t("general.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("general.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Products Screen ──────────────────────────────────────────────────────

export default function ProductsScreen() {
  const { currentUser, t } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const [modalProduct, setModalProduct] = useState<Product | null | "new">(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const isOwner = currentUser ? canEditPrices(currentUser.role) : false;

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const list = await productsApi.list();
      setProducts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Categories present in products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Toggle active/inactive
  async function handleToggle(prod: Product) {
    if (!currentUser) return;
    try {
      setTogglingId(prod.id);
      const newActive = prod.active === 1 ? false : true;
      await productsApi.toggleActive({
        id: prod.id,
        active: newActive,
        callerRole: currentUser.role,
        callerUsername: currentUser.username,
      });
      await loadProducts();
    } catch (err: any) {
      alert(err?.message || "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  }

  // Filtered and searched list
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);

      const matchCategory = filterCategory === "all" || p.category === filterCategory;

      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && p.active === 1) ||
        (filterStatus === "inactive" && p.active === 0);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, filterCategory, filterStatus]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("products.title")}</h1>
            <p className="text-sm text-slate-500">{t("products.subtitle")}</p>
          </div>
        </div>

        <button
          onClick={() => setModalProduct("new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          {t("products.add")}
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("products.search_placeholder")}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 text-xs font-medium text-slate-600">
            {(["all", "active", "inactive"] as const).map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg capitalize transition",
                  filterStatus === st ? "bg-slate-800 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                {st === "all" ? t("general.all") : t(`customers.${st}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>{t("general.loading")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">{t("products.name")}</th>
                  <th className="px-5 py-3.5">{t("products.unit")}</th>
                  <th className="px-5 py-3.5 text-right">{t("products.retail_price")}</th>
                  <th className="px-5 py-3.5 text-right">{t("products.wholesale_price")}</th>
                  <th className="px-5 py-3.5">{t("products.slabs_title")}</th>
                  <th className="px-5 py-3.5">{t("customers.status")}</th>
                  <th className="px-5 py-3.5 text-right">{t("general.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map((prod, idx) => (
                  <tr key={prod.id} className="hover:bg-slate-50/60 transition group">
                    <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-semibold text-slate-800">{prod.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                            {prod.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-medium capitalize">{prod.unit}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">
                      ₹{Number(prod.retail_price).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-indigo-700">
                      ₹{Number(prod.wholesale_price).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      {prod.slabs && prod.slabs.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {prod.slabs.map((slab, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              ≥{slab.min_quantity}: ₹{slab.price}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No slabs</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={prod.active} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit */}
                        <button
                          onClick={() => setModalProduct(prod)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          title={t("products.edit")}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggle(prod)}
                          disabled={togglingId === prod.id}
                          className={cn(
                            "p-1.5 rounded-lg transition",
                            prod.active === 1
                              ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          )}
                          title={prod.active === 1 ? t("products.disable") : t("products.enable")}
                        >
                          {togglingId === prod.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : prod.active === 1 ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No products found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Add an item to the product master catalogue.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalProduct && (
        <ProductModal
          editProduct={modalProduct === "new" ? null : modalProduct}
          onClose={() => setModalProduct(null)}
          onSaved={async () => {
            setModalProduct(null);
            await loadProducts();
          }}
        />
      )}
    </div>
  );
}
