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
  barcode?: string | null;
  activeSerials?: string[];
  trackingType?: string;
  description?: string | null;
}
export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSerialProduct, setSelectedSerialProduct] = useState<StockLevel | null>(null);

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

  const normalizeSearchText = (text: any): string => {
    if (text === null || text === undefined) return "";
    const str = String(text);
    return str
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
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => {
      const serialsStr = item.activeSerials ? item.activeSerials.join(" ") : "";
      return (
        normalizeSearchText(item.productName).includes(word) ||
        (item.category && normalizeSearchText(item.category).includes(word)) ||
        (item.barcode && normalizeSearchText(item.barcode).includes(word)) ||
        (item.description && normalizeSearchText(item.description).includes(word)) ||
        normalizeSearchText(serialsStr).includes(word)
      );
    });
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
  const filteredStockValue = filteredList.reduce((sum, item) => sum + (item.totalValue || 0), 0);

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
                filteredList.map((item) => {
                  const isSN = item.trackingType === "serialized";
                  return (
                    <tr 
                      key={item.productId} 
                      className={`border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs ${isSN ? "bg-blue-50/10" : ""}`}
                    >
                      <td className={`p-4 font-bold text-gray-900 ${isSN ? "pl-4 border-l-4 border-blue-500" : "pl-6"}`}>
                        <div className="flex flex-col gap-1 py-1">
                          {isSN ? (
                            <button
                              onClick={() => setSelectedSerialProduct(item)}
                              className="text-left font-black text-blue-900 hover:text-primary transition-all flex flex-col gap-0.5 cursor-pointer group"
                            >
                              <span className="group-hover:underline">{item.productName}</span>
                            </button>
                          ) : (
                            <span className="text-gray-900 font-bold">{item.productName}</span>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {item.barcode && (
                              <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                                🖨️ {item.barcode}
                              </span>
                            )}
                            {isSN && (
                              <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                🏷️ Seriallı (IMEI)
                              </span>
                            )}
                          </div>
                          
                          {isSN && item.activeSerials && item.activeSerials.length > 0 && (
                            <button
                              onClick={() => setSelectedSerialProduct(item)}
                              className="text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200/50 hover:bg-amber-100/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 mt-1.5 w-max"
                            >
                              🔍 {item.activeSerials.length} IMEI / Serial Göstər
                            </button>
                          )}
                        </div>
                      </td>
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
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock summaries */}
      {!isLoading && list && list.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-2">
          {searchQuery.trim() !== "" && (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl px-6 py-4 text-right glass animate-in slide-in-from-right-1.5 duration-200">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Axtarış üzrə Dəyər</span>
              <span className="text-3xl font-black text-amber-600 font-mono block mt-1.5">
                {filteredStockValue.toFixed(2)} ₼
              </span>
              <span className="text-[10px] text-gray-400 block mt-1">filtrlənmiş {filteredList.length} məhsulun maya dəyəri</span>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/10 rounded-2xl px-6 py-4 text-right glass">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Ümumi Anbar Dəyəri</span>
          <span className="text-3xl font-black text-primary font-mono block mt-1.5">
            {totalStockValue.toFixed(2)} ₼
          </span>
          <span className="text-[10px] text-gray-400 block mt-1">bütün mövcud malların alış maya dəyəri</span>
        </div>
      </div>
    )}

    {/* Serial Numbers Modal */}
    {selectedSerialProduct && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in-0 duration-200">
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden glass-card space-y-4 animate-in zoom-in-95 duration-200">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          
          <div className="flex justify-between items-center pb-2 border-b border-gray-50">
            <div>
              <h3 className="text-xs font-black text-gray-900">{selectedSerialProduct.productName}</h3>
              <p className="text-[9px] text-gray-400 mt-0.5">Stokdakı Aktiv Serial Nömrələr (IMEI)</p>
            </div>
            <button 
              onClick={() => setSelectedSerialProduct(null)}
              className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-lg transition-all cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-500">Toplam Stok sayı:</span>
              <span className="font-black text-blue-600 text-xs font-mono">{selectedSerialProduct.activeSerials?.length || 0} ədəd</span>
            </div>

            {selectedSerialProduct.activeSerials && selectedSerialProduct.activeSerials.length > 0 ? (
              <div className="border border-gray-100 rounded-xl max-h-60 overflow-y-auto p-2 bg-gray-50/50 space-y-1">
                {selectedSerialProduct.activeSerials.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-150 rounded-lg hover:bg-gray-50/50 transition-all text-[11px] font-mono font-bold text-gray-800">
                    <span>{idx + 1}. {s}</span>
                    <span className="bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.2 rounded-md text-[9px] font-sans font-bold">Stokda</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400 italic font-semibold">
                Stokda heç bir aktiv serial nömrəsi yoxdur.
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedSerialProduct(null)}
            className="w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-all cursor-pointer text-center"
          >
            Bağla
          </button>
        </div>
      </div>
    )}
  </div>
  );
}
