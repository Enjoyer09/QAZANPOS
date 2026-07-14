import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingDown, ClipboardList, Lock, Target, X, AlertTriangle } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { TableSkeleton } from "../components/Skeleton.tsx";

interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string | null;
  paymentType: string;
  date: string;
}

interface ExpenseLimit {
  id: number;
  category: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  usagePercent: number;
}

const expenseCategories = ["Maaş", "İcarə", "Kommunal", "Nəqliyyat", "Digər"];

const categoryBadges: Record<string, string> = {
  Maaş: "bg-blue-50 text-blue-700 border-blue-100",
  İcarə: "bg-purple-50 text-purple-700 border-purple-100",
  Kommunal: "bg-amber-50 text-amber-700 border-amber-100",
  Nəqliyyat: "bg-orange-50 text-orange-700 border-orange-100",
  Digər: "bg-gray-50 text-gray-700 border-gray-100",
};

const categoryColors: Record<string, string> = {
  Maaş: "bg-blue-500",
  İcarə: "bg-purple-500",
  Kommunal: "bg-amber-500",
  Nəqliyyat: "bg-orange-500",
  Digər: "bg-gray-500",
};

const paymentTypeLabels: Record<string, string> = {
  cash: "Nəqd (Kassa)",
  safe: "Seyf (Nəqd)",
  card: "Kart / Bank",
  investor_debt: "İnvestor Borcu",
  other: "Digər",
};

const paymentTypeBadges: Record<string, string> = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-100",
  safe: "bg-indigo-50 text-indigo-700 border-indigo-100",
  card: "bg-blue-50 text-blue-700 border-blue-100",
  investor_debt: "bg-purple-50 text-purple-700 border-purple-100",
  other: "bg-gray-50 text-gray-700 border-gray-100",
};

