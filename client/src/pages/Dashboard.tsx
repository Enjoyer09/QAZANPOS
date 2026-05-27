import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Boxes,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Search,
} from "lucide-react";

interface SummaryData {
  todayRevenue: number;
  todayCost: number;
  todayProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  todaySales: number;
  monthRevenue: number;
  monthProfit: number;
  monthExpenses: number;
  monthNetProfit: number;
  totalStockValue: number;
  lowStockCount: number;
  totalCreditDebt: number;
  overdueCreditsCount: number;
  myTotalDebt: number;
}

export default function Dashboard() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterActive, setFilterActive] = useState(false);

  // Queries
  const summaryParams = filterActive
    ? `?from=${fromDate}&to=${toDate}`
    : "";

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<SummaryData>({
    queryKey: ["/api/dashboard/summary", fromDate, toDate, filterActive],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/summary${summaryParams}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: recentSales, isLoading: isRecentLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-sales"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/recent-sales");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: lowStock, isLoading: isLowStockLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/low-stock"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/low-stock");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const handleFilter = () => {
    setFilterActive(true);
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setFilterActive(false);
  };

  const getPeriodLabel = () => {
    if (!filterActive) return "Bu gün";
    const fromStr = fromDate ? new Date(fromDate).toLocaleDateString("az-AZ") : "...";
    const toStr = toDate ? new Date(toDate).toLocaleDateString("az-AZ") : "...";
    return `${fromStr} — ${toStr}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in-0">
      {/* Header & Date Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">İdarəetmə Paneli</h2>
          <p className="text-sm text-gray-400 mt-1">
            Dövr: <span className="font-semibold text-gray-700">{getPeriodLabel()}</span>
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass w-full md:w-auto">
          <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Başlanğıc
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Son</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={!fromDate && !toDate}
            className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 w-full sm:w-auto"
          >
            Filtrlə
          </button>
          {filterActive && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer w-full sm:w-auto"
            >
              Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* 1. Main Period Stats (Revenue, Cost, Profit, Expenses) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satış Gəliri</span>
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight font-mono">
              {isSummaryLoading ? "..." : `${(summary?.todayRevenue || 0).toFixed(2)} ₼`}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">
              {summary?.todaySales || 0} uğurlu satış
            </p>
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Məhsul Mayası</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight font-mono">
              {isSummaryLoading ? "..." : `${(summary?.todayCost || 0).toFixed(2)} ₼`}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">anbar alış qiyməti ilə</p>
          </div>
        </div>

        {/* Sales Profit */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satış Mənfəəti</span>
            <div className="size-8 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-green-600 tracking-tight font-mono">
              {isSummaryLoading ? "..." : `${(summary?.todayProfit || 0).toFixed(2)} ₼`}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">gəlir − maya dəyəri</p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Digər Xərclər</span>
            <div className="size-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-red-500 tracking-tight font-mono">
              {isSummaryLoading ? "..." : `${(summary?.todayExpenses || 0).toFixed(2)} ₼`}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">maaş, icarə və kommunal</p>
          </div>
        </div>
      </div>

      {/* 2. NET PROFIT OVERVIEW */}
      <div
        className={`border p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all duration-300 ${
          (summary?.todayNetProfit || 0) >= 0
            ? "border-green-200 bg-green-50/20"
            : "border-red-200 bg-red-50/20"
        }`}
      >
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            XALİS MƏNFƏƏT (Satış mənfəəti − Digər xərclər)
          </p>
          <h2
            className={`text-4xl font-black tracking-tight font-mono ${
              (summary?.todayNetProfit || 0) >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {isSummaryLoading ? "..." : `${(summary?.todayNetProfit || 0).toFixed(2)} ₼`}
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            Seçilmiş dövr ərzindəki real qazancınız
          </p>
        </div>

        {/* Current Month Summaries */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-5 bg-white/70 rounded-xl border border-gray-100/50 glass text-xs">
          <div>
            <span className="text-gray-400 font-medium block">Ay Gəliri</span>
            <span className="font-bold text-sm block mt-1 font-mono text-gray-900">
              {isSummaryLoading ? "..." : `${(summary?.monthRevenue || 0).toFixed(2)} ₼`}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-medium block">Ay Mənfəəti</span>
            <span className="font-bold text-sm block mt-1 font-mono text-green-600">
              {isSummaryLoading ? "..." : `${(summary?.monthProfit || 0).toFixed(2)} ₼`}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-medium block">Ay Xərcləri</span>
            <span className="font-bold text-sm block mt-1 font-mono text-red-500">
              {isSummaryLoading ? "..." : `${(summary?.monthExpenses || 0).toFixed(2)} ₼`}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-medium block">Ay Xalis Mənfəət</span>
            <span
              className={`font-bold text-sm block mt-1 font-mono ${
                (summary?.monthNetProfit || 0) >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {isSummaryLoading ? "..." : `${(summary?.monthNetProfit || 0).toFixed(2)} ₼`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Secondary Analytics (Stock Value, Debts, Outstandings) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Stock Value */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Anbar Dəyəri</span>
          <h4 className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {isSummaryLoading ? "..." : `${(summary?.totalStockValue || 0).toFixed(2)} ₼`}
          </h4>
          <span className="text-[10px] text-gray-400 mt-1 block font-medium">anbardakı malların mayası</span>
        </div>

        {/* Low Stock count */}
        <div
          className={`border p-5 rounded-2xl shadow-xs transition-all ${
            (summary?.lowStockCount || 0) > 0 ? "border-amber-200 bg-amber-50/20" : "bg-white border-gray-100"
          }`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Az qalan mallar
          </span>
          <h4
            className={`text-xl font-bold mt-2 font-mono ${
              (summary?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {isSummaryLoading ? "..." : summary?.lowStockCount} məhsul
          </h4>
          <span className="text-[10px] text-gray-400 mt-1 block font-medium">miqdarı 5 ədəddən azdır</span>
        </div>

        {/* Debts due to us */}
        <div
          className={`border p-5 rounded-2xl shadow-xs transition-all ${
            (summary?.totalCreditDebt || 0) > 0 ? "border-red-200 bg-red-50/20" : "bg-white border-gray-100"
          }`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Müştərilərin Borcu
          </span>
          <h4
            className={`text-xl font-bold mt-2 font-mono ${
              (summary?.totalCreditDebt || 0) > 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {isSummaryLoading ? "..." : `${(summary?.totalCreditDebt || 0).toFixed(2)} ₼`}
          </h4>
          <span className="text-[10px] text-gray-400 mt-1 block font-medium">
            {summary?.overdueCreditsCount || 0} müştərinin müddəti keçib
          </span>
        </div>

        {/* Debts we owe to suppliers */}
        <div
          className={`border p-5 rounded-2xl shadow-xs transition-all ${
            (summary?.myTotalDebt || 0) > 0 ? "border-amber-200 bg-amber-50/20" : "bg-white border-gray-100"
          }`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Mənim Borcum
          </span>
          <h4
            className={`text-xl font-bold mt-2 font-mono ${
              (summary?.myTotalDebt || 0) > 0 ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {isSummaryLoading ? "..." : `${(summary?.myTotalDebt || 0).toFixed(2)} ₼`}
          </h4>
          <span className="text-[10px] text-gray-400 mt-1 block font-medium">tədarükçülərə anbar nisyəsi</span>
        </div>
      </div>

      {/* 4. Recent Sales and Low Stock Alert lists */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Sales List */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Son Satışlar</h3>
            <Link href="/satislar" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
              Hamısına bax <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {isRecentLoading ? (
              <p className="text-xs text-gray-400">Yüklənir...</p>
            ) : !recentSales || recentSales.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Hələ heç bir satış qeydə alınmayıb.</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0 text-xs">
                  <div>
                    <span className="font-semibold block text-gray-900">{sale.customerName || "Nəğd Satış"}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      {new Date(sale.saleDate).toLocaleDateString("az-AZ")} | {sale.paymentType}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold block text-gray-950 font-mono">{sale.totalAmount.toFixed(2)} ₼</span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                        sale.paymentStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sale.paymentStatus === "paid" ? "Ödənilib" : "Nisyə"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Items List */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Tükənməkdə Olan Mallar</h3>
            <Link href="/anbar" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
              Anbara bax <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {isLowStockLoading ? (
              <p className="text-xs text-gray-400">Yüklənir...</p>
            ) : !lowStock || lowStock.length === 0 ? (
              <p className="text-xs text-green-600 py-6 text-center font-medium">Bütün məhsulların anbar qalığı normaldır. 🎉</p>
            ) : (
              lowStock.map((item) => (
                <div key={item.productId} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0 text-xs">
                  <div>
                    <span className="font-semibold block text-gray-900">{item.productName}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Məhsul ID: #{item.productId}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-600 block font-mono">
                      {item.currentQuantity} {item.unit}
                    </span>
                    <span className="text-[9px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                      Kritik Qalıq
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
