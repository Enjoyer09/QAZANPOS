import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";import {
  PlusCircle, Lock, ArrowLeftRight, Warehouse, ClipboardCheck, ShoppingCart, AlertTriangle, Printer, CheckCircle2, X, Edit2
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { TableSkeleton } from "../components/Skeleton.tsx";

interface StockLevel {
  productId: number;
  productName: string;
  category: string | null;
  unit: string;
  currentQuantity: number;
  lastPurchasePrice: number;
  lastSalePrice: number;
  totalValue: number;
  lastPurchaseDate?: string | null;
  barcode?: string | null;
  activeSerials?: string[];
  trackingType?: string;
  description?: string | null;
}
export default function Stock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [showUnstocked, setShowUnstocked] = useState(false);
  const [selectedSerialProduct, setSelectedSerialProduct] = useState<StockLevel | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Multi-warehouse and transfer states
  const [activeStockTab, setActiveStockTab] = useState("list"); // "list" | "transfers" | "stocktake" | "po"
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [initialWarehouseSet, setInitialWarehouseSet] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferProductId, setTransferProductId] = useState<number>(0);
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState<number>(0);
  const [transferToWarehouseId, setTransferToWarehouseId] = useState<number>(0);
  const [transferQuantity, setTransferQuantity] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState<string>("");
  const [, setTransferSerials] = useState<string>("");
  const [selectedTransferSerials, setSelectedTransferSerials] = useState<string[]>([]);

  // Stocktake state
  const [stocktakeCounts, setStocktakeCounts] = useState<Record<number, string>>({}); // productId -> counted qty
  const [stocktakeNotes, setStocktakeNotes] = useState<Record<number, string>>({}); // productId -> notes
  const [stocktakeSubmitted, setStocktakeSubmitted] = useState(false);

  // Cost editing state
  const [selectedCostProduct, setSelectedCostProduct] = useState<StockLevel | null>(null);
  const [newCostValue, setNewCostValue] = useState<string>("");
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

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

  // Fetch stock levels filtered by selectedWarehouseId
  const { data: list, isLoading } = useQuery<StockLevel[]>({
    queryKey: ["/api/stock/levels", selectedWarehouseId],
    queryFn: async () => {
      const url = selectedWarehouseId 
        ? `/api/stock/levels?warehouseId=${selectedWarehouseId}` 
        : "/api/stock/levels";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Default to unified/global stock ("") for everyone
  React.useEffect(() => {
    if (!initialWarehouseSet) {
      setSelectedWarehouseId("");
      setInitialWarehouseSet(true);
    }
  }, [initialWarehouseSet]);

  // Fetch warehouses
  const { data: warehousesList = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  // Fetch stock transfers list
  const { data: transfersList = [] } = useQuery<any[]>({
    queryKey: ["/api/stock/transfers"],
    queryFn: async () => {
      const res = await fetch("/api/stock/transfers");
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  // Stock transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: async (transferData: any) => {
      const res = await fetch("/api/stock/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Yerdəyişmə zamanı xəta baş verdi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/transfers"] });
      setShowTransferModal(false);
      setTransferProductId(0);
      setTransferFromWarehouseId(0);
      setTransferToWarehouseId(0);
      setTransferQuantity(0);
      setTransferNotes("");
      setTransferSerials("");
      toast({
        title: "Yerdəyişmə tamamlandı",
        description: "Məhsullar uğurla digər anbara transfer edildi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Yerdəyişmə edilə bilmədi.",
        variant: "destructive",
      });
    },
  });

  // Stocktake adjustment mutation
  const stockAdjustMutation = useMutation({
    mutationFn: async (adjustments: any[]) => {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustments),
      });
      if (!res.ok) throw new Error("Sayim qeyd edilə bilmədi");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      setStocktakeCounts({});
      setStocktakeNotes({});
      setStocktakeSubmitted(true);
      toast({ title: "Sayim tamamlandı! ✅", description: "Anbar qalıqları yeniləndi.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Sayim qeyd edilə bilmədi.", variant: "destructive" });
    }
  });

  // Cost price update mutation
  const updateCostMutation = useMutation({
    mutationFn: async (data: { productId: number; newCost: number }) => {
      const res = await fetch("/api/stock/update-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Maya dəyəri yenilənərkən xəta baş verdi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      setIsCostModalOpen(false);
      setSelectedCostProduct(null);
      setNewCostValue("");
      toast({
        title: "Uğurlu əməliyyat",
        description: "Məhsulun maya dəyəri və anbarın ümumi maliyyə hesabatları yeniləndi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  // Procurement drafts query
  const { data: procurementDrafts = [], isLoading: isPOLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/procurement-drafts"],
    queryFn: async () => {
      const res = await fetch("/api/stock/procurement-drafts");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: activeStockTab === "po",
  });

  const transferProduct = list?.find(p => p.productId === transferProductId);

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

  const isUnstocked = (item: StockLevel) =>
    item.currentQuantity === 0 && item.lastPurchasePrice === 0 && !item.lastPurchaseDate;

  const filteredList = (list || []).filter((item) => {
    // Əgər "Stoksuz" filteri aktivdirsə, yalnız heç vaxt anbara daxil edilməmiş məhsulları göstər
    if (showUnstocked && !isUnstocked(item)) return false;

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

  const unstockedCount = (list || []).filter(isUnstocked).length;

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const userW = currentUser?.warehouseId || warehousesList.find((w: any) => w.isDefault === 1)?.id || 1;
              setTransferFromWarehouseId(userW);
              const otherW = warehousesList.find((w: any) => w.id !== userW)?.id || "";
              setTransferToWarehouseId(Number(otherW));
              setShowTransferModal(true);
            }}
            className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 font-semibold text-sm rounded-xl hover:bg-gray-50 cursor-pointer flex items-center gap-2 shadow-xs transition-all hover-elevate"
          >
            <ArrowLeftRight className="w-4 h-4 text-primary" /> Yerdəyişmə Et
          </button>
          <Link href="/anbar/daxil">
            <button className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate">
              <PlusCircle className="w-4 h-4" /> Anbara Mədaxil
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs & Warehouse Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-150 pb-px gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveStockTab("list")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeStockTab === "list"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Warehouse className="w-4 h-4" />
            Mövcud Qalıqlar
          </button>
          <button
            type="button"
            onClick={() => setActiveStockTab("transfers")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeStockTab === "transfers"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Yerdəyişmə Tarixçəsi
          </button>
          <button
            type="button"
            onClick={() => { setActiveStockTab("stocktake"); setStocktakeSubmitted(false); }}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeStockTab === "stocktake"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Sayım Et
          </button>
          <button
            type="button"
            onClick={() => setActiveStockTab("po")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeStockTab === "po"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Satınalma Sifarişi
          </button>
        </div>

        {activeStockTab === "list" && (
          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Aktiv Anbar:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold"
            >
              <option value="">Hamısı (Bütün Anbarlar)</option>
              {warehousesList.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
        {activeStockTab === "stocktake" && (
          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Sayım Anbarı:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => { setSelectedWarehouseId(e.target.value); setStocktakeCounts({}); setStocktakeSubmitted(false); }}
              className="px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold"
            >
              <option value="">Anbar Seçin...</option>
              {warehousesList.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeStockTab === "list" ? (
        <>
          {/* Search + Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold flex-1 max-w-md">
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

            {/* Stoksuz Məhsullar Filter */}
            <button
              onClick={() => { setShowUnstocked(!showUnstocked); setSearchQuery(""); }}
              className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                showUnstocked
                  ? "bg-amber-50 border-amber-200 text-amber-700 shadow-xs"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
              title="Yalnız heç vaxt anbara daxil edilməmiş məhsulları göstər"
            >
              <AlertTriangle className={`w-4 h-4 ${showUnstocked ? "text-amber-600" : "text-gray-400"}`} />
              Stoksuz Məhsullar
              {unstockedCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  showUnstocked ? "bg-amber-200 text-amber-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {unstockedCount}
                </span>
              )}
            </button>
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
                    <th className="p-4 text-right">Son Satış Qiyməti</th>
                    <th className="p-4 text-right">Mənfəət Marjası</th>
                    <th className="p-4 pl-8">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <TableSkeleton rows={5} />
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-16 text-center text-xs text-gray-400">
                        {searchQuery ? "Axtarışa uyğun məhsul tapılmadı." : "Anbar boşdur. Anbara məhsul mədaxil edin."}
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => {
                      const isSN = item.trackingType === "serialized";
                      return (
                        <tr 
                          key={item.productId} 
                          className={`border-b border-gray-55 hover:bg-gray-50/30 transition-all text-xs ${isSN ? "bg-blue-50/10" : ""}`}
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
                          <td className="p-4 text-right font-bold text-gray-955 font-mono">
                            {item.totalValue > 0 ? `${item.totalValue.toFixed(2)} ₼` : "0.00 ₼"}
                          </td>
                          <td className="p-4 text-right font-semibold text-gray-600 font-mono">
                            {item.lastSalePrice > 0 ? `${item.lastSalePrice.toFixed(2)} ₼` : "—"}
                          </td>
                          <td className="p-4 text-right">
                            {(() => {
                              const cost = item.lastPurchasePrice;
                              const price = item.lastSalePrice;
                              if (cost > 0 && price > 0) {
                                const profit = price - cost;
                                const margin = (profit / cost) * 100;
                                const isPositive = profit >= 0;
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    isPositive 
                                      ? "bg-green-50 text-green-700 border border-green-100" 
                                      : "bg-red-50 text-red-600 border border-red-100"
                                  }`}>
                                    {isPositive ? "+" : ""}{margin.toFixed(1)}%
                                    <span className={`text-[9px] ${isPositive ? "text-green-500" : "text-red-400"}`}>
                                      ({isPositive ? "+" : ""}{profit.toFixed(2)} ₼)
                                    </span>
                                  </span>
                                );
                              }
                              return <span className="text-gray-300">—</span>;
                            })()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 flex-wrap justify-end sm:justify-start">
                              {item.currentQuantity > 0 ? (
                                <button
                                  onClick={() => {
                                    setTransferProductId(item.productId);
                                    const defaultFrom = selectedWarehouseId ? Number(selectedWarehouseId) : (currentUser?.warehouseId || warehousesList.find((w: any) => w.isDefault === 1)?.id || 1);
                                    setTransferFromWarehouseId(defaultFrom);
                                    const defaultTo = warehousesList.find((w: any) => w.id !== defaultFrom)?.id || "";
                                    setTransferToWarehouseId(Number(defaultTo));
                                    setTransferQuantity(1);
                                    setSelectedTransferSerials([]);
                                    setShowTransferModal(true);
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-primary/5 border border-gray-200 hover:border-primary/30 text-gray-550 hover:text-primary rounded-lg transition-all cursor-pointer font-bold text-[10px] flex items-center gap-1"
                                >
                                  <ArrowLeftRight className="w-3 h-3 text-primary" /> Yerdəyişmə
                                </button>
                              ) : (
                                getStatusBadge(item.currentQuantity)
                              )}

                              {user?.role === "Admin" && (
                                <button
                                  onClick={() => {
                                    setSelectedCostProduct(item);
                                    setNewCostValue(item.lastPurchasePrice > 0 ? String(item.lastPurchasePrice) : "0");
                                    setIsCostModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-amber-500/5 border border-gray-200 hover:border-amber-500/30 text-gray-550 hover:text-amber-600 rounded-lg transition-all cursor-pointer font-bold text-[10px] flex items-center gap-1"
                                  title="Məhsulun maya dəyərini (alış qiymətini) dəyişdir"
                                >
                                  <Edit2 className="w-2.5 h-2.5 text-amber-500" /> Maya
                                </button>
                              )}
                            </div>
                          </td>
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
        </>
      ) : (
        /* Transfers History Tab */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">Tarix</th>
                  <th className="p-4">Məhsul</th>
                  <th className="p-4 text-right">Miqdar</th>
                  <th className="p-4">Göndərən Anbar</th>
                  <th className="p-4">Qəbul edən Anbar</th>
                  <th className="p-4">Məsul Şəxs</th>
                  <th className="p-4">Qeyd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {transfersList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-16 text-center text-xs text-gray-400 italic">
                      Hələ ki heç bir yerdəyişmə qeydə alınmayıb.
                    </td>
                  </tr>
                ) : (
                  transfersList.map((t: any) => {
                    const serials = t.serialNumbers ? JSON.parse(t.serialNumbers) : [];
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="p-4 pl-6 text-gray-400 font-mono">
                          {new Date(t.transferDate).toLocaleString("az-AZ")}
                        </td>
                        <td className="p-4 font-bold text-gray-955">
                          <div>
                            {t.productName}
                            {serials.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px] text-gray-500 font-bold">
                                {serials.map((s: string) => (
                                  <span key={s} className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right font-black text-gray-900 font-mono">
                          {t.quantity} ədəd
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            {t.fromWarehouseName}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">
                            {t.toWarehouseName}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-600">
                          @{t.transferredBy}
                        </td>
                        <td className="p-4 text-gray-550 max-w-xs truncate" title={t.notes}>
                          {t.notes || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== STOCKTAKE TAB ========== */}
      {activeStockTab === "stocktake" && (
        <div className="space-y-5 animate-in fade-in-0">
          {stocktakeSubmitted ? (
            <div className="bg-white border border-green-100 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center glass-card shadow-xs">
              <div className="size-16 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-black text-gray-900 text-lg">Sayım Uğurla Tamamlandı!</h3>
              <p className="text-xs text-gray-400 font-semibold max-w-sm">Anbar qalıqları sayım nəticəsinə əsasən yeniləndi. Tənzimləmələr sistemdə qeyd edildi.</p>
              <button
                onClick={() => { setStocktakeSubmitted(false); setStocktakeCounts({}); setStocktakeNotes({}); }}
                className="px-6 py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                Yeni Sayım Başlat
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-100 p-5 rounded-2xl glass-card shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm">Fiziki Anbar Sayımı</h3>
                    <p className="text-[10px] text-gray-400 font-semibold">Saydığınız məbləği daxil edin. Fərqlər avtomatik tənzimlənəcək.</p>
                  </div>
                </div>

                {!selectedWarehouseId ? (
                  <div className="text-center py-8 text-xs text-gray-400 italic font-semibold border border-dashed border-gray-200 rounded-xl">
                    Zəhmət olmasa yuxarıdan anbar seçin.
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 italic font-semibold border border-dashed border-gray-200 rounded-xl">
                    Seçilmiş anbarda məhsul tapilmadı.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse min-w-[650px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="p-3 text-left">Məhsul</th>
                          <th className="p-3 text-center">Sistemdəki Qalıq</th>
                          <th className="p-3 text-center">Saydığınız</th>
                          <th className="p-3 text-center">Fərq</th>
                          <th className="p-3 text-center">Qeyd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredList.map((item) => {
                          const counted = parseFloat(stocktakeCounts[item.productId] ?? "");
                          const diff = isNaN(counted) ? null : counted - item.currentQuantity;
                          return (
                            <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all">
                              <td className="p-3 font-bold text-gray-900">
                                {item.productName}
                                {item.barcode && <div className="text-[9px] text-gray-400 font-mono">{item.barcode}</div>}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-gray-600">{item.currentQuantity.toFixed(2)} {item.unit}</td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder={item.currentQuantity.toFixed(2)}
                                  value={stocktakeCounts[item.productId] ?? ""}
                                  onChange={(e) => setStocktakeCounts(prev => ({ ...prev, [item.productId]: e.target.value }))}
                                  className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center font-mono font-bold bg-white"
                                />
                              </td>
                              <td className="p-3 text-center">
                                {diff === null ? (
                                  <span className="text-gray-300">—</span>
                                ) : diff === 0 ? (
                                  <span className="text-green-600 font-black">✓ Uyğun</span>
                                ) : diff > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-black">+{diff.toFixed(2)} Artıq</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-100 text-red-600 font-black">{diff.toFixed(2)} Əskik</span>
                                )}
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  placeholder="Səbəb..."
                                  value={stocktakeNotes[item.productId] ?? ""}
                                  onChange={(e) => setStocktakeNotes(prev => ({ ...prev, [item.productId]: e.target.value }))}
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-[10px]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedWarehouseId && filteredList.length > 0 && (
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 glass-card shadow-xs">
                  <div className="text-xs text-gray-500 font-semibold">
                    <span className="font-black text-gray-900">{Object.keys(stocktakeCounts).length}</span> məhsul sayıldı ·
                    {' '}<span className="text-red-500 font-black">
                      {Object.entries(stocktakeCounts).filter(([pid]) => {
                        const item = filteredList.find(i => i.productId === Number(pid));
                        const cnt = parseFloat(stocktakeCounts[Number(pid)] ?? "");
                        return item && !isNaN(cnt) && cnt < item.currentQuantity;
                      }).length} əskik
                    </span>{' '}·{' '}
                    <span className="text-blue-500 font-black">
                      {Object.entries(stocktakeCounts).filter(([pid]) => {
                        const item = filteredList.find(i => i.productId === Number(pid));
                        const cnt = parseFloat(stocktakeCounts[Number(pid)] ?? "");
                        return item && !isNaN(cnt) && cnt > item.currentQuantity;
                      }).length} artıq
                    </span>
                  </div>
                  <button
                    disabled={stockAdjustMutation.isPending || Object.keys(stocktakeCounts).length === 0}
                    onClick={() => {
                      const adjustments: any[] = [];
                      for (const [pid, cntStr] of Object.entries(stocktakeCounts)) {
                        const item = filteredList.find(i => i.productId === Number(pid));
                        if (!item) continue;
                        const counted = parseFloat(cntStr);
                        if (isNaN(counted)) continue;
                        const diff = counted - item.currentQuantity;
                        if (diff === 0) continue;
                        adjustments.push({
                          productId: Number(pid),
                          warehouseId: Number(selectedWarehouseId),
                          type: diff > 0 ? "found" : "shrinkage",
                          quantity: Math.abs(diff),
                          notes: stocktakeNotes[Number(pid)] || null,
                        });
                      }
                      if (adjustments.length === 0) {
                        toast({ title: "Fərq yoxdur", description: "Heç bir məhsulda fərq qeyd edilmədi.", variant: "destructive" });
                        return;
                      }
                      stockAdjustMutation.mutate(adjustments);
                    }}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer shadow-sm transition-all disabled:opacity-50"
                  >
                    {stockAdjustMutation.isPending ? "Qeyd edilir..." : "Sayımı Tamamla ✓"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== AUTO PO TAB ========== */}
      {activeStockTab === "po" && (
        <div className="space-y-5 animate-in fade-in-0">
          <div className="bg-white border border-gray-100 p-5 rounded-2xl glass-card shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-orange-50 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm">Avtomatik Satınalma Sifarişi</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">Minimum limitdən aşağı düşən məhsullar tədariükçüərə görə qruplaşdırıldı.</p>
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer transition-all print:hidden"
              >
                <Printer className="w-3.5 h-3.5" /> Çap Et (A4)
              </button>
            </div>

            {isPOLoading ? (
              <div className="text-center py-10 text-xs text-gray-400">Siyahı hazırlanır...</div>
            ) : procurementDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="size-12 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-black text-gray-900">Bütün məhsullar Normaldır!</p>
                <p className="text-xs text-gray-400 font-semibold">Heç bir məhsula minimum limitdən az qalıq qeyd edilməyib.</p>
              </div>
            ) : (
              <div className="space-y-6 print:space-y-4">
                {procurementDrafts.map((group: any, gi: number) => (
                  <div key={gi} className="border border-orange-100 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3 flex items-center justify-between border-b border-orange-100">
                      <div>
                        <p className="font-black text-orange-800 text-xs">🚨 Tədariükçü: {group.vendorName}</p>
                        <p className="text-[10px] text-orange-600 font-semibold">{group.items.length} məhsul — təcili sifariş lazımdır</p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                          <th className="p-3 text-left">Məhsul</th>
                          <th className="p-3 text-center">Cari Qalıq</th>
                          <th className="p-3 text-center">Min. Limit</th>
                          <th className="p-3 text-center font-black text-orange-600">Təklif Edilən Sifariş</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item: any, ii: number) => (
                          <tr key={ii} className="border-b border-gray-50 hover:bg-orange-50/20 transition-all">
                            <td className="p-3 font-bold text-gray-900">
                              {item.productName}
                              {item.barcode && <div className="text-[9px] text-gray-400 font-mono">{item.barcode}</div>}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-black font-mono ${item.currentStock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                                {item.currentStock.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-gray-500 font-semibold">{item.minStockLimit.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 font-black">
                                {item.suggestedOrderQty.toFixed(2)} ədəd
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden glass-card space-y-4 animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-indigo-500"></div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">Anbarlararası Yerdəyişmə</h3>
                <p className="text-[9px] text-gray-400 mt-0.5">Məhsulların anbarlar arasında transferi</p>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-lg transition-all cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-semibold">
              {/* Product selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Məhsul</label>
                {transferProductId ? (
                  <div className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl font-bold text-gray-800 flex justify-between items-center">
                    <span>{transferProduct?.productName || "Seçilmiş Məhsul"}</span>
                    {createTransferMutation.isPending ? null : (
                      <button
                        onClick={() => {
                          setTransferProductId(0);
                          setSelectedTransferSerials([]);
                        }}
                        className="text-[10px] text-primary hover:underline font-extrabold"
                      >
                        Dəyiş
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={transferProductId || ""}
                    onChange={(e) => {
                      setTransferProductId(Number(e.target.value));
                      setSelectedTransferSerials([]);
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold"
                  >
                    <option value="">Məhsul seçin...</option>
                    {(list || []).filter(item => item.currentQuantity > 0).map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.productName} (Mövcuddur: {item.currentQuantity})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Source warehouse */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Göndərən Anbar</label>
                  <select
                    value={transferFromWarehouseId || ""}
                    onChange={(e) => {
                      setTransferFromWarehouseId(Number(e.target.value));
                      setSelectedTransferSerials([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white font-bold"
                  >
                    {warehousesList.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Destination warehouse */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Qəbul edən Anbar</label>
                  <select
                    value={transferToWarehouseId || ""}
                    onChange={(e) => setTransferToWarehouseId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white font-bold"
                  >
                    <option value="" disabled>Seçin...</option>
                    {warehousesList.filter((w: any) => w.id !== transferFromWarehouseId).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Serial number checklist or standard quantity input */}
              {transferProduct?.trackingType === "serialized" ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase block">Transfer Ediləcək Seriallar / IMEI ({selectedTransferSerials.length} ədəd)</label>
                  <div className="border border-gray-150 rounded-xl p-3 bg-gray-50/50 max-h-40 overflow-y-auto space-y-1">
                    {transferProduct?.activeSerials && transferProduct.activeSerials.length > 0 ? (
                      transferProduct.activeSerials.map((s) => {
                        const isChecked = selectedTransferSerials.includes(s);
                        return (
                          <label key={s} className="flex items-center gap-2 p-2 bg-white border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition-all text-xs font-mono font-bold text-gray-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedTransferSerials(selectedTransferSerials.filter(item => item !== s));
                                } else {
                                  setSelectedTransferSerials([...selectedTransferSerials, s]);
                                }
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer"
                            />
                            {s}
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-gray-450 italic">Göndərən anbarda bu məhsula aid aktiv serial nömrəsi yoxdur.</span>
                    )}
                  </div>
                </div>
              ) : (
                /* Standard quantity input */
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Miqdar ({transferProduct ? `Maks. ${transferProduct.currentQuantity} ${transferProduct.unit}` : ""})</label>
                  <input
                    type="number"
                    min="1"
                    max={transferProduct?.currentQuantity || 1}
                    value={transferQuantity || ""}
                    onChange={(e) => setTransferQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white font-mono"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Qeyd / Açıqlama</label>
                <input
                  type="text"
                  placeholder="Yerdəyişmə səbəbi və s..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                />
              </div>

              {/* Submit / Cancel */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={createTransferMutation.isPending}
                  onClick={() => {
                    if (!transferProductId) {
                      toast({ title: "Xəta", description: "Məhsul seçilməlidir", variant: "destructive" });
                      return;
                    }
                    if (!transferFromWarehouseId || !transferToWarehouseId) {
                      toast({ title: "Xəta", description: "Hər iki anbar seçilməlidir", variant: "destructive" });
                      return;
                    }
                    const isSerialized = transferProduct?.trackingType === "serialized";
                    const qty = isSerialized ? selectedTransferSerials.length : transferQuantity;
                    if (qty <= 0) {
                      toast({ title: "Xəta", description: "Keçərli miqdar daxil edilməlidir", variant: "destructive" });
                      return;
                    }
                    if (!isSerialized && transferProduct && qty > transferProduct.currentQuantity) {
                      toast({ title: "Xəta", description: "Göndərilən miqdar anbardakı qalıqdan çox ola bilməz", variant: "destructive" });
                      return;
                    }

                    createTransferMutation.mutate({
                      productId: transferProductId,
                      fromWarehouseId: transferFromWarehouseId,
                      toWarehouseId: transferToWarehouseId,
                      quantity: qty,
                      notes: transferNotes.trim() || undefined,
                      serialNumbers: isSerialized ? selectedTransferSerials : undefined
                    });
                  }}
                  className="flex-1 py-2.5 bg-primary text-white text-xs font-extrabold rounded-xl hover:bg-primary/90 cursor-pointer shadow-sm shadow-primary/10 transition-all text-center disabled:opacity-50"
                >
                  {createTransferMutation.isPending ? "Göndərilir..." : "Yerdəyişməni Tamamla"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 bg-white text-gray-500 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                >
                  Ləğv Et
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Serial Numbers Modal */}
      {selectedSerialProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden glass-card space-y-4 animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-55">
              <div>
                <h3 className="text-xs font-black text-gray-900">{selectedSerialProduct.productName}</h3>
                <p className="text-[9px] text-gray-400 mt-0.5">Stokdakı Aktiv Serial Nömrələr (IMEI)</p>
              </div>
              <button 
                onClick={() => { setSelectedSerialProduct(null); setCopiedIndex(null); }}
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
                <div 
                  className="border border-gray-100 rounded-xl max-h-72 overflow-y-auto p-2 bg-gray-50/50 space-y-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {selectedSerialProduct.activeSerials.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-150 rounded-lg hover:bg-gray-50/50 transition-all text-[11px] font-mono font-bold text-gray-800">
                      <span className="select-text">{idx + 1}. {s}</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded-md text-[9px] font-sans font-bold">Stokda</span>
                        <button
                          onClick={() => handleCopy(s, idx)}
                          className="px-2 py-1 bg-gray-50 hover:bg-primary/10 border border-gray-200 hover:border-primary/20 text-gray-500 hover:text-primary rounded-md text-[9px] font-sans font-bold transition-all cursor-pointer"
                          title="Kopyala"
                        >
                          {copiedIndex === idx ? "Kopyalandı ✓" : "📋 Kopyala"}
                        </button>
                      </div>
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
              onClick={() => { setSelectedSerialProduct(null); setCopiedIndex(null); }}
              className="w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-all cursor-pointer text-center"
            >
              Bağla
            </button>
          </div>
        </div>
      )}

      {/* Cost Adjustment Modal */}
      {isCostModalOpen && selectedCostProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden glass-card space-y-4 animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500"></div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
              <div>
                <h3 className="text-sm font-black text-gray-900">Maya Dəyəri Düzəlişi</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase">{selectedCostProduct.productName}</p>
              </div>
              <button
                onClick={() => {
                  setIsCostModalOpen(false);
                  setSelectedCostProduct(null);
                  setNewCostValue("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50/20 border border-amber-500/10 p-3.5 rounded-xl text-xs space-y-1.5">
                <span className="text-amber-800 font-bold block uppercase text-[10px] tracking-wider">Cari Hesablanmış Maya Dəyəri:</span>
                <span className="text-2xl font-black text-amber-600 font-mono block">
                  {selectedCostProduct.lastPurchasePrice > 0 ? `${selectedCostProduct.lastPurchasePrice.toFixed(2)} ₼` : "0.00 ₼"}
                </span>
                <span className="text-[10px] text-gray-400 font-medium leading-relaxed block mt-1">
                  Yeni daxil edəcəyiniz maya dəyəri məhsulun qalıq sayındakı FIFO hərəkətlərinə tətbiq olunacaq və mövcud anbar dəyərinizi yeniləyəcəkdir.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Yeni Maya Dəyəri (₼) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Məs. 15.50"
                  value={newCostValue}
                  onChange={(e) => setNewCostValue(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50/50 font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCostModalOpen(false);
                  setSelectedCostProduct(null);
                  setNewCostValue("");
                }}
                className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newCostValue.trim() || isNaN(parseFloat(newCostValue))) {
                    toast({ title: "Xəta!", description: "Düzgün bir qiymət daxil edin", variant: "destructive" });
                    return;
                  }
                  updateCostMutation.mutate({
                    productId: selectedCostProduct.productId,
                    newCost: parseFloat(newCostValue)
                  });
                }}
                disabled={updateCostMutation.isPending}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                {updateCostMutation.isPending ? "Yadda saxlanılır..." : "Yadda Saxla 💾"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
