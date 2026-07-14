import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  AlertTriangle, Clock, Check, Eye, X, Lock, LayoutGrid, List, Smartphone
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { TableSkeleton } from "../components/Skeleton.tsx";

const getAvatarGradient = (name: string) => {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-teal-500 to-emerald-500",
    "from-amber-500 to-orange-500",
    "from-fuchsia-500 to-purple-600",
  ];
  return gradients[hash % gradients.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function Debts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFixing, setIsFixing] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number; message: string } | null>(null);
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);
  const [smsTargetIds, setSmsTargetIds] = useState<number[] | null>(null);

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  })();
  const isAdmin = user?.role === "Admin";

  const { data: currentUser, isLoading: isUserLoading } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const [activeTab, setActiveTab] = useState<"customers" | "my-debts">("customers");
  const currentTab = isAdmin ? activeTab : "customers";

  // View Mode: list or kanban (default: kanban for premium look)
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");

  // Kanban override stages map
  const [stages, setStages] = useState<Record<number, "pending" | "overdue" | "notified" | "risk">>(() => {
    try {
      const saved = localStorage.getItem("qazanpos_debt_kanban_stages");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  // Filter & Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [pageSize, setPageSize] = useState(10);

  const [overduePage, setOverduePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [myDebtsPage, setMyDebtsPage] = useState(1);

  // Supplier Debt Payment Modal States
  const [selectedDebt, setSelectedDebt] = useState<any | null>(null);
  const [payType, setPayType] = useState("Nəğd");
  const [payFrom, setPayFrom] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Customer Debt Payment Modal States
  const [selectedCustDebt, setSelectedCustDebt] = useState<any | null>(null);
  const [custPayType, setCustPayType] = useState("Nəğd");

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

  // Mutation: Collect customer debt fully
  const payCustomerDebtMutation = useMutation({
    mutationFn: async ({ id, paymentType }: { id: number; paymentType: string }) => {
      const res = await fetch(`/api/sales/${id}/pay-credit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Borc ödənildi!", description: "Müştəri nisyə borcu tam ödənildi.", variant: "success" });
      setSelectedCustDebt(null);
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Borc ödənilərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const handleFixCredits = async () => {
    setIsFixing(true);
    try {
      const res = await fetch("/api/sales/fix-past-credits", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Düzəliş zamanı xəta baş verdi");
      }
      const data = await res.json();
      toast({
        title: "Düzəliş Uğurludur!",
        description: data.message,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    } catch (err: any) {
      toast({
        title: "Xəta!",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  const sendSingleSMS = async (item: any) => {
    setSmsSending(true);
    try {
      const res = await fetch("/api/credits/send-sms-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds: [item.id] }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({
        title: data.sent > 0 ? "SMS göndərildi!" : "SMS göndərilmədi",
        description: data.message,
        variant: data.failed > 0 ? "destructive" : "success",
      });
    } catch {
      toast({ title: "Xəta!", description: "SMS göndərilərkən xəta baş verdi.", variant: "destructive" });
    } finally {
      setSmsSending(false);
    }
  };

  const sendBulkSMS = async () => {
    setSmsSending(true);
    setSmsConfirmOpen(false);
    try {
      const res = await fetch("/api/credits/send-sms-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smsTargetIds ? { saleIds: smsTargetIds } : {}),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSmsResult(data);
      if (data.failed > 0) {
        toast({ title: "Bəzi SMS-lər göndərilmədi", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Xəta!", description: "SMS-lər göndərilərkən xəta baş verdi.", variant: "destructive" });
    } finally {
      setSmsSending(false);
      setSmsTargetIds(null);
    }
  };

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

  // combined customer debts for Kanban
  const combinedCustomerDebts = [...filteredOverdue, ...filteredPending];

  const getCardStage = (item: any) => {
    if (stages[item.id]) {
      return stages[item.id];
    }
    const isOverdue = overdueList?.some(o => o.id === item.id);
    return isOverdue ? "overdue" : "pending";
  };

  const handleMoveStage = (saleId: number, targetStage: "pending" | "overdue" | "notified" | "risk") => {
    const updated = { ...stages, [saleId]: targetStage };
    setStages(updated);
    localStorage.setItem("qazanpos_debt_kanban_stages", JSON.stringify(updated));
    toast({ title: "Mərhələ yeniləndi", variant: "success" });
  };

  const onDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", id.toString());
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, targetStage: "pending" | "overdue" | "notified" | "risk") => {
    const id = parseInt(e.dataTransfer.getData("text/plain") || "0");
    if (id) {
      handleMoveStage(id, targetStage);
    }
  };

  if (user?.role !== "Admin" && (isUserLoading || currentUser?.staffCanViewDebts !== 1)) {
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
    <div className="space-y-6 animate-in fade-in-0 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Nisyə və Borc İdarəetməsi</h2>
          <p className="text-xs text-gray-400 mt-1">
            Müştərilərin bizə olan nisyə borcları və bizim tədarükçülərə olan anbar borclarımız
          </p>
        </div>          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSmsTargetIds(null);
                  setSmsConfirmOpen(true);
                }}
                disabled={smsSending}
                className="px-4.5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 select-none flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" /> Toplu SMS Xatırlat
              </button>
              <button
                onClick={handleFixCredits}
                disabled={isFixing}
                className="px-4.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 select-none"
              >
                {isFixing ? "Düzəldilir..." : "Köhnə Nisyə Statuslarını Düzəlt"}
              </button>
            </div>
          )}
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
          {/* View Mode Toggle switcher */}
          <div className="flex justify-between items-center bg-white border border-gray-100 p-1.5 rounded-xl shadow-3xs glass-card max-w-[280px] font-bold text-[11px] text-gray-400 select-none">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg cursor-pointer transition-all ${viewMode === "kanban" ? "bg-primary text-white" : "hover:text-gray-900"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban Lövhəsi
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg cursor-pointer transition-all ${viewMode === "list" ? "bg-primary text-white" : "hover:text-gray-900"}`}
            >
              <List className="w-3.5 h-3.5" /> Siyahı Görünüşü
            </button>
          </div>

          {viewMode === "list" ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Gecikmiş Borclar (Overdue) list */}
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
                        <TableSkeleton rows={5} colSpan={5} />
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
                              <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedCustDebt(item)}
                      className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase rounded-lg cursor-pointer"
                    >
                      Ödə
                    </button>
                    {item.customerPhone && (
                      <button
                        onClick={() => sendSingleSMS(item)}
                        disabled={smsSending}
                        className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] uppercase rounded-lg cursor-pointer flex items-center gap-1 border border-blue-100 disabled:opacity-50"
                        title="SMS Xatırlatma Göndər"
                      >
                        <Smartphone className="w-3 h-3" /> SMS
                      </button>
                    )}
                    <Link href={`/satislar/${item.id}`}>
                      <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

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

              {/* Aktiv Borclar (Pending) list */}
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
                        <TableSkeleton rows={5} colSpan={5} />
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
                              <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedCustDebt(item)}
                      className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase rounded-lg cursor-pointer"
                    >
                      Ödə
                    </button>
                    {item.customerPhone && (
                      <button
                        onClick={() => sendSingleSMS(item)}
                        disabled={smsSending}
                        className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] uppercase rounded-lg cursor-pointer flex items-center gap-1 border border-blue-100 disabled:opacity-50"
                        title="SMS Xatırlatma Göndər"
                      >
                        <Smartphone className="w-3 h-3" /> SMS
                      </button>
                    )}
                    <Link href={`/satislar/${item.id}`}>
                      <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

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
          ) : (
            /* Kanban Board view mode */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4 items-start select-none animate-in fade-in duration-200">
              {[
                { id: "pending", title: "Aktiv (Pending)", badgeColor: "bg-blue-50 text-blue-600 border border-blue-100" },
                { id: "overdue", title: "Gecikmiş (Overdue)", badgeColor: "bg-red-50 text-red-600 border border-red-100" },
                { id: "notified", title: "Xəbərdar Edilib", badgeColor: "bg-amber-50 text-amber-600 border border-amber-100" },
                { id: "risk", title: "Riskli / Problemli", badgeColor: "bg-purple-50 text-purple-600 border border-purple-100" }
              ].map((col) => {
                const colCards = combinedCustomerDebts.filter(item => getCardStage(item) === col.id);
                const colTotal = colCards.reduce((sum, item) => sum + (parseFloat(item.remainingDebt) || 0), 0);

                return (
                  <div 
                    key={col.id} 
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, col.id as any)}
                    className="bg-gray-50/60 border border-gray-100 rounded-2xl p-3.5 flex flex-col space-y-3.5 min-h-[450px] transition-all hover:bg-gray-100/40"
                  >
                    {/* Column Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                      <div className="space-y-0.5">
                        <h4 className="text-[11px] font-black text-gray-800 tracking-wide uppercase">{col.title}</h4>
                        <span className="text-[10px] text-gray-400 block font-mono font-bold">{colTotal.toFixed(2)} ₼</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${col.badgeColor}`}>
                        {colCards.length}
                      </span>
                    </div>

                    {/* Cards area */}
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {colCards.length === 0 ? (
                        <div className="text-center py-10 text-[10px] font-bold text-gray-300 border border-dashed border-gray-200/50 rounded-xl">
                          Sürükləyib bura yerləşdirin
                        </div>
                      ) : (
                        colCards.map((item) => {
                          const grad = getAvatarGradient(item.customerName || "A");
                          const initials = getInitials(item.customerName || "A");
                          const remainingVal = parseFloat(item.remainingDebt) || 0;
                          const dueDateFormatted = new Date(item.creditDueDate).toLocaleDateString("az-AZ");

                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, item.id)}
                              className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-3xs cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-2xs transition-all space-y-3.5 relative group"
                            >
                              {/* Header: Avatar, Name and Invoice */}
                              <div className="flex items-start gap-2.5">
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-extrabold text-[10px] shrink-0`}>
                                  {initials}
                                </div>
                                <div className="text-left space-y-0.5 min-w-0">
                                  <span className="font-extrabold text-xs text-gray-900 block truncate leading-tight">{item.customerName || "Anonim Müştəri"}</span>
                                  <span className="font-bold text-[10px] text-gray-400 block font-mono">Çek №{item.id}</span>
                                </div>
                              </div>

                              {/* Info details: Date and Price */}
                              <div className="flex justify-between items-center text-[10px] font-bold pt-2 border-t border-gray-50/50">
                                <div className="space-y-0.5 text-left">
                                  <span className="text-gray-400 text-[8px] uppercase tracking-wider block font-bold">Son Tarix</span>
                                  <span className={`font-semibold font-mono ${col.id === "overdue" ? "text-red-500 font-bold" : "text-gray-500"}`}>{dueDateFormatted}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-gray-400 text-[8px] uppercase tracking-wider block font-bold">Borc</span>
                                  <span className={`font-black font-mono text-xs ${col.id === "overdue" ? "text-red-600" : "text-gray-900"}`}>{remainingVal.toFixed(2)} ₼</span>
                                </div>
                              </div>

                              {/* Card Actions */}
                              <div className="flex gap-1.5 pt-2.5 border-t border-gray-50/50">
                                <button
                                  onClick={() => setSelectedCustDebt(item)}
                                  className="flex-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-extrabold text-[10px] rounded-lg cursor-pointer transition-all border border-green-100/50"
                                >
                                  Borcu Ödə
                                </button>
                                {item.customerPhone && (
                                  <button
                                    onClick={() => sendSingleSMS(item)}
                                    disabled={smsSending}
                                    className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-extrabold text-[10px] rounded-lg cursor-pointer transition-all border border-blue-100/50 disabled:opacity-50 flex items-center gap-1"
                                    title="SMS Xatırlatma Göndər"
                                  >
                                    <Smartphone className="w-3 h-3" />
                                  </button>
                                )}
                                
                                <select
                                  value={col.id}
                                  onChange={(e) => handleMoveStage(item.id, e.target.value as any)}
                                  className="px-1 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-[9px] font-bold bg-white focus:outline-none cursor-pointer w-20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="pending">Aktiv</option>
                                  <option value="overdue">Gecikmiş</option>
                                  <option value="notified">Notified</option>
                                  <option value="risk">Riskli</option>
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  <TableSkeleton rows={5} colSpan={6} />
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
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide w-fit animate-in fade-in">
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
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer flex items-center gap-1 ml-auto transition-all shadow-sm"
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
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
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

      {/* 4. CUSTOMER CREDIT DEBT PAY MODAL */}
      {selectedCustDebt !== null && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50 mb-4">
              <h3 className="font-extrabold text-gray-900 text-base leading-tight">
                Müştəri Borcunu Yığmaq
              </h3>
              <button onClick={() => setSelectedCustDebt(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3.5 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-gray-400">Müştəri:</span>
                <span className="font-bold text-gray-900">{selectedCustDebt.customerName || "Anonim Müştəri"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Çek №:</span>
                <span className="font-mono text-gray-700">#{selectedCustDebt.id}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-200/50 mt-1">
                <span className="text-gray-400 font-bold">Qalıq Borc Məbləği:</span>
                <span className="font-black text-green-600 font-mono text-sm">{(parseFloat(selectedCustDebt.remainingDebt) || 0).toFixed(2)} ₼</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                payCustomerDebtMutation.mutate({
                  id: selectedCustDebt.id,
                  paymentType: custPayType
                });
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ödəniş Üsulu *</label>
                <select
                  value={custPayType}
                  onChange={(e) => setCustPayType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold"
                  required
                >
                  <option value="Nəğd">Nəğd</option>
                  <option value="Kart">Kart</option>
                  <option value="Kart2Kart">Kart2Kart</option>
                  <option value="Köçürmə">Köçürmə</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-50 mt-5">
                <button
                  type="button"
                  onClick={() => setSelectedCustDebt(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={payCustomerDebtMutation.isPending}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {payCustomerDebtMutation.isPending ? "Gözləyin..." : "Borcu Tam Ödə"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SMS SEND CONFIRMATION MODAL */}
      {smsConfirmOpen && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight">
                <Smartphone className="w-5 h-5 inline mr-2 text-blue-500" />
                SMS Xatırlatma Göndər
              </h3>
              <button onClick={() => { setSmsConfirmOpen(false); setSmsTargetIds(null); }} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 space-y-3 text-xs">
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="font-semibold text-blue-800">
                  {smsTargetIds
                    ? `Seçilmiş ${smsTargetIds.length} müştəriyə SMS xatırlatma göndərilsin?`
                    : `Bütün gecikmiş borclu müştərilərə SMS xatırlatma göndərilsin?`}
                </p>
              </div>
              <p className="text-gray-500 font-medium">
                SMS-lər Ayarlar səhifəsində qeyd olunmuş SMS şablonu əsasında və qeyd olunmuş API açarı ilə göndəriləcək.
                Hər bir müştəriyə borc məbləği və son ödəniş tarixi qeyd olunan fərdiləşdirilmiş mesaj göndərilir.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-gray-50">
              <button
                type="button"
                onClick={() => { setSmsConfirmOpen(false); setSmsTargetIds(null); }}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 cursor-pointer"
                disabled={smsSending}
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={sendBulkSMS}
                disabled={smsSending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                {smsSending ? "Göndərilir..." : "Təsdiqlə və Göndər"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SMS RESULT MODAL */}
      {smsResult && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight">
                SMS Göndərilmə Nəticəsi
              </h3>
              <button onClick={() => setSmsResult(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3.5 rounded-xl border ${smsResult.failed > 0 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                <p className={`font-bold ${smsResult.failed > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                  {smsResult.message}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <span className="text-lg font-black text-emerald-600 block">{smsResult.sent}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Göndərildi</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <span className="text-lg font-black text-red-500 block">{smsResult.failed}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Uğursuz</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-gray-50">
              <button
                onClick={() => setSmsResult(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl cursor-pointer"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
