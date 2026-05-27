import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { History, Search, FileText, ArrowRight, Eye } from "lucide-react";

interface Sale {
  id: number;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentType: string;
  creditDueDate: string | null;
  notes: string | null;
  saleDate: string;
  totalAmount: number;
  totalCost: number;
  paymentStatus: string;
}

const paymentBadges: Record<string, string> = {
  Nəğd: "bg-green-50 text-green-700 border-green-100",
  Kart: "bg-blue-50 text-blue-700 border-blue-100",
  Kart2Kart: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Nisyə: "bg-amber-50 text-amber-700 border-amber-100",
};

export default function SalesHistory() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = user?.role === "Admin";

  // Queries
  const params = filterActive ? `?from=${fromDate}&to=${toDate}` : "";

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales", fromDate, toDate, filterActive],
    queryFn: async () => {
      const res = await fetch(`/api/sales${params}`);
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
    setSearchQuery("");
  };

  const filteredSales = (sales || []).filter((sale) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const formattedId = `#${sale.id.toString().padStart(5, "0")}`;
    return (
      sale.id.toString().includes(q) ||
      formattedId.toLowerCase().includes(q) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
      (sale.customerPhone && sale.customerPhone.toLowerCase().includes(q)) ||
      (sale.paymentType && sale.paymentType.toLowerCase().includes(q)) ||
      (sale.notes && sale.notes.toLowerCase().includes(q))
    );
  });

  const totalSalesRevenue = filteredSales ? filteredSales.reduce((sum, s) => sum + s.totalAmount, 0) : 0;
  const totalSalesCost = filteredSales ? filteredSales.reduce((sum, s) => sum + s.totalCost, 0) : 0;
  const totalSalesProfit = totalSalesRevenue - totalSalesCost;

  return (
    <div className="space-y-6 animate-in fade-in-0">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Satış Tarixçəsi</h2>
          <p className="text-xs text-gray-400 mt-1">Sistemdə qeydə alınmış bütün satışların qaimələri</p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass w-full md:w-auto">
          <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Başlanğıc</label>
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
      </div>

      {/* Search Input bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold max-w-md">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qaimə / Müştəri Axtar</label>
          <input
            type="text"
            placeholder="Qaimə № (məs. #00001), müştəri adı, telefon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
          />
        </div>
      </div>

      {/* Overview Analytics for current filter */}
      {!isLoading && filteredSales && filteredSales.length > 0 && (
        <div className={`grid gap-4 grid-cols-1 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-1 max-w-sm"} p-4 bg-primary/5 border border-primary/10 rounded-2xl glass text-xs font-medium text-gray-500`}>
          <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dövr Gəliri</span>
            <span className="text-xl font-bold text-gray-900 font-mono block mt-1">
              {totalSalesRevenue.toFixed(2)} ₼
            </span>
          </div>
          {isAdmin && (
            <>
              <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dövr Mayası</span>
                <span className="text-xl font-bold text-gray-900 font-mono block mt-1">
                  {totalSalesCost.toFixed(2)} ₼
                </span>
              </div>
              <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl text-green-600">
                <span className="text-[10px] font-bold text-green-600/60 uppercase tracking-wider block">Dövr Mənfəəti</span>
                <span className="text-xl font-bold font-mono block mt-1">
                  +{totalSalesProfit.toFixed(2)} ₼
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sales History Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 pl-6 text-center w-16">Qaimə №</th>
                <th className="p-4">Müştəri</th>
                <th className="p-4">Tarix</th>
                <th className="p-4 text-center">Ödəniş Üsulu</th>
                <th className="p-4 text-right">Məbləğ</th>
                {isAdmin && <th className="p-4 text-right">Mənfəət</th>}
                <th className="p-4 text-center">Vəziyyət</th>
                <th className="p-4 text-right pr-6 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-10 text-center text-xs text-gray-400">
                    Yüklənir...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-16 text-center text-xs text-gray-400">
                    {searchQuery ? "Axtarışa uyğun satış qaiməsi tapılmadı." : "Heç bir satış tapılmadı."}
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const profit = sale.totalAmount - sale.totalCost;
                  return (
                    <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                      <td className="p-4 text-center font-mono text-gray-900 font-bold">
                        #{sale.id.toString().padStart(5, "0")}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-gray-900 block">{sale.customerName || "Nəğd Satış"}</span>
                        {sale.customerPhone && (
                          <span className="text-[10px] text-gray-400 mt-0.5 block">{sale.customerPhone}</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-500 font-medium">
                        {new Date(sale.saleDate).toLocaleDateString("az-AZ")} |{" "}
                        {new Date(sale.saleDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold ${paymentBadges[sale.paymentType] || "bg-gray-50 text-gray-500"}`}>
                          {sale.paymentType}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-gray-950 font-mono">
                        {sale.totalAmount.toFixed(2)} ₼
                      </td>
                      {isAdmin && (
                        <td className={`p-4 text-right font-bold font-mono ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {profit >= 0 ? "+" : ""}
                          {profit.toFixed(2)} ₼
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            sale.paymentStatus === "paid"
                              ? "bg-green-50 text-green-700 border-green-100"
                              : "bg-red-50 text-red-600 border-red-100"
                          }`}
                        >
                          {sale.paymentStatus === "paid" ? "Ödənilib" : "Nisyə"}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <Link href={`/satislar/${sale.id}`}>
                          <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
