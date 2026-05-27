import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowRight, TrendingDown, ClipboardList } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string | null;
  date: string;
}

const expenseCategories = ["Maaş", "İcarə", "Kommunal", "Nəqliyyat", "Digər"];

const categoryBadges: Record<string, string> = {
  Maaş: "bg-blue-50 text-blue-700 border-blue-100",
  İcarə: "bg-purple-50 text-purple-700 border-purple-100",
  Kommunal: "bg-amber-50 text-amber-700 border-amber-100",
  Nəqliyyat: "bg-orange-50 text-orange-700 border-orange-100",
  Digər: "bg-gray-50 text-gray-700 border-gray-100",
};

export default function Expenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Digər");
  const [description, setDescription] = useState("");

  // Queries & Mutations
  const params = filterActive ? `?from=${fromDate}&to=${toDate}` : "";

  const { data: list, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", fromDate, toDate, filterActive],
    queryFn: async () => {
      const res = await fetch(`/api/expenses${params}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const filteredList = (list || []).filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.category.toLowerCase().includes(q) ||
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
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Xərc qeydə alındı!", description: "Xərc uğurla bazaya əlavə olundu.", variant: "success" });
      setAmount("");
      setDescription("");
      setCategory("Digər");
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Xərc əlavə edilərkən xəta baş verdi.", variant: "destructive" });
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
      toast({ title: "Silindi!", description: "Xərc qeydi silindi.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Silinmə zamanı xəta baş verdi.", variant: "destructive" });
    },
  });

  const handleFilter = () => {
    setFilterActive(true);
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setFilterActive(false);
    setSearchQuery("");
  };

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
    });
  };

  const totalExpenses = filteredList ? filteredList.reduce((sum, e) => sum + e.amount, 0) : 0;

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
          {/* Total Period Expenses card */}
          {!isLoading && list && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex items-center justify-between glass">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cəmi Xərclər</span>
                  <span className="text-2xl font-black text-red-500 font-mono block mt-0.5">
                    {totalExpenses.toFixed(2)} ₼
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">seçilmiş dövr üzrə xərclərin cəmi</span>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm">Xərclərin Reyestri</h3>
              <input
                type="text"
                placeholder="Xərc axtar (kateqoriya, açıqlama...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 w-full sm:w-60"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Kateqoriya</th>
                    <th className="py-2.5 px-2">Açıqlama</th>
                    <th className="py-2.5 px-2">Tarix</th>
                    <th className="py-2.5 px-2 text-right">Məbləğ</th>
                    <th className="py-2.5 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                        Yüklənir...
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-gray-400">
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
    </div>
  );
}
