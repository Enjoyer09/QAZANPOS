import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Boxes,
  Search,
  Calendar,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  RotateCw,
  ArrowLeftRight,
  ClipboardList,
  Filter,
  X,
  ExternalLink,
  Printer,
  ChevronRight,
  Warehouse,
  Package,
  Clock,
  User,
  AlertCircle
} from "lucide-react";
import { TableSkeleton } from "../components/Skeleton.tsx";

interface MovementEvent {
  id: string;
  timestamp: string;
  type: "stock_in" | "sale" | "return" | "vendor_return" | "transfer" | "stock_adjustment";
  typeLabel: string;
  documentNumber: string;
  documentType: string;
  documentId: number;
  documentUrl?: string;
  counterparty: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  warehouseId?: number | null;
  warehouseName?: string;
  operator?: string;
  notes?: string;
  balanceAfter: number;
}

interface ProductInfo {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  barcode: string | null;
  description: string | null;
  currentStock: number;
  lastPurchasePrice: number;
  currentStockValue: number;
}

interface MovementSummary {
  totalInQty: number;
  totalInAmount: number;
  totalOutQty: number;
  totalOutAmount: number;
  totalReturnsQty: number;
  totalReturnsAmount: number;
  currentStock: number;
  currentStockValue: number;
}

interface MovementsApiResponse {
  product: ProductInfo;
  summary: MovementSummary;
  movements: MovementEvent[];
}

