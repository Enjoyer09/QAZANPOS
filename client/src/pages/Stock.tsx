import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PlusCircle, Search, HelpCircle, Lock } from "lucide-react";

interface StockLevel {
  productId: number;
  productName: string;
  category: string | null;
  unit: string;
  currentQuantity: number;
  lastPurchasePrice: number;
  totalValue: number;
  lastPurchaseDate?: string | null;
}
export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
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

  const { data: list, isLoading } = useQuery<StockLevel[]>({
    queryKey: ["/api/stock/levels"],
    queryFn: async () => {
      const res = await fetch("/api/stock/levels");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const normalizeSearchText = (text: string): string => {
    if (!text) return "";
    return text
      .toLocaleLowerCase("az-AZ")
      .replace(/ı/g, "i")
      .replace(/ə/g, "e")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g");
  };

  const filteredList = (list || []).filter((item) => {
    const q = searchQuery.trim();
    if (!q) return true;
    const qNorm = normalizeSearchText(q);
    return (
      normalizeSearchText(item.productName).includes(qNorm) ||
      (item.category && normalizeSearchText(item.category).includes(qNorm))
    );
  });

  const getStatusBadge = (qty: number) => {
    if (qty <= 0) {
      return (
        <span className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
          Bitib
        </span>
      );
    }
    if (qty < 5) {
      return (
        <span className="bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
          Az qalıb
        </span>
      );
    }
    return (
      <span className="bg-green-50 text-green-700 border border-green-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
        Normal
      </span>
    );
  };

  const totalStockValue = list ? list.reduce((sum, item) => sum + (item.totalValue || 0), 0) : 0;

  if (user?.role !== "Admin" && currentUser?.staffCanViewStock === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Anbara Giriş Məhdudlaşdırılıb 🔒</h3>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Anbar Qalıqları</h2>
          <p className="text-xs text-gray-400 mt-1">Anbardakı məhsulların cari miqdarı, dəyəri və vəziyyəti</p>
        </div>

        <Link href="/anbar/daxil">
          <button className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate">
            <PlusCircle className="w-4 h-4" /> Anbara Mədaxil
          </button>
        </Link>
      </div>

      {/* Search Input bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold max-w-md">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul / Kateqoriya Axtar</label>
          <input
            type="text"
            placeholder="Məhsul adı və ya kateqoriya..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
          />
        </div>
      </div>

      {/* Stock levels table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Məhsul</th>
                <th className="p-4">Kateqoriya</th>
                <th className="p-4 text-center">Son Alış Tarixi</th>
                <th className="p-4 text-right">Cari Miqdar</th>
                <th className="p-4 text-right">Son Alış Qiyməti</th>
                <th className="p-4 text-right">Ümumi Dəyər</th>
                <th className="p-4 pl-8">Vəziyyət</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-gray-400">
                    Yüklənir...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-xs text-gray-400">
                    {searchQuery ? "Axtarışa uyğun məhsul tapılmadı." : "Anbar boşdur. Anbara məhsul mədaxil edin."}
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                    <td className="p-4 pl-6 font-bold text-gray-900">{item.productName}</td>
                    <td className="p-4 font-medium text-gray-600">
                      {item.category ? (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {item.category}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-center font-mono font-medium text-gray-500">
                      {item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString("az-AZ") : "—"}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900 font-mono">
                      {item.currentQuantity} <span className="text-[10px] text-gray-400 font-sans font-medium ml-0.5">{item.unit}</span>
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-600 font-mono">
                      {item.lastPurchasePrice > 0 ? `${item.lastPurchasePrice.toFixed(2)} ₼` : "—"}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-950 font-mono">
                      {item.totalValue > 0 ? `${item.totalValue.toFixed(2)} ₼` : "0.00 ₼"}
                    </td>
                    <td className="p-4 pl-8 font-medium">{getStatusBadge(item.currentQuantity)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock summaries */}
      {!isLoading && list && list.length > 0 && (
        <div className="flex justify-end pt-2">
          <div className="bg-primary/5 border border-primary/10 rounded-2xl px-6 py-4 text-right glass">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Ümumi Anbar Dəyəri</span>
            <span className="text-3xl font-black text-primary font-mono block mt-1.5">
              {totalStockValue.toFixed(2)} ₼
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">bütün mövcud malların alış maya dəyəri</span>
          </div>
        </div>
      )}
    </div>
  );
}
