import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Clock, ArrowUpRight, HelpCircle, Check, Eye, X, Lock } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

export default function Debts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = user?.role === "Admin";

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const [activeTab, setActiveTab] = useState<"customers" | "my-debts">("customers");
  const currentTab = isAdmin ? activeTab : "customers";

  // Filter & Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(10);

  const [overduePage, setOverduePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [myDebtsPage, setMyDebtsPage] = useState(1);

  // Supplier Debt Payment Modal States
  const [selectedDebt, setSelectedDebt] = useState<any | null>(null);
  const [payType, setPayType] = useState("Nəğd");
  const [payFrom, setPayFrom] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Queries
  const { data: overdueList, isLoading: isOverdueLoading } = useQuery<any[]>({
    queryKey: ["/api/credits/overdue"],
    queryFn: async () => {
      const res = await fetch("/api/credits/overdue");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: pendingList, isLoading: isPendingLoading } = useQuery<any[]>({
    queryKey: ["/api/credits/pending"],
    queryFn: async () => {
      const res = await fetch("/api/credits/pending");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: myDebts, isLoading: isMyDebtsLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/my-debts"],
    queryFn: async () => {
      const res = await fetch("/api/stock/my-debts");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isAdmin,
  });

  // Mutation: Pay our supplier debt
  const paySupplierMutation = useMutation({
    mutationFn: async ({ id, paymentType, paymentFrom, notes }: { id: number; paymentType: string; paymentFrom: string; notes?: string }) => {
      const res = await fetch(`/api/stock/entries/${id}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType, paymentFrom, notes }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/my-debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Borc ödənildi!", description: "Tədarükçüyə olan borcumuz tam ödənildi.", variant: "success" });
      setSelectedDebt(null);
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Borc ödənilərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const totalCustomerDebt =
    (overdueList?.reduce((sum, item) => sum + (Number(item.remainingDebt) || 0), 0) || 0) +
    (pendingList?.reduce((sum, item) => sum + (Number(item.remainingDebt) || 0), 0) || 0);

  const totalMyDebt = myDebts?.reduce((sum, item) => sum + item.totalAmount, 0) || 0;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const overdueMyDebt = myDebts?.reduce((sum, item) => {
    if (!item.creditDueDate) return sum;
    const due = new Date(item.creditDueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < todayDate.getTime() ? sum + item.totalAmount : sum;
  }, 0) || 0;

  const approachingMyDebt = myDebts?.reduce((sum, item) => {
    if (!item.creditDueDate) return sum;
    const due = new Date(item.creditDueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return (diffDays >= 0 && diffDays <= 3) ? sum + item.totalAmount : sum;
  }, 0) || 0;

  // Filter Helper
  const filterList = (list: any[], isMyDebts: boolean) => {
    if (!list) return [];
    return list.filter((item) => {
      // Search matches customerName/supplier or product name
      const nameMatch = isMyDebts
        ? (item.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           item.productName?.toLowerCase().includes(searchQuery.toLowerCase()))
        : (item.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           item.customerPhone?.includes(searchQuery));
      
      if (!nameMatch) return false;

      // Date range matches saleDate or entryDate
      const dateVal = new Date(isMyDebts ? item.entryDate : item.saleDate);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (dateVal < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (dateVal > end) return false;
      }

      return true;
    });
  };

  const filteredOverdue = filterList(overdueList || [], false);
  const filteredPending = filterList(pendingList || [], false);
  const filteredMyDebts = filterList(myDebts || [], true);

  // Pagination Helper
  const overdueTotalPages = Math.ceil(filteredOverdue.length / pageSize) || 1;
  const pendingTotalPages = Math.ceil(filteredPending.length / pageSize) || 1;
  const myDebtsTotalPages = Math.ceil(filteredMyDebts.length / pageSize) || 1;

  const paginatedOverdue = filteredOverdue.slice((overduePage - 1) * pageSize, overduePage * pageSize);
  const paginatedPending = filteredPending.slice((pendingPage - 1) * pageSize, pendingPage * pageSize);
  const paginatedMyDebts = filteredMyDebts.slice((myDebtsPage - 1) * pageSize, myDebtsPage * pageSize);

  if (user?.role !== "Admin" && currentUser?.staffCanViewDebts === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Giriş Məhdudlaşdırılıb 🔒</h3>
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Nisyə və Borc İdarəetməsi</h2>
        <p className="text-xs text-gray-400 mt-1">
          Müştərilərin bizə olan nisyə borcları və bizim tədarükçülərə olan anbar borclarımız
        </p>
      </div>

      {/* Search and Filters panel */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-semibold">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Müştəri / Tədarükçü Axtar</label>
          <input
            type="text"
            placeholder={currentTab === "customers" ? "Müştəri adı və ya telefon..." : "Tədarükçü və ya məhsul adı..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOverduePage(1);
              setPendingPage(1);
              setMyDebtsPage(1);
            }}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Alış / Satış Başlanğıc Tarix</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setOverduePage(1);
              setPendingPage(1);
              setMyDebtsPage(1);
            }}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Alış / Satış Son Tarix</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setOverduePage(1);
              setPendingPage(1);
              setMyDebtsPage(1);
            }}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Səhifədə Göstərilən Say</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setOverduePage(1);
              setPendingPage(1);
              setMyDebtsPage(1);
            }}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold"
          >
            <option value="10">10 ədəd</option>
            <option value="20">20 ədəd</option>
            <option value="50">50 ədəd</option>
          </select>
        </div>
      </div>

      {/* Tabs selectors */}
      <div className="flex gap-2 border-b border-gray-200 pb-px text-xs font-bold text-gray-500">
        <button
          onClick={() => {
            setActiveTab("customers");
            setSearchQuery("");
            setStartDate("");
            setEndDate("");
          }}
          className={`px-4 py-3 border-b-2 transition-all cursor-pointer ${
            currentTab === "customers"
              ? "border-primary text-primary"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Müştəri Borcları ({totalCustomerDebt.toFixed(2)} ₼)
        </button>
        {isAdmin && (
          <button
            onClick={() => {
              setActiveTab("my-debts");
              setSearchQuery("");
              setStartDate("");
              setEndDate("");
            }}
            className={`px-4 py-3 border-b-2 transition-all cursor-pointer ${
              currentTab === "my-debts"
                ? "border-primary text-primary"
                : "border-transparent hover:text-gray-900"
            }`}
          >
            Mənim Borclarım ({totalMyDebt.toFixed(2)} ₼)
          </button>
        )}
      </div>

      {/* TAB 1: CUSTOMERS DEBTS */}
      {currentTab === "customers" && (
        <div className="space-y-6">
          {/* Gecikmiş Borclar (Overdue) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-sm text-gray-900">Gecikmiş Nisyələr (Ödəniş vaxtı keçib)</h3>
              </div>
              <span className="text-[10px] bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-bold border border-red-100">
                Toplam {filteredOverdue.length} ədəd
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Müştəri</th>
                    <th className="py-2.5 px-2">Satış Tarixi</th>
                    <th className="py-2.5 px-2">Son Tarix</th>
                    <th className="py-2.5 px-2 text-right">Qalıq Borc</th>
                    <th className="py-2.5 px-2 text-right pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {isOverdueLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                        Yüklənir...
                      </td>
                    </tr>
                  ) : paginatedOverdue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-green-600 font-medium">
                        Müddəti gecikmiş heç bir nisyə borcu tapılmadı. 👍
                      </td>
                    </tr>
                  ) : (
                    paginatedOverdue.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                        <td className="py-4 px-2">
                          <span className="font-bold text-gray-900 block">{item.customerName || "Nəğd Satış"}</span>
                          {item.customerPhone && <span className="text-[10px] text-gray-400 block mt-0.5">{item.customerPhone}</span>}
                        </td>
                        <td className="py-4 px-2 text-gray-500 font-medium">
                          {new Date(item.saleDate).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="py-4 px-2 font-bold text-red-600">
                          {new Date(item.creditDueDate).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="py-4 px-2 text-right font-black text-red-600 font-mono text-base">
                          {(Number(item.remainingDebt) || 0).toFixed(2)} ₼
                        </td>
                        <td className="py-4 px-2 text-right pr-4">
                          <Link href={`/satislar/${item.id}`}>
                            <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {overdueTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100/50 mt-4 text-xs font-bold">
                <span className="text-gray-400 font-semibold">
                  Səhifə {overduePage} / {overdueTotalPages} (Göstərilir: {paginatedOverdue.length} / {filteredOverdue.length})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOverduePage((p) => Math.max(1, p - 1))}
                    disabled={overduePage === 1}
                    className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                  >
                    Əvvəlki
                  </button>
                  <button
                    onClick={() => setOverduePage((p) => Math.min(overdueTotalPages, p + 1))}
                    disabled={overduePage === overdueTotalPages}
                    className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                  >
                    Növbəti
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Aktiv Borclar (Pending) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-sm text-gray-900">Aktiv Nisyələr (Müddəti bitməyib)</h3>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold border border-primary/10">
                Toplam {filteredPending.length} ədəd
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Müştəri</th>
                    <th className="py-2.5 px-2">Satış Tarixi</th>
                    <th className="py-2.5 px-2">Son Tarix</th>
                    <th className="py-2.5 px-2 text-right">Qalıq Borc</th>
                    <th className="py-2.5 px-2 text-right pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {isPendingLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                        Yüklənir...
                      </td>
                    </tr>
                  ) : paginatedPending.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                        Aktiv nisyə borcu tapılmadı.
                      </td>
                    </tr>
                  ) : (
                    paginatedPending.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                        <td className="py-4 px-2">
                          <span className="font-bold text-gray-900 block">{item.customerName || "Nəğd Satış"}</span>
                          {item.customerPhone && <span className="text-[10px] text-gray-400 block mt-0.5">{item.customerPhone}</span>}
                        </td>
                        <td className="py-4 px-2 text-gray-500 font-medium">
                          {new Date(item.saleDate).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="py-4 px-2 font-bold text-amber-600">
                          {new Date(item.creditDueDate).toLocaleDateString("az-AZ")}
                        </td>
                        <td className="py-4 px-2 text-right font-bold text-gray-950 font-mono">
                          {(Number(item.remainingDebt) || 0).toFixed(2)} ₼
                        </td>
                        <td className="py-4 px-2 text-right pr-4">
                          <Link href={`/satislar/${item.id}`}>
                            <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pendingTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100/50 mt-4 text-xs font-bold">
                <span className="text-gray-400 font-semibold">
                  Səhifə {pendingPage} / {pendingTotalPages} (Göstərilir: {paginatedPending.length} / {filteredPending.length})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={pendingPage === 1}
                    className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                  >
                    Əvvəlki
                  </button>
                  <button
                    onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                    disabled={pendingPage === pendingTotalPages}
                    className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                  >
                    Növbəti
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY DEBTS (TO SUPPLIERS) */}
      {currentTab === "my-debts" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card space-y-6">
          
          {/* Sub-KPI cards for My Debts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Cəmi Borcumuz</span>
                <span className="text-base font-black text-gray-900 block mt-0.5">{totalMyDebt.toFixed(2)} ₼</span>
              </div>
            </div>

            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
              <div className="size-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Gecikmiş Ödənişlər</span>
                <span className={`text-base font-black block mt-0.5 ${overdueMyDebt > 0 ? "text-red-600" : "text-gray-900"}`}>{overdueMyDebt.toFixed(2)} ₼</span>
              </div>
              {overdueMyDebt > 0 && (
                <span className="absolute top-3 right-3 size-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </div>

            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Yaxınlaşan (3 gün)</span>
                <span className="text-base font-black text-amber-600 block mt-0.5">{approachingMyDebt.toFixed(2)} ₼</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 border-t border-gray-50 pt-4">
            <h3 className="font-extrabold text-sm text-gray-900">Tədarükçülərə Olan Anbar Borclarımız</h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-100">
              Toplam {filteredMyDebts.length} ədəd
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-2">Tədarükçü</th>
                  <th className="py-2.5 px-2">Məhsul Detalları</th>
                  <th className="py-2.5 px-2">Alış Tarixi</th>
                  <th className="py-2.5 px-2">Son Ödəniş Tarixi</th>
                  <th className="py-2.5 px-2 text-right">Borc Məbləği</th>
                  <th className="py-2.5 px-2 text-right pr-4 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {isMyDebtsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                      Yüklənir...
                    </td>
                  </tr>
                ) : paginatedMyDebts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-emerald-600 font-semibold">
                      Borc siyahısı boşdur. 🎉
                    </td>
                  </tr>
                ) : (
                  paginatedMyDebts.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                      {/* Supplier with mini brand circle */}
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-[10px]">
                            {item.supplier ? item.supplier.charAt(0).toUpperCase() : "T"}
                          </div>
                          <span className="font-extrabold text-gray-900">{item.supplier || "Bilinməyən Tədarükçü"}</span>
                        </div>
                      </td>

                      {/* Product details & Price breakdown */}
                      <td className="py-4 px-2">
                        <span className="font-bold text-gray-900 block">{item.productName}</span>
                        <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">
                          {item.quantity} {item.unit || "ədəd"} × {item.purchasePrice.toFixed(2)} ₼
                        </span>
                      </td>

                      {/* Purchase Date */}
                      <td className="py-4 px-2 text-gray-500 font-mono font-medium">
                        {new Date(item.entryDate).toLocaleDateString("az-AZ")}
                      </td>

                      {/* Due Date with dynamic countdown badging */}
                      <td className="py-4 px-2 font-bold">
                        {(() => {
                          if (!item.creditDueDate) return <span className="text-gray-400 font-medium">Təyin edilməyib</span>;
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const due = new Date(item.creditDueDate);
                          due.setHours(0,0,0,0);
                          const diffTime = due.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          
                          if (diffDays < 0) {
                            return (
                              <div className="flex flex-col text-left">
                                <span className="text-red-600 font-bold font-mono">{due.toLocaleDateString("az-AZ")}</span>
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  {Math.abs(diffDays)} gün gecikir
                                </span>
                              </div>
                            );
                          } else if (diffDays === 0) {
                            return (
                              <div className="flex flex-col text-left">
                                <span className="text-amber-600 font-bold font-mono">{due.toLocaleDateString("az-AZ")}</span>
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide w-fit animate-pulse">
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  BU GÜN
                                </span>
                              </div>
                            );
                          } else if (diffDays <= 3) {
                            return (
                              <div className="flex flex-col text-left">
                                <span className="text-amber-600 font-bold font-mono">{due.toLocaleDateString("az-AZ")}</span>
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide w-fit">
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  {diffDays} gün qalıb
                                </span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex flex-col text-left">
                                <span className="text-emerald-600 font-bold font-mono">{due.toLocaleDateString("az-AZ")}</span>
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide w-fit">
                                  {diffDays} gün qalıb
                                </span>
                              </div>
                            );
                          }
                        })()}
                      </td>

                      {/* Total Debt Amount */}
                      <td className="py-4 px-2 text-right font-black text-gray-950 font-mono text-sm">
                        {item.totalAmount.toFixed(2)} ₼
                      </td>

                      {/* Pay Debt Button */}
                      <td className="py-4 px-2 text-right pr-4">
                        <button
                          onClick={() => {
                            setSelectedDebt(item);
                            setPayType("Nəğd");
                            setPayFrom("");
                            setPayNotes("");
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer flex items-center gap-1 ml-auto transition-all shadow-sm animate-in fade-in"
                        >
                          <Check className="w-3.5 h-3.5" /> Borcu Ödə
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {myDebtsTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100/50 mt-4 text-xs font-bold">
              <span className="text-gray-400 font-semibold">
                Səhifə {myDebtsPage} / {myDebtsTotalPages} (Göstərilir: {paginatedMyDebts.length} / {filteredMyDebts.length})
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMyDebtsPage((p) => Math.max(1, p - 1))}
                  disabled={myDebtsPage === 1}
                  className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                >
                  Əvvəlki
                </button>
                <button
                  onClick={() => setMyDebtsPage((p) => Math.min(myDebtsTotalPages, p + 1))}
                  disabled={myDebtsPage === myDebtsTotalPages}
                  className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-bold"
                >
                  Növbəti
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUPPLIER DEBT PAY DETAILS MODAL */}
      {selectedDebt !== null && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-5">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight">
                Borc Ödənişi
              </h3>
              <button onClick={() => setSelectedDebt(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3.5 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Tədarükçü:</span>
                <span className="font-bold text-gray-900">{selectedDebt.supplier || "Bilinməyən Tədarükçü"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Məhsul:</span>
                <span className="font-semibold text-gray-700">{selectedDebt.productName}</span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-gray-200/50 mt-1">
                <span className="text-gray-400 font-bold">Ödəniləcək Məbləğ:</span>
                <span className="font-black text-gray-900 font-mono text-sm">{selectedDebt.totalAmount.toFixed(2)} ₼</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                paySupplierMutation.mutate({
                  id: selectedDebt.id,
                  paymentType: payType,
                  paymentFrom: payFrom,
                  notes: payNotes
                });
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ödəniş Üsulu *</label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                  required
                >
                  <option value="Nəğd">Nəğd</option>
                  <option value="Kart">Kart</option>
                  <option value="Kart2Kart">Kart2Kart</option>
                  <option value="Köçürmə">Köçürmə</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Hardan Ödənildi? (Ödəniş Mənbəyi) *</label>
                <input
                  type="text"
                  placeholder="Məs. Əsas Kassa, Şəxsi Kart, Bank Hesabı"
                  value={payFrom}
                  onChange={(e) => setPayFrom(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qeyd (İxtiyari)</label>
                <textarea
                  placeholder="Ödəniş haqqında əlavə qeydlər"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-50 mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedDebt(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={paySupplierMutation.isPending}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {paySupplierMutation.isPending ? "Gözləyin..." : "Ödənişi Təsdiqlə"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