export default function ProductMovements() {
  // Read initial productId from URL query parameter
  const getInitialProductId = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get("productId") || params.get("product_id");
      return val ? parseInt(val) : null;
    } catch {
      return null;
    }
  };

  const [selectedProductId, setSelectedProductId] = useState<number | null>(getInitialProductId);
  const [productSearchInput, setProductSearchInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Period filters
  const [periodPreset, setPeriodPreset] = useState<"1m" | "3m" | "5m" | "1y" | "all" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Movement type filter
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");

  // Warehouse filter
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  // Synchronize when browser URL changes (e.g. back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const pId = getInitialProductId();
      if (pId !== selectedProductId) {
        setSelectedProductId(pId);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedProductId]);

  // Handle outside click for search combobox
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all products / stock levels for autocomplete search
  const { data: stockLevels, isLoading: isLoadingStockLevels } = useQuery<any[]>({
    queryKey: ["/api/stock/levels"],
    queryFn: async () => {
      const res = await fetch("/api/stock/levels");
      if (!res.ok) throw new Error("Anbar qalıqları yüklənmədi");
      return res.json();
    },
  });

  // Fetch warehouses for filter
  const { data: warehouses } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Calculate start & end date based on preset
  const { computedStartDate, computedEndDate } = useMemo(() => {
    if (periodPreset === "custom") {
      return { computedStartDate: customStartDate, computedEndDate: customEndDate };
    }
    if (periodPreset === "all") {
      return { computedStartDate: "", computedEndDate: "" };
    }

    const end = new Date();
    const start = new Date();

    if (periodPreset === "1m") {
      start.setDate(end.getDate() - 30);
    } else if (periodPreset === "3m") {
      start.setDate(end.getDate() - 90);
    } else if (periodPreset === "5m") {
      start.setDate(end.getDate() - 150);
    } else if (periodPreset === "1y") {
      start.setDate(end.getDate() - 365);
    }

    return {
      computedStartDate: start.toISOString().split("T")[0],
      computedEndDate: end.toISOString().split("T")[0],
    };
  }, [periodPreset, customStartDate, customEndDate]);

  // Fetch movement history for selected product
  const {
    data: movementData,
    isLoading: isLoadingMovements,
    isFetching: isFetchingMovements,
  } = useQuery<MovementsApiResponse>({
    queryKey: [
      "/api/stock/movements",
      selectedProductId,
      computedStartDate,
      computedEndDate,
      movementTypeFilter,
      selectedWarehouseId,
    ],
    queryFn: async () => {
      if (!selectedProductId) throw new Error("Məhsul seçilməyib");
      const params = new URLSearchParams();
      params.set("productId", selectedProductId.toString());
      if (computedStartDate) params.set("startDate", computedStartDate);
      if (computedEndDate) params.set("endDate", computedEndDate);
      if (movementTypeFilter && movementTypeFilter !== "all") {
        params.set("type", movementTypeFilter);
      }
      if (selectedWarehouseId) params.set("warehouseId", selectedWarehouseId);

      const res = await fetch(`/api/stock/movements?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Hərəkət məlumatları yüklənmədi");
      }
      return res.json();
    },
    enabled: !!selectedProductId,
  });

  // Filtered products list for autocomplete
  const filteredProducts = useMemo(() => {
    if (!stockLevels) return [];
    const query = productSearchInput.trim().toLowerCase();
    if (!query) return stockLevels.slice(0, 15);

    return stockLevels
      .filter((p) => {
        const nameMatch = p.productName?.toLowerCase().includes(query);
        const barcodeMatch = p.barcode?.toLowerCase().includes(query);
        const idMatch = p.productId?.toString().includes(query);
        const catMatch = p.category?.toLowerCase().includes(query);
        return nameMatch || barcodeMatch || idMatch || catMatch;
      })
      .slice(0, 20);
  }, [stockLevels, productSearchInput]);

  // Select a product handler
  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.productId);
    setProductSearchInput(product.productName);
    setIsSearchOpen(false);

    // Update browser URL query param without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set("productId", product.productId.toString());
    window.history.pushState({}, "", url.toString());
  };

  const handleClearSelectedProduct = () => {
    setSelectedProductId(null);
    setProductSearchInput("");
    const url = new URL(window.location.href);
    url.searchParams.delete("productId");
    url.searchParams.delete("product_id");
    window.history.pushState({}, "", url.toString());
  };

  // Helper for rendering movement badge
  const renderMovementBadge = (event: MovementEvent) => {
    switch (event.type) {
      case "stock_in":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Mədaxil (Alış)</span>
          </span>
        );
      case "sale":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Satış (POS)</span>
          </span>
        );
      case "return":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Müştəri Qaytarması</span>
          </span>
        );
      case "vendor_return":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-orange-50 text-orange-700 border border-orange-200 shadow-2xs">
            <RotateCw className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>Tədarükçüyə Qaytarış</span>
          </span>
        );
      case "transfer":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
            <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Yerdəyişmə</span>
          </span>
        );
      case "stock_adjustment":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
            <ClipboardList className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Sayım / Düzəliş</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
            {event.typeLabel}
          </span>
        );
    }
  };

  const currentProduct = movementData?.product || stockLevels?.find((p) => p.productId === selectedProductId);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 pb-16 px-3 sm:px-6">
      {/* 1. Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
            <Link href="/anbar" className="hover:text-primary transition-colors flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5" /> Anbar
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-700">Məhsul üzrə Hərəkət</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <History className="w-6 h-6" />
            </span>
            Məhsul üzrə Hərəkət Tarixçəsi
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Seçilmiş məhsulun dövr üzrə bütün mədaxil, satış, geri qaytarış, sayım və anbar yerdəyişmələrinin audit jurnalı
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {selectedProductId && (
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all hover-elevate no-print"
            >
              <Printer className="w-4 h-4 text-gray-500" />
              Çap Et / İxrac
            </button>
          )}
          <Link href="/anbar">
            <button className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-md shadow-primary/15 cursor-pointer transition-all hover-elevate no-print">
              <Boxes className="w-4 h-4" /> Anbar Qalıqları
            </button>
          </Link>
        </div>
      </div>

      {/* 2. Control / Filter Panel */}
      <div className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-6 shadow-xs glass-card space-y-5 no-print">
        {/* Row 1: Product Autocomplete Combobox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-8 relative" ref={searchContainerRef}>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              Məhsul Seçimi (Ad, Barkod və ya ID ilə axtarış)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Məhsul adı və ya barkodunu yazın (məs: BOSCH, Boru, 200000...)"
                value={productSearchInput}
                onChange={(e) => {
                  setProductSearchInput(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full pl-11 pr-24 py-3 bg-gray-50/70 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {selectedProductId && (
                <button
                  type="button"
                  onClick={handleClearSelectedProduct}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition-colors"
                  title="Seçimi təmizlə"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown search results */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-150 shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-gray-100">
                {isLoadingStockLevels ? (
                  <div className="p-4 text-center text-xs text-gray-400">Məhsullar yüklənir...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    "{productSearchInput}" sorğusuna uyğun məhsul tapılmadı.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = p.productId === selectedProductId;
                    return (
                      <button
                        key={p.productId}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected ? "bg-primary/5 border-l-4 border-primary" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-gray-900 truncate">{p.productName}</span>
                            {p.category && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold shrink-0">
                                {p.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 font-medium">
                            {p.barcode && <span>Barkod: <code className="font-mono text-gray-600">{p.barcode}</code></span>}
                            <span>ID: #{p.productId}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-extrabold font-mono ${p.currentQuantity > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                            {p.currentQuantity} {p.unit}
                          </span>
                          <span className="block text-[10px] text-gray-400">faktiki qalıq</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Warehouse Selector (if multi-warehouse or available) */}
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-primary" />
              Filial / Anbar
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50/70 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              <option value="">Hamısı (Bütün Filial və Anbarlar)</option>
              {warehouses &&
                warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isDefault ? "(Əsas)" : ""}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Row 2: Period quick filters + custom date picker */}
        <div className="pt-2 border-t border-gray-100 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              Dövr:
            </span>
            {[
              { id: "1m", label: "Son 1 ay" },
              { id: "3m", label: "Son 3 ay" },
              { id: "5m", label: "Son 5 ay" },
              { id: "1y", label: "Son 1 il" },
              { id: "all", label: "Bütün dövr" },
              { id: "custom", label: "Xüsusi aralıq" },
            ].map((p) => {
              const active = periodPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodPreset(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? "bg-gray-900 text-white shadow-xs"
                      : "bg-gray-100/80 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          {periodPreset === "custom" && (
            <div className="flex items-center gap-2 flex-wrap bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Başlanğıc:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <span className="text-gray-300 font-bold">—</span>
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Son:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Movement Type Filter Tabs */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            Əməliyyat Növü:
          </span>
          {[
            { id: "all", label: "Hamısı" },
            { id: "stock_in", label: "🟢 Mədaxil (Alış)" },
            { id: "sale", label: "🔴 Satış (POS)" },
            { id: "return", label: "🟠 Qaytarış" },
            { id: "stock_adjustment", label: "🔵 Sayım / Korreksiya" },
            { id: "transfer", label: "🟣 Yerdəyişmə" },
          ].map((tab) => {
            const active = movementTypeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMovementTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "bg-gray-100/70 text-gray-600 hover:bg-gray-200/60 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Empty State: No Product Selected */}
      {!selectedProductId && (
        <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center shadow-xs glass-card max-w-2xl mx-auto space-y-4">
          <div className="size-16 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-inner">
            <Search className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-gray-950">Məhsul Seçin</h2>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
            Hərəkət tarixçəsinə, alış-satış qrafikinə və qalıq dəyişmələrinə baxmaq üçün yuxarıdakı axtarış sahəsindən bir məhsul seçin və ya aşağıdakı siyahıdan klikləyin.
          </p>

          {/* Quick suggestions from stockLevels */}
          {stockLevels && stockLevels.length > 0 && (
            <div className="pt-4 border-t border-gray-100 text-left">
              <span className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
                Populyar Məhsullar:
              </span>
              <div className="flex flex-wrap gap-2">
                {stockLevels.slice(0, 8).map((p) => (
                  <button
                    key={p.productId}
                    onClick={() => handleSelectProduct(p)}
                    className="px-3 py-2 bg-gray-50 hover:bg-primary/5 hover:border-primary/30 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-gray-400" />
                    <span>{p.productName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">({p.currentQuantity} {p.unit})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Active Selected Product Dashboard */}
      {selectedProductId && (
        <>
          {/* Product Header Bar */}
          {currentProduct && (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/15">
                    {currentProduct.category || "Kateqoriyasız"}
                  </span>
                  {currentProduct.barcode && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px] font-bold border border-white/15">
                      Barkod: {currentProduct.barcode}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold border border-white/15">
                    ID: #{currentProduct.id || selectedProductId}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{currentProduct.name}</h2>
                {currentProduct.description && (
                  <p className="text-xs text-gray-300 font-medium max-w-2xl">{currentProduct.description}</p>
                )}
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Faktiki Qalıq</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {movementData?.summary?.currentStock ?? currentProduct.currentStock}{" "}
                    <span className="text-xs font-sans text-gray-300 font-bold">{currentProduct.unit}</span>
                  </span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Maya Dəyəri</span>
                  <span className="text-2xl font-black font-mono text-white">
                    {Number(movementData?.summary?.currentStockValue ?? currentProduct.currentStockValue ?? 0).toFixed(2)}{" "}
                    <span className="text-xs font-sans text-gray-300 font-bold">₼</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4 Summary Mini Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Giriş / Mədaxil */}
            <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-xs glass-card relative overflow-hidden group hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  Dövr üzrə Giriş (Mədaxil)
                </span>
                <span className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <ArrowDownLeft className="w-5 h-5" />
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono tracking-tight">
                  +{movementData?.summary?.totalInQty ?? 0}{" "}
                  <span className="text-xs font-sans text-gray-400 font-bold">{currentProduct?.unit || "ədəd"}</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 font-mono">
                  Məbləğ: {Number(movementData?.summary?.totalInAmount ?? 0).toFixed(2)} ₼
                </div>
              </div>
            </div>

            {/* Card 2: Çıxış / Satış */}
            <div className="bg-white border border-rose-100 rounded-3xl p-5 shadow-xs glass-card relative overflow-hidden group hover:border-rose-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
                  Dövr üzrə Çıxış (Satış)
                </span>
                <span className="size-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <ArrowUpRight className="w-5 h-5" />
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono tracking-tight">
                  -{movementData?.summary?.totalOutQty ?? 0}{" "}
                  <span className="text-xs font-sans text-gray-400 font-bold">{currentProduct?.unit || "ədəd"}</span>
                </div>
                <div className="text-xs font-bold text-rose-600 font-mono">
                  Məbləğ: {Number(movementData?.summary?.totalOutAmount ?? 0).toFixed(2)} ₼
                </div>
              </div>
            </div>

            {/* Card 3: Qaytarmalar */}
            <div className="bg-white border border-amber-100 rounded-3xl p-5 shadow-xs glass-card relative overflow-hidden group hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                  Qaytarmalar (Müştəri / Tədarükçü)
                </span>
                <span className="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <RotateCw className="w-5 h-5" />
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono tracking-tight">
                  {movementData?.summary?.totalReturnsQty ?? 0}{" "}
                  <span className="text-xs font-sans text-gray-400 font-bold">{currentProduct?.unit || "ədəd"}</span>
                </div>
                <div className="text-xs font-bold text-amber-600 font-mono">
                  Məbləğ: {Number(movementData?.summary?.totalReturnsAmount ?? 0).toFixed(2)} ₼
                </div>
              </div>
            </div>

            {/* Card 4: Hazırkı Qalıq */}
            <div className="bg-white border border-primary/20 rounded-3xl p-5 shadow-xs glass-card relative overflow-hidden group hover:border-primary transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                  Hazırkı Faktiki Qalıq
                </span>
                <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Boxes className="w-5 h-5" />
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono tracking-tight">
                  {movementData?.summary?.currentStock ?? currentProduct?.currentStock ?? 0}{" "}
                  <span className="text-xs font-sans text-gray-400 font-bold">{currentProduct?.unit || "ədəd"}</span>
                </div>
                <div className="text-xs font-bold text-gray-500 font-mono">
                  Maya Dəyəri: {Number(movementData?.summary?.currentStockValue ?? 0).toFixed(2)} ₼
                </div>
              </div>
            </div>
          </div>

          {/* 5. Movement Audit Trail Table */}
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-xs glass-card">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Əməliyyat Xronologiyası (Audit Trail)</h3>
                <span className="text-xs text-gray-400 font-medium">
                  Son əməliyyatdan əvvələ doğru sıralanmış tam hərəkət qeydləri
                </span>
              </div>
              {isFetchingMovements && (
                <span className="text-xs font-bold text-primary flex items-center gap-1.5 animate-pulse">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Yenilənir...
                </span>
              )}
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 pl-6">Tarix və Saat</th>
                    <th className="py-3.5 px-4">Əməliyyat Növü</th>
                    <th className="py-3.5 px-4">Sənəd / Qaimə №</th>
                    <th className="py-3.5 px-4">Tərəf (Kontragent)</th>
                    <th className="py-3.5 px-4 text-right">Miqdar</th>
                    <th className="py-3.5 px-4 text-right">Qiymət</th>
                    <th className="py-3.5 px-4 text-right">Məbləğ</th>
                    <th className="py-3.5 px-4 text-right font-black text-gray-600">Qalıq (Balans)</th>
                    <th className="py-3.5 px-4 pr-6">Qeyd / İcraçı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingMovements ? (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <TableSkeleton rows={6} />
                      </td>
                    </tr>
                  ) : !movementData?.movements || movementData.movements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-xs text-gray-400">
                        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        Seçilmiş filterlərə uyğun heç bir hərəkət tapılmadı.
                      </td>
                    </tr>
                  ) : (
                    movementData.movements.map((ev) => {
                      const isPositive = ev.quantity > 0;
                      const isZero = ev.quantity === 0;

                      return (
                        <tr key={ev.id} className="hover:bg-gray-50/50 transition-colors group">
                          {/* 1. Tarix və Saat */}
                          <td className="py-3 px-4 pl-6 font-mono text-xs text-gray-600 font-medium whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleDateString("az-AZ")}{" "}
                            <span className="text-[11px] text-gray-400 font-sans">
                              {new Date(ev.timestamp).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>

                          {/* 2. Əməliyyat Növü */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderMovementBadge(ev)}
                          </td>

                          {/* 3. Sənəd № (Clickable) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {ev.documentUrl ? (
                              <Link
                                href={ev.documentUrl}
                                className="font-mono font-extrabold text-xs text-primary hover:underline inline-flex items-center gap-1 group/doc"
                              >
                                <span>{ev.documentNumber}</span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/doc:opacity-100 transition-opacity" />
                              </Link>
                            ) : (
                              <span className="font-mono font-bold text-xs text-gray-700">{ev.documentNumber}</span>
                            )}
                          </td>

                          {/* 4. Tərəf (Kontragent) */}
                          <td className="py-3 px-4 text-xs font-semibold text-gray-800">
                            <div className="flex flex-col">
                              <span>{ev.counterparty}</span>
                              {ev.warehouseName && (
                                <span className="text-[10px] text-gray-400 font-normal">{ev.warehouseName}</span>
                              )}
                            </div>
                          </td>

                          {/* 5. Miqdar */}
                          <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-extrabold text-xs sm:text-sm">
                            <span
                              className={
                                isPositive
                                  ? "text-emerald-600"
                                  : isZero
                                  ? "text-gray-400"
                                  : "text-rose-600"
                              }
                            >
                              {isPositive ? `+${ev.quantity}` : ev.quantity}
                            </span>{" "}
                            <span className="text-[10px] font-sans font-medium text-gray-400">
                              {currentProduct?.unit || "ədəd"}
                            </span>
                          </td>

                          {/* 6. Qiymət */}
                          <td className="py-3 px-4 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                            {ev.unitPrice > 0 ? `${ev.unitPrice.toFixed(2)} ₼` : "—"}
                          </td>

                          {/* 7. Məbləğ */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-gray-900 whitespace-nowrap">
                            {ev.totalAmount > 0 ? `${ev.totalAmount.toFixed(2)} ₼` : "—"}
                          </td>

                          {/* 8. Qalıq (Running Balance) */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-xs sm:text-sm text-gray-950 px-2 py-0.5 rounded-lg bg-gray-100/70 border border-gray-200/50">
                              {ev.balanceAfter}{" "}
                              <span className="text-[10px] font-sans font-medium text-gray-400">
                                {currentProduct?.unit || "ədəd"}
                              </span>
                            </span>
                          </td>

                          {/* 9. Qeyd / İcraçı */}
                          <td className="py-3 px-4 pr-6 text-xs text-gray-500 max-w-xs">
                            <div className="truncate" title={ev.notes || ""}>
                              {ev.notes || "—"}
                            </div>
                            {ev.operator && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <User className="w-2.5 h-2.5" /> {ev.operator}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