export default function Expenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  })();

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const todayStr = getTodayStr();

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [appliedFrom, setAppliedFrom] = useState(todayStr);
  const [appliedTo, setAppliedTo] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Digər");
  const [description, setDescription] = useState("");
  const [paymentType, setPaymentType] = useState("cash");

  // Limit modal state
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [editLimitCategory, setEditLimitCategory] = useState("Maaş");
  const [editLimitAmount, setEditLimitAmount] = useState("");

  const isAdmin = user?.role === "Admin";

  // Queries & Mutations
  const filterParams = appliedFrom || appliedTo
    ? `?from=${appliedFrom}&to=${appliedTo}`
    : "";

  const { data: list, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", appliedFrom, appliedTo],
    queryFn: async () => {
      const res = await fetch(`/api/expenses${filterParams}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: limits } = useQuery<ExpenseLimit[]>({
    queryKey: ["/api/expense-limits/usage"],
    queryFn: async () => {
      const res = await fetch("/api/expense-limits/usage");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isAdmin,
  });

  const filteredList = (list || []).filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const payLabel = paymentTypeLabels[item.paymentType || "cash"] || "";
    return (
      item.category.toLowerCase().includes(q) ||
      payLabel.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        // Propagate the full error object so we can show limit exceeded details
        throw json;
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-limits/usage"] });
      toast({ title: "Xərc qeydə alındı!", description: "Xərc uğurla bazaya əlavə olundu.", variant: "success" });
      setAmount("");
      setDescription("");
      setCategory("Digər");
      setPaymentType("cash");
    },
    onError: (error: any) => {
      if (error?.limitExceeded) {
        toast({
          title: "⚠️ Limit Keçildi!",
          description: error.message || `"${error.category}" limiti aşıldı!`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Xəta!", description: "Xərc əlavə edilərkən xəta baş verdi.", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-limits/usage"] });
      toast({ title: "Silindi!", description: "Xərc qeydi silindi.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Silinmə zamanı xəta baş verdi.", variant: "destructive" });
    },
  });

  const saveLimitMutation = useMutation({
    mutationFn: async (data: { category: string; monthlyLimit: number }) => {
      const res = await fetch("/api/expense-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-limits/usage"] });
      toast({ title: "Limit təyin edildi!", variant: "success" });
      setLimitModalOpen(false);
      setEditLimitAmount("");
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Limit təyin edilərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/expense-limits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-limits/usage"] });
      toast({ title: "Limit silindi!", variant: "success" });
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Limit silinərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const handleReset = () => {
    const t = getTodayStr();
    setFromDate(t);
    setToDate(t);
    setAppliedFrom(t);
    setAppliedTo(t);
    setSearchQuery("");
  };

  const filterActive = !!(appliedFrom || appliedTo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Xəta!", description: "Düzgün məbləğ daxil edin.", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      amount: amt,
      category,
      description: description.trim() || null,
      paymentType,
    });
  };

  const openLimitModal = (cat?: string) => {
    if (cat) {
      setEditLimitCategory(cat);
      const existing = limits?.find((l) => l.category === cat);
      setEditLimitAmount(existing ? String(existing.monthlyLimit) : "");
    } else {
      setEditLimitCategory(expenseCategories[0]);
      setEditLimitAmount("");
    }
    setLimitModalOpen(true);
  };

  const handleSaveLimit = () => {
    const val = parseFloat(editLimitAmount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Xəta!", description: "Düzgün limit daxil edin.", variant: "destructive" });
      return;
    }
    saveLimitMutation.mutate({ category: editLimitCategory, monthlyLimit: val });
  };

  const handleRemoveLimit = (limit: ExpenseLimit) => {
    if (confirm(`"${limit.category}" limitini silmək istədiyinizə əminsiniz?`)) {
      deleteLimitMutation.mutate(limit.id);
    }
  };

  const totalExpenses = filteredList ? filteredList.reduce((sum, e) => sum + e.amount, 0) : 0;

  const cashExpenses = filteredList
    ? filteredList.filter(e => (e.paymentType || "cash") === "cash").reduce((sum, e) => sum + e.amount, 0)
    : 0;
  const cardExpenses = filteredList
    ? filteredList.filter(e => e.paymentType === "card").reduce((sum, e) => sum + e.amount, 0)
    : 0;
  const investorDebtExpenses = filteredList
    ? filteredList.filter(e => e.paymentType === "investor_debt").reduce((sum, e) => sum + e.amount, 0)
    : 0;
  const otherExpenses = filteredList
    ? filteredList.filter(e => e.paymentType === "other").reduce((sum, e) => sum + e.amount, 0)
    : 0;

  if (user?.role !== "Admin" && currentUser?.staffCanViewExpenses === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Xərclər Moduluna Giriş Məhdudlaşdırılıb 🔒</h3>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed">
              Bu bölməyə giriş mağaza administratoru tərəfindən məhdudlaşdırılmışdır. Səlahiyyət almaq üçün administratora müraciət edin.
            </p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">QAZANPOS TƏHLÜKƏSİZLİK SİSTEMİ</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-0">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Xərclər Portalı</h2>
          <p className="text-xs text-gray-400 mt-1">İcarə, kommunal, maaş və digər əməliyyat xərclərinin reyestri</p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Başlanğıc</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-36 bg-gray-50/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Son</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-36 bg-gray-50/50"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={!fromDate && !toDate}
            className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50"
          >
            Filtrlə
          </button>
          {filterActive && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
            >
              Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* Expense Limits Panel (Admin only) */}
      {isAdmin && limits && limits.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h3 className="font-extrabold text-gray-900 text-sm">Aylıq Xərc Limitləri</h3>
            </div>
            <button
              onClick={() => openLimitModal()}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              + Yeni Limit
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {limits.map((limit) => {
              const barColor = limit.usagePercent >= 90 ? "bg-red-500" : limit.usagePercent >= 75 ? "bg-amber-500" : categoryColors[limit.category] || "bg-indigo-500";
              return (
                <div key={limit.id} className="border border-gray-100 rounded-xl p-3 space-y-2 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${categoryBadges[limit.category] || "bg-gray-50 text-gray-500"}`}>
                      {limit.category}
                    </span>
                    <div className="flex items-center gap-1">
                      {limit.usagePercent >= 90 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <button
                        onClick={() => openLimitModal(limit.category)}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold cursor-pointer"
                      >
                        Redaktə
                      </button>
                      <button
                        onClick={() => handleRemoveLimit(limit)}
                        className="text-[10px] text-gray-400 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-semibold">{limit.spent.toFixed(0)} ₼</span>
                    <span className="text-gray-400 font-medium">/ {limit.monthlyLimit.toFixed(0)} ₼</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, limit.usagePercent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className={limit.usagePercent >= 90 ? "text-red-600 font-bold" : limit.usagePercent >= 75 ? "text-amber-600 font-bold" : "text-gray-400"}>
                      {limit.usagePercent.toFixed(0)}% istifadə
                    </span>
                    <span className="text-gray-400">{limit.remaining.toFixed(0)} ₼ qalıb</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Add Expense Form Card */}
        <div className="lg:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
          <h3 className="font-extrabold text-gray-900 text-sm mb-4">Yeni Xərc Əlavə Et</h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məbləğ (₼) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00 ₼"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kateqoriya *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {/* Show limit info for selected category */}
              {(() => {
                const selectedLimit = limits?.find((l) => l.category === category);
                if (!selectedLimit) return null;
                const warnClass = selectedLimit.usagePercent >= 90 ? "text-red-500" : selectedLimit.usagePercent >= 75 ? "text-amber-500" : "text-gray-400";
                return (
                  <p className={`text-[10px] mt-1 ${warnClass}`}>
                    Limit: {selectedLimit.spent.toFixed(0)} ₼ / {selectedLimit.monthlyLimit.toFixed(0)} ₼ ({selectedLimit.usagePercent.toFixed(0)}%)
                  </p>
                );
              })()}
            </div>

            {/* Payment Source */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ödəniş Mənbəyi *</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
              >
                <option value="cash">Nəqd (Kassa)</option>
                <option value="safe">Seyf (Nəqd)</option>
                <option value="card">Kart / Bank Hesabı</option>
                <option value="investor_debt">İnvestor Borcu</option>
                <option value="other">Digər</option>
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Təsvir / Açıqlama</label>
              <textarea
                placeholder="Xərcin təyinatı haqqında qeydlər"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 h-24 resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md shadow-red-500/10 transition-all"
            >
              <Plus className="w-4 h-4" /> Xərci Qeyd Et
            </button>
          </form>
        </div>

        {/* Expenses List Table Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Total & Breakdown Grid */}
          {!isLoading && list && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 animate-in fade-in duration-300">
              {/* Total Expenses Card */}
              <div className="col-span-2 sm:col-span-5 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 rounded-2xl p-5 flex items-center justify-between glass shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
                    <TrendingDown className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                      {filterActive
                        ? `Seçilmiş Dövr: ${appliedFrom || "..."} → ${appliedTo || "..."}`
                        : "Bütün Dövrün Xərcləri"}
                    </span>
                    <span className="text-2xl font-black text-red-600 font-mono mt-0.5 block">
                      {totalExpenses.toFixed(2)} ₼
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider hidden sm:inline">QAZANPOS XƏRC HESABATI</span>
              </div>

            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm">Xərclərin Reyestri</h3>
              <input
                type="text"
                placeholder="Xərc axtar (kateqoriya, açıqlama, ödəniş...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 w-full sm:w-60"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Kateqoriya</th>
                    <th className="py-2.5 px-2">Ödəniş Mənbəyi</th>
                    <th className="py-2.5 px-2">Açıqlama</th>
                    <th className="py-2.5 px-2">Tarix</th>
                    <th className="py-2.5 px-2 text-right">Məbləğ</th>
                    <th className="py-2.5 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={6} colSpan={6} />
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                        {searchQuery ? "Axtarışa uyğun xərc qeydi tapılmadı." : "Heç bir xərc qeydi tapılmadı."}
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${categoryBadges[item.category] || "bg-gray-50 text-gray-500"}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${paymentTypeBadges[item.paymentType || "cash"]}`}>
                            {paymentTypeLabels[item.paymentType || "cash"]}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-gray-500 font-medium max-w-xs truncate">
                          {item.description ? (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="w-3.5 h-3.5 text-gray-300 shrink-0" /> {item.description}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-4 px-2 text-gray-400">
                          {new Date(item.date).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="py-4 px-2 text-right font-black text-red-500 font-mono text-sm">
                          {item.amount.toFixed(2)} ₼
                        </td>
                        <td className="py-4 px-2 text-center">
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            className="text-gray-400 hover:text-red-500 cursor-pointer transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Limit Setting Modal ═══ */}
      {limitModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLimitModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-gray-900 text-base">Kateqoriya Limiti</h3>
              </div>
              <button onClick={() => setLimitModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kateqoriya</label>
                <select
                  value={editLimitCategory}
                  onChange={(e) => {
                    setEditLimitCategory(e.target.value);
                    const existing = limits?.find((l) => l.category === e.target.value);
                    setEditLimitAmount(existing ? String(existing.monthlyLimit) : "");
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Aylıq Limit (₼)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00 ₼"
                  value={editLimitAmount}
                  onChange={(e) => setEditLimitAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setLimitModalOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Ləğv Et
              </button>
              <button
                onClick={handleSaveLimit}
                disabled={saveLimitMutation.isPending}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
              >
                {saveLimitMutation.isPending ? "Saxlanılır..." : "Yadda Saxla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
