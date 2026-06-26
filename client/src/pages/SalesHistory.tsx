import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "../components/Toast.tsx";
import {
  History,
  Search,
  FileText,
  ArrowRight,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Barcode,
  Calendar,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Truck,
  Lock,
  RotateCcw,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface Sale {
  id: number;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentType: string;
  bankName?: string | null;
  creditDueDate: string | null;
  notes: string | null;
  saleDate: string;
  totalAmount: number;
  totalCost: number;
  paymentStatus: string;
  sellerName?: string | null;
  items?: any[];
  returns?: any[];
  serials?: any[];
  warehouseId?: number | null;
}

const paymentBadges: Record<string, string> = {
  Nəğd: "bg-green-50 text-green-700 border-green-100",
  Kart: "bg-blue-50 text-blue-700 border-blue-100",
  Kart2Kart: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Köçürmə: "bg-purple-50 text-purple-700 border-purple-100",
  Nisyə: "bg-amber-50 text-amber-700 border-amber-100",
};

export default function SalesHistory() {
  const [activeTab, setActiveTab] = useState<"sales" | "warranty" | "lossSales">("sales");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Return Modal States
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({}); // productId -> qty
  const [returnStatuses, setReturnStatuses] = useState<Record<number, "returned_to_stock" | "defective">>({}); // productId -> status
  const [returnSerials, setReturnSerials] = useState<Record<number, string[]>>({}); // productId -> serial numbers array
  const [returnReason, setReturnReason] = useState("");
  const [returnAdminPassword, setReturnAdminPassword] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const getSaleReturnableQty = (sale: Sale) => {
    let totalSold = 0;
    if (sale.items) {
      totalSold = sale.items.reduce((sum, item) => sum + Number(item.quantity), 0);
    }
    let totalReturned = 0;
    if (sale.returns) {
      for (const ret of sale.returns) {
        if (ret.items) {
          totalReturned += ret.items.reduce((sum: number, ri: any) => sum + Number(ri.quantity), 0);
        }
      }
    }
    return totalSold - totalReturned;
  };

  const handleInitiateReturn = (sale: Sale) => {
    setSelectedSaleForReturn(sale);
    setReturnReason("");
    setReturnAdminPassword("");
    
    const initialQuantities: Record<number, string> = {};
    const initialStatuses: Record<number, "returned_to_stock" | "defective"> = {};
    const initialSerials: Record<number, string[]> = {};
    
    if (sale.items) {
      sale.items.forEach((item) => {
        initialQuantities[item.productId] = "0";
        initialStatuses[item.productId] = "returned_to_stock";
        initialSerials[item.productId] = [];
      });
    }
    
    setReturnQuantities(initialQuantities);
    setReturnStatuses(initialStatuses);
    setReturnSerials(initialSerials);
    setIsReturnModalOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForReturn) return;

    // Validate that at least one item has a return quantity > 0
    const itemsToReturn: any[] = [];
    let hasInvalidQuantity = false;
    let errorMessage = "";

    selectedSaleForReturn.items?.forEach((item) => {
      const isSerialized = item.product?.trackingType === "serialized";
      let qty = 0;
      let serials: string[] = [];

      if (isSerialized) {
        serials = returnSerials[item.productId] || [];
        qty = serials.length;
      } else {
        qty = parseFloat(returnQuantities[item.productId] || "0");
      }

      if (qty > 0) {
        // Calculate max returnable
        let alreadyReturned = 0;
        if (selectedSaleForReturn.returns) {
          for (const ret of selectedSaleForReturn.returns) {
            const retItem = ret.items?.find((ri: any) => ri.productId === item.productId);
            if (retItem) {
              alreadyReturned += Number(retItem.quantity);
            }
          }
        }
        const maxReturnable = Number(item.quantity) - alreadyReturned;
        if (qty > maxReturnable) {
          hasInvalidQuantity = true;
          errorMessage = `${item.product?.name || item.productName || "Məhsul"} üçün maksimum qaytarıla bilən miqdar: ${maxReturnable}`;
          return;
        }

        itemsToReturn.push({
          productId: item.productId,
          quantity: qty,
          salePrice: Number(item.unitPrice || item.salePrice || 0),
          purchasePrice: Number(item.purchasePrice || 0),
          status: returnStatuses[item.productId] || "returned_to_stock",
          serialNumbers: serials
        });
      }
    });

    if (hasInvalidQuantity) {
      toast({ title: "Xəta", description: errorMessage, variant: "destructive" });
      return;
    }

    if (itemsToReturn.length === 0) {
      toast({ title: "Xəta", description: "Qaytarmaq üçün ən azı bir məhsulun miqdarı təyin edilməlidir.", variant: "destructive" });
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "Staff",
          "x-user-username": user?.username || ""
        },
        body: JSON.stringify({
          saleId: selectedSaleForReturn.id,
          reason: returnReason,
          warehouseId: selectedSaleForReturn.warehouseId,
          adminPassword: returnAdminPassword,
          items: itemsToReturn
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Geri qaytarış tamamlanarkən xəta baş verdi.");
      }

      toast({ title: "Uğurlu", description: "Geri qaytarış uğurla rəsmiləşdirildi.", variant: "success" });
      setIsReturnModalOpen(false);
      setSelectedSaleForReturn(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    } catch (err: any) {
      toast({ title: "Xəta", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();

  // Sales History Tab States
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [filterActive, setFilterActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset page when queries change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, filterActive, searchQuery, selectedSeller, activeTab]);

  // Horizontal scroll Refs
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const warrantyScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  React.useEffect(() => {
    const el = warrantyScrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Warranty Lookup Tab States
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

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

  // Sales Query
  const params = filterActive ? `?from=${fromDate}&to=${toDate}` : "";
  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales", fromDate, toDate, filterActive],
    queryFn: async () => {
      const res = await fetch(`/api/sales${params}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: activeTab === "sales",
  });

  const sellerNames = React.useMemo(() => {
    if (!sales) return [];
    const names = new Set<string>();
    sales.forEach(sale => {
      if (sale.sellerName) names.add(sale.sellerName);
    });
    return Array.from(names).sort();
  }, [sales]);

  const handleFilter = () => {
    setFilterActive(true);
  };

  const handleReset = () => {
    const todayStr = getTodayString();
    setFromDate(todayStr);
    setToDate(todayStr);
    setFilterActive(true);
    setSearchQuery("");
    setSelectedSeller("");
  };

  const filteredSales = (sales || []).filter((sale) => {
    // 1. Employee Filter
    if (selectedSeller && sale.sellerName !== selectedSeller) {
      return false;
    }

    // 2. Text Search
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const formattedId = `#${sale.id.toString().padStart(5, "0")}`;
    return (
      sale.id.toString().includes(q) ||
      formattedId.toLowerCase().includes(q) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
      (sale.customerPhone && sale.customerPhone.toLowerCase().includes(q)) ||
      (sale.paymentType && sale.paymentType.toLowerCase().includes(q)) ||
      (sale.notes && sale.notes.toLowerCase().includes(q)) ||
      (sale.sellerName && sale.sellerName.toLowerCase().includes(q))
    );
  });

  const totalSalesRevenue = filteredSales 
    ? filteredSales.reduce((sum, s) => {
        const returned = (s.returns || []).reduce((acc: number, r: any) => acc + Number(r.totalAmount || 0), 0);
        return sum + (Number(s.totalAmount || 0) - returned);
      }, 0) 
    : 0;

  const totalSalesCost = filteredSales 
    ? filteredSales.reduce((sum, s) => {
        const returnedCost = (s.returns || []).reduce((retSum: number, r: any) => {
          const itemsCost = (r.items || []).reduce((iSum: number, item: any) => {
            return iSum + (Number(item.purchasePrice || 0) * Number(item.quantity || 0));
          }, 0);
          return retSum + itemsCost;
        }, 0);
        return sum + (Number(s.totalCost || 0) - returnedCost);
      }, 0) 
    : 0;

  const totalSalesProfit = totalSalesRevenue - totalSalesCost;

  // Sales pagination calculations
  const totalSalesItems = filteredSales.length;
  const totalSalesPages = pageSize === -1 ? 1 : Math.ceil(totalSalesItems / pageSize);
  
  // Safe-guard currentPage boundary
  useEffect(() => {
    if (currentPage > totalSalesPages && totalSalesPages > 0) {
      setCurrentPage(totalSalesPages);
    }
  }, [filteredSales.length, pageSize, totalSalesPages, currentPage]);

  const paginatedSales = pageSize === -1
    ? filteredSales
    : filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Extract individual sale items sold below cost price (loss-making items)
  const lossItems = React.useMemo(() => {
    const list: any[] = [];
    if (sales) {
      for (const sale of sales) {
        if (sale.items) {
          for (const item of sale.items) {
            const salePrice = Number(item.salePrice || 0);
            const costPrice = Number(item.purchasePrice || 0);
            if (salePrice < costPrice) {
              const lossPerUnit = costPrice - salePrice;
              const totalLoss = lossPerUnit * Number(item.quantity || 0);
              list.push({
                saleId: sale.id,
                customerName: sale.customerName || "Nəğd Satış",
                customerPhone: sale.customerPhone,
                saleDate: sale.saleDate,
                paymentType: sale.paymentType,
                productId: item.productId,
                productName: item.product?.name || item.productName || "Naməlum Məhsul",
                unit: item.product?.unit || "ədəd",
                quantity: Number(item.quantity || 0),
                costPrice,
                salePrice,
                lossPerUnit,
                totalLoss,
              });
            }
          }
        }
      }
    }
    return list;
  }, [sales]);

  // Serial/IMEI Lookup Handler
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(`/api/serials/lookup?serialNumber=${encodeURIComponent(lookupQuery.trim())}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Axtarış zamanı xəta baş verdi");
      }
      const data = await res.json();
      setLookupResult(data);
    } catch (err: any) {
      setLookupError(err.message || "Bu serial nömrəsi ilə məhsul tapılmadı");
    } finally {
      setLookupLoading(false);
    }
  };

  if (user?.role !== "Admin" && currentUser?.staffCanViewSalesHistory === 0) {
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
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Satışlar və Zəmanət</h2>
        <p className="text-xs text-gray-400 mt-1">
          Satış tarixçəsini izləyin və serial nömrəsi (IMEI) üzrə zəmanət yoxlanışı edin
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab("sales")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all cursor-pointer ${
            activeTab === "sales"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <History className="w-4 h-4" />
          Satış Tarixçəsi
        </button>
        <button
          onClick={() => setActiveTab("lossSales")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all cursor-pointer ${
            activeTab === "lossSales"
              ? "border-red-500 text-red-500 font-extrabold"
              : "border-transparent text-gray-400 hover:text-red-400"
          }`}
        >
          <AlertCircle className="w-4 h-4 text-red-500" />
          Endirim Məbləği
        </button>
        <button
          onClick={() => setActiveTab("warranty")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all cursor-pointer ${
            activeTab === "warranty"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Zəmanət və IMEI Yoxlama
        </button>
      </div>

      {/* Sales Tab */}
      {activeTab === "sales" && (
        <div className="space-y-6 animate-in fade-in-0 duration-200">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-xs glass-card text-xs font-semibold w-full md:max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Qaimə №, müştəri adı, telefon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>
            </div>

            {/* Date & Seller Filter Controls */}
            <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass w-full md:w-auto">
              {isAdmin && (
                <div className="space-y-1 flex-1 min-w-[140px] sm:flex-initial">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Satıcı (İşçi)</label>
                  <select
                    value={selectedSeller}
                    onChange={(e) => setSelectedSeller(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-44 bg-gray-50/50 cursor-pointer font-bold text-gray-700"
                  >
                    <option value="">Hamısı (Bütün İşçilər)</option>
                    {sellerNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Başlanğıc</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50 font-bold"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Son</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50 font-bold"
                />
              </div>
              <button
                onClick={handleFilter}
                disabled={!fromDate && !toDate}
                className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 w-full sm:w-auto shadow-sm shadow-primary/10 transition-all"
              >
                Filtrlə
              </button>
              {(filterActive || selectedSeller) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer w-full sm:w-auto transition-all"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Overview Analytics for current filter */}
          {!isLoading && filteredSales && filteredSales.length > 0 && (
            <div className={`grid gap-4 grid-cols-1 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-1 max-w-sm"} p-4 bg-primary/5 border border-primary/10 rounded-2xl glass text-xs font-medium text-gray-500`}>
              <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dövr Gəliri</span>
                <span className="text-xl font-bold text-gray-900 font-mono block mt-1">
                  {Number(totalSalesRevenue).toFixed(2)} ₼
                </span>
              </div>
              {isAdmin && (
                <>
                  <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dövr Mayası</span>
                    <span className="text-xl font-bold text-gray-900 font-mono block mt-1">
                      {Number(totalSalesCost).toFixed(2)} ₼
                    </span>
                  </div>
                  <div className="p-3 bg-white/70 border border-gray-100/50 rounded-xl text-green-600">
                    <span className="text-[10px] font-bold text-green-600/60 uppercase tracking-wider block">Dövr Mənfəəti</span>
                    <span className="text-xl font-bold font-mono block mt-1">
                      +{Number(totalSalesProfit).toFixed(2)} ₼
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sales History Table */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
            <div ref={scrollRef} className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="p-4 pl-6 text-center w-16">Qaimə №</th>
                    <th className="p-4">Müştəri</th>
                    <th className="p-4">Tarix</th>
                    <th className="p-4 text-center">Satıcı</th>
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
                      <td colSpan={isAdmin ? 9 : 8} className="p-10 text-center text-xs text-gray-400">
                        Yüklənir...
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="p-16 text-center text-xs text-gray-400">
                        {searchQuery ? "Axtarışa uyğun satış qaiməsi tapılmadı." : "Heç bir satış tapılmadı."}
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((sale) => {
                      const returned = (sale.returns || []).reduce((acc: number, r: any) => acc + Number(r.totalAmount || 0), 0);
                      const returnedCost = (sale.returns || []).reduce((retSum: number, r: any) => {
                        const itemsCost = (r.items || []).reduce((iSum: number, item: any) => {
                          return iSum + (Number(item.purchasePrice || 0) * Number(item.quantity || 0));
                        }, 0);
                        return retSum + itemsCost;
                      }, 0);
                      const netAmount = Number(sale.totalAmount || 0) - returned;
                      const netCost = Number(sale.totalCost || 0) - returnedCost;
                      const profit = netAmount - netCost;
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
                            {sale.items && sale.items.length > 0 && (
                              <div className="text-[10px] text-gray-400 font-medium mt-1.5 flex flex-wrap gap-1">
                                {sale.items.map((item: any) => (
                                  <span key={item.id} className="inline-flex items-center bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md border border-gray-100 text-[9px] font-bold">
                                    {item.product?.name || item.productName || "Məhsul"} ({item.quantity} {item.product?.unit || "ədəd"})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-gray-500 font-medium">
                            {new Date(sale.saleDate).toLocaleDateString("az-AZ")} |{" "}
                            {new Date(sale.saleDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700 text-[10.5px] font-black">
                              {sale.sellerName || "Sistem"}
                            </span>
                          </td>
                          <td className="p-4 text-center font-semibold">
                            <span
                              className={`px-2 py-0.5 border rounded-full text-[9px] font-bold ${
                                sale.paymentType === "Nisyə" && sale.paymentStatus === "paid"
                                  ? "bg-green-50 text-green-700 border-green-100"
                                  : paymentBadges[sale.paymentType] || "bg-gray-50 text-gray-500"
                              }`}
                            >
                              {sale.paymentType === "Nisyə" && sale.paymentStatus === "paid"
                                ? "Nisyə (Bağlı)"
                                : sale.paymentType}
                            </span>
                            {sale.paymentType === "Kart" && sale.bankName && (
                              <span className="text-[9px] text-gray-500 font-bold block mt-0.5">
                                {sale.bankName}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono">
                            <span className="font-bold text-gray-955 block">{Number(netAmount).toFixed(2)} ₼</span>
                            {returned > 0 && (
                              <span className="text-[10px] text-amber-600 font-bold block mt-0.5" title={`İlkin: ${Number(sale.totalAmount).toFixed(2)} ₼`}>
                                Qaytarılıb: -{Number(returned).toFixed(2)} ₼
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className={`p-4 text-right font-bold font-mono ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {profit >= 0 ? "+" : ""}
                              {Number(profit).toFixed(2)} ₼
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
                              {sale.paymentStatus === "paid"
                                ? (sale.paymentType === "Nisyə" ? "Bağlı" : "Ödənilib")
                                : (sale.paymentType === "Nisyə" ? "Nisyə" : "Ödənilməyib")}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link href={`/satislar/${sale.id}`}>
                                <button className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-primary rounded-xl cursor-pointer bg-white transition-all" title="Bax">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                              {getSaleReturnableQty(sale) > 0 && (
                                <button
                                  onClick={() => handleInitiateReturn(sale)}
                                  className="p-2 border border-red-100 hover:border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50/30 rounded-xl cursor-pointer bg-white transition-all"
                                  title="Geri Qaytar"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
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

            {/* Pagination Controls */}
            {totalSalesItems > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-gray-500">
                <div className="flex items-center gap-4">
                  {/* Show choice dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Göstər:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs font-bold text-gray-700"
                    >
                      <option value={10}>10 sətir</option>
                      <option value={20}>20 sətir</option>
                      <option value={50}>50 sətir</option>
                      <option value={100}>100 sətir</option>
                      <option value={-1}>Hamısı</option>
                    </select>
                  </div>
                  
                  {/* Summary of showing items */}
                  <span>
                    {pageSize === -1 ? (
                      `Toplam ${totalSalesItems} satışın hamısı göstərilir`
                    ) : (
                      `Toplam ${totalSalesItems} satışdan ${Math.min(totalSalesItems, (currentPage - 1) * pageSize + 1)}-${Math.min(totalSalesItems, currentPage * pageSize)} aralığı`
                    )}
                  </span>
                </div>

                {pageSize !== -1 && totalSalesPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    {/* Previous button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalSalesPages }, (_, i) => i + 1).map((pageNum) => {
                      if (
                        totalSalesPages > 6 &&
                        pageNum !== 1 &&
                        pageNum !== totalSalesPages &&
                        Math.abs(pageNum - currentPage) > 1
                      ) {
                        if (pageNum === 2 && currentPage > 3) {
                          return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                        }
                        if (pageNum === totalSalesPages - 1 && currentPage < totalSalesPages - 2) {
                          return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                        }
                        return null;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7.5 h-7.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            currentPage === pageNum
                              ? "bg-primary text-white border-primary shadow-xs"
                              : "border-gray-200 hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Next button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalSalesPages, prev + 1))}
                      disabled={currentPage === totalSalesPages}
                      className="p-1.5 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mayadan Ucuz Satışlar Tab */}
      {activeTab === "lossSales" && (
        <div className="space-y-6 animate-in fade-in-0 duration-200">
          {/* Overview Analytics for Loss Sales */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 p-4 bg-red-50/50 border border-red-100 rounded-2xl glass text-xs font-medium text-gray-500">
            <div className="p-3 bg-white/70 border border-red-100/35 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cəmi Satış Məbləği (Ödəniş)</span>
              <span className="text-xl font-bold text-red-600 font-mono block mt-1">
                -{lossItems.reduce((sum: number, item: any) => sum + item.salePrice * item.quantity, 0).toFixed(2)} ₼
              </span>
            </div>
            <div className="p-3 bg-white/70 border border-red-100/35 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Malların Cəmi Mayası</span>
              <span className="text-xl font-bold text-gray-900 font-mono block mt-1">
                {lossItems.reduce((sum: number, item: any) => sum + item.costPrice * item.quantity, 0).toFixed(2)} ₼
              </span>
            </div>
            <div className="p-3 bg-white/70 border border-red-100/35 rounded-xl text-red-600">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Yekun Güzəşt (Endirim Məbləği)</span>
              <span className="text-xl font-bold font-mono block mt-1">
                -{lossItems.reduce((sum: number, item: any) => sum + item.totalLoss, 0).toFixed(2)} ₼
              </span>
            </div>
          </div>

          {/* Loss Sales Table */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
            <div ref={warrantyScrollRef} className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="p-4 pl-6 text-center w-16">Qaimə №</th>
                    <th className="p-4">Məhsul</th>
                    <th className="p-4">Müştəri / Tarix</th>
                    <th className="p-4 text-right">Maya (Alış)</th>
                    <th className="p-4 text-right">Ödəniş</th>
                    <th className="p-4 text-center">Miqdar</th>
                    <th className="p-4 text-right">Endirim (Vahid)</th>
                    <th className="p-4 text-right pr-6">Yekun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-600">
                  {lossItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-xs text-gray-400">
                        Bu dövr ərzində maya dəyərindən ucuz satılmış mal tapılmadı.
                      </td>
                    </tr>
                  ) : (
                    lossItems.map((item: any, idx: number) => (
                      <tr key={`${item.saleId}-${item.productId}-${idx}`} className="hover:bg-red-50/10 transition-all border-b border-gray-50">
                        {/* Sale ID */}
                        <td className="p-4 text-center font-mono text-gray-900 font-bold">
                          #{item.saleId.toString().padStart(5, "0")}
                        </td>

                        {/* Product Name */}
                        <td className="p-4">
                          <span className="font-bold text-gray-900 block">{item.productName}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">Vahid: {item.unit}</span>
                        </td>

                        {/* Customer & Date */}
                        <td className="p-4">
                          <span className="font-bold text-gray-900 block">{item.customerName}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            {new Date(item.saleDate).toLocaleDateString("az-AZ")} | {new Date(item.saleDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        {/* Cost Price */}
                        <td className="p-4 text-right font-mono text-gray-500">
                          {item.costPrice.toFixed(2)} ₼
                        </td>

                        {/* Sale Price (Payment) -> In red with minus sign! */}
                        <td className="p-4 text-right font-mono text-red-600 font-bold">
                          -{item.salePrice.toFixed(2)} ₼
                        </td>

                        {/* Quantity */}
                        <td className="p-4 text-center font-bold text-gray-700">
                          {item.quantity}
                        </td>

                        {/* Loss/Discount Per Unit */}
                        <td className="p-4 text-right font-mono text-gray-500">
                          {item.lossPerUnit.toFixed(2)} ₼
                        </td>

                        {/* Total Loss (Yekun) -> In red with minus sign! */}
                        <td className="p-4 text-right pr-6 font-mono text-red-600 font-black">
                          -{item.totalLoss.toFixed(2)} ₼
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Warranty & IMEI Lookup Tab */}
      {activeTab === "warranty" && (
        <div className="space-y-6 animate-in fade-in-0 duration-200">
          {/* Search Box */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card max-w-xl">
            <h3 className="text-base font-black text-gray-900 tracking-tight mb-2">IMEI / Serial Nömrə Axtarışı</h3>
            <p className="text-xs text-gray-400 mb-4">
              Məhsulun zəmanət vəziyyətini, anbar girişini və satış tarixçəsini yoxlamaq üçün serial nömrəsini daxil edin.
            </p>
            <form onSubmit={handleLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Serial nömrəsi və ya IMEI daxil edin..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm font-medium bg-gray-50/50"
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading || !lookupQuery.trim()}
                className="px-5 py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-primary/10 hover-elevate"
              >
                {lookupLoading ? "Yoxlanılır..." : "Yoxla"}
              </button>
            </form>
          </div>

          {/* Error Message */}
          {lookupError && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 max-w-xl animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-800">Axtarış Uğursuz Oldu</h4>
                <p className="text-[11px] text-red-600 mt-1">{lookupError}</p>
              </div>
            </div>
          )}

          {/* Details Dashboard Result */}
          {lookupResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4">
              {/* Product & Flow Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Product Profile Card */}
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                        {lookupResult.product?.category || "Kateqoriya yoxdur"}
                      </span>
                      <h3 className="text-lg font-black text-gray-900 mt-1.5">{lookupResult.product?.name}</h3>
                      <p className="text-xs text-gray-400 font-mono mt-1 flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-gray-400" />
                        Barkod: {lookupResult.product?.barcode || "Yoxdur"} | S/N: {lookupResult.serialNumber}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      lookupResult.status === "in_stock" ? "bg-green-50 text-green-700 border-green-100" :
                      lookupResult.status === "sold" ? "bg-blue-50 text-blue-700 border-blue-100" :
                      lookupResult.status === "defective" ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-gray-50 text-gray-700 border-gray-100"
                    }`}>
                      {lookupResult.status === "in_stock" ? "Anbardadır" :
                       lookupResult.status === "sold" ? "Satılıb" :
                       lookupResult.status === "defective" ? "Zay / Defekt" :
                       "Silinib"}
                    </span>
                  </div>
                </div>

                {/* Purchase and Sale Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Stock In (Purchase) Info */}
                  <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs glass-card space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold border-b border-gray-100 pb-3">
                      <Truck className="w-4 h-4 text-primary" />
                      <h4 className="text-xs uppercase tracking-wider">Anbara Giriş (Tədarük)</h4>
                    </div>
                    {lookupResult.stockEntry ? (
                      <div className="space-y-2.5 text-xs text-gray-500 font-medium">
                        <div className="flex justify-between">
                          <span>Tədarükçü:</span>
                          <span className="font-bold text-gray-900">{lookupResult.stockEntry.supplier || "Qeyd edilməyib"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Qəbul Tarixi:</span>
                          <span className="font-bold text-gray-900 font-mono">
                            {new Date(lookupResult.stockEntry.entryDate).toLocaleDateString("az-AZ")}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex justify-between">
                            <span>Alış Qiyməti:</span>
                            <span className="font-bold text-gray-900 font-mono">
                              {Number(lookupResult.stockEntry.purchasePrice).toFixed(2)} ₼
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Qəbul Qaiməsi:</span>
                          <span className="font-bold text-gray-900 font-mono">№ {lookupResult.stockEntry.id.toString().padStart(5, "0")}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Anbara giriş tarixçəsi yoxdur.</p>
                    )}
                  </div>

                  {/* Sales Info */}
                  <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs glass-card space-y-4">
                    <div className="flex items-center gap-2 text-gray-800 font-bold border-b border-gray-100 pb-3">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                      <h4 className="text-xs uppercase tracking-wider">Satış Məlumatları</h4>
                    </div>
                    {lookupResult.sale ? (
                      <div className="space-y-2.5 text-xs text-gray-500 font-medium">
                        <div className="flex justify-between">
                          <span>Müştəri:</span>
                          <span className="font-bold text-gray-900">{lookupResult.sale.customerName || "Nəğd Müştəri"}</span>
                        </div>
                        {lookupResult.sale.customerPhone && (
                          <div className="flex justify-between">
                            <span>Telefon:</span>
                            <span className="font-bold text-gray-900">{lookupResult.sale.customerPhone}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Satış Tarixi:</span>
                          <span className="font-bold text-gray-900 font-mono">
                            {new Date(lookupResult.sale.saleDate).toLocaleDateString("az-AZ")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Satış Qaiməsi:</span>
                          <Link href={`/satislar/${lookupResult.sale.id}`} className="font-bold text-primary hover:underline flex items-center gap-1">
                            № {lookupResult.sale.id.toString().padStart(5, "0")}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Bu məhsul hələ satılmayıb.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Warranty Dashboard Block */}
              <div className="space-y-6">
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card space-y-4">
                  <div className="flex items-center gap-2 text-gray-800 font-bold border-b border-gray-100 pb-3">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h4 className="text-xs uppercase tracking-wider">Zəmanət Vərəqi</h4>
                  </div>

                  {(() => {
                    if (lookupResult.status === "defective" || lookupResult.status === "written_off") {
                      return (
                        <div className="space-y-3">
                          <div className="bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-100 flex items-start gap-2 text-xs font-semibold">
                            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                            <div>
                              <span className="font-bold block text-red-950">İstifadəyə Yararsız</span>
                              Məhsul zay/defekt olaraq işarələnib. Rəsmi zəmanət ləğv edilmişdir.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (!lookupResult.sale) {
                      return (
                        <div className="space-y-3">
                          <div className="bg-amber-50 text-amber-800 p-3.5 rounded-xl border border-amber-100 flex items-start gap-2 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              <span className="font-bold block text-amber-950">Satış Gözlənilir</span>
                              Məhsul anbarda satışı gözləyir. POS satış anında 1 illik (365 gün) rəsmi zəmanət avtomatik aktivləşəcək.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Calculate warranty expiration
                    const saleDate = new Date(lookupResult.sale.saleDate);
                    const expiryDate = new Date(saleDate.getTime() + 365 * 24 * 60 * 60 * 1000);
                    const today = new Date();
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isWarrantyActive = diffDays > 0;

                    return (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-semibold ${
                          isWarrantyActive
                            ? "bg-green-50 text-green-800 border-green-100"
                            : "bg-red-50 text-red-800 border-red-100"
                        }`}>
                          {isWarrantyActive ? (
                            <ShieldCheck className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <span className="font-bold text-sm block mb-1">
                              {isWarrantyActive ? "ZƏMANƏT AKTİVDİR" : "ZƏMANƏT MÜDDƏTİ BİTİB"}
                            </span>
                            {isWarrantyActive
                              ? `Zəmanətin bitməsinə hələ ${diffDays} gün qalıb.`
                              : `Zəmanət müddəti ${Math.abs(diffDays)} gün əvvəl başa çatmışdır.`}
                          </div>
                        </div>

                        <div className="space-y-2 text-xs text-gray-500 font-medium bg-gray-50/50 p-3.5 rounded-xl border border-gray-100">
                          <div className="flex justify-between">
                            <span>Müddət:</span>
                            <span className="font-bold text-gray-900">1 İl (365 Gün)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Başlanğıc:</span>
                            <span className="font-bold text-gray-900">{saleDate.toLocaleDateString("az-AZ")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Son Tarix:</span>
                            <span className="font-bold text-gray-900">{expiryDate.toLocaleDateString("az-AZ")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Geri Qaytarış Modalı */}
      {isReturnModalOpen && selectedSaleForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden glass-card relative animate-in zoom-in-95 duration-200">
            {/* Top Border Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 mt-1">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-red-500" />
                  Məhsulların Geri Qaytarılması
                </h3>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                  Qaimə №: #{selectedSaleForReturn.id.toString().padStart(5, "0")} | Müştəri: {selectedSaleForReturn.customerName || "Nəğd Satış"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedSaleForReturn(null);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmitReturn} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Sale Items List */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Satılmış Məhsullar</h4>
                  <div className="space-y-3">
                    {selectedSaleForReturn.items?.map((item: any) => {
                      const isSerialized = item.product?.trackingType === "serialized";

                      // Calculate max returnable
                      let alreadyReturned = 0;
                      if (selectedSaleForReturn.returns) {
                        for (const ret of selectedSaleForReturn.returns) {
                          const retItem = ret.items?.find((ri: any) => ri.productId === item.productId);
                          if (retItem) {
                            alreadyReturned += Number(retItem.quantity);
                          }
                        }
                      }
                      const maxReturnable = Number(item.quantity) - alreadyReturned;

                      // Filter serials sold in this sale
                      const productSerials = (selectedSaleForReturn.serials || []).filter(
                        (s: any) => s.productId === item.productId && (s.status === "sold" || s.returnId === null)
                      );

                      return (
                        <div key={item.id} className="p-4 bg-gray-50/70 border border-gray-100/50 rounded-xl space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <span className="font-bold text-gray-900 block">{item.product?.name || item.productName || "Məhsul"}</span>
                              <span className="text-[10px] text-gray-400 font-semibold mt-0.5 block">
                                Satılıb: {item.quantity} {item.product?.unit || "ədəd"} | Qaytarılıb: {alreadyReturned} | Qiymət: {Number(item.unitPrice || item.salePrice || 0).toFixed(2)} ₼
                              </span>
                            </div>
                            
                            {maxReturnable > 0 ? (
                              <span className="bg-red-50 text-red-600 border border-red-100/40 px-2 py-0.5 rounded-md text-[9px] font-bold self-start sm:self-center">
                                Qaytarıla bilən: {maxReturnable} {item.product?.unit || "ədəd"}
                              </span>
                            ) : (
                              <span className="bg-green-50 text-green-700 border border-green-100/40 px-2 py-0.5 rounded-md text-[9px] font-bold self-start sm:self-center">
                                Tamamilə qaytarılıb ✓
                              </span>
                            )}
                          </div>

                          {maxReturnable > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200/50 pt-3">
                              {/* Left Column: Return Qty / Serials Selector */}
                              <div className="space-y-1.5">
                                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qaytarılan Miqdar *</label>
                                {isSerialized ? (
                                  <div className="space-y-2">
                                    <span className="text-[10px] text-amber-700 font-bold block mb-1">
                                      Geri qaytarılacaq IMEI / S/N seçin:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {productSerials.map((s: any) => {
                                        const isChecked = (returnSerials[item.productId] || []).includes(s.serialNumber);
                                        return (
                                          <button
                                            type="button"
                                            key={s.id}
                                            onClick={() => {
                                              const current = returnSerials[item.productId] || [];
                                              let next: string[];
                                              if (isChecked) {
                                                next = current.filter(x => x !== s.serialNumber);
                                              } else {
                                                next = [...current, s.serialNumber];
                                              }
                                              setReturnSerials(prev => ({ ...prev, [item.productId]: next }));
                                            }}
                                            className={`px-2 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                              isChecked
                                                ? "bg-red-600 border-red-600 text-white shadow-xs"
                                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                            }`}
                                          >
                                            {s.serialNumber}
                                          </button>
                                        );
                                      })}
                                      {productSerials.length === 0 && (
                                        <span className="text-[10px] text-gray-400 italic">Sifarişin serial nömrəsi tapılmadı.</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-900 block mt-1">
                                      Seçilən: {(returnSerials[item.productId] || []).length} ədəd
                                    </span>
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    max={maxReturnable}
                                    placeholder="0"
                                    value={returnQuantities[item.productId] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setReturnQuantities(prev => ({ ...prev, [item.productId]: val }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-white font-bold"
                                  />
                                )}
                              </div>

                              {/* Right Column: Disposition Status */}
                              <div className="space-y-1.5">
                                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsulun Vəziyyəti (Disposition) *</label>
                                <select
                                  value={returnStatuses[item.productId] || "returned_to_stock"}
                                  onChange={(e) => {
                                    const val = e.target.value as "returned_to_stock" | "defective";
                                    setReturnStatuses(prev => ({ ...prev, [item.productId]: val }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-white cursor-pointer font-bold text-gray-700"
                                >
                                  <option value="returned_to_stock">♻️ Anbara Qaytarılsın (Yenidən Satışa Yararlıdır)</option>
                                  <option value="defective">⚠️ Qüsurludur/Yararsızdır (Anbara QAYITMASIN / Zay Edilsin)</option>
                                </select>
                                <p className="text-[9px] text-gray-400 leading-normal">
                                  {returnStatuses[item.productId] === "defective"
                                    ? "Qüsurlu seçildikdə, məhsul aktiv satış balansına bərpa edilmir və zay kateqoriyasına silinir."
                                    : "Anbara qaytarılsın seçildikdə, miqdar dərhal həmin anbarın balansına bərpa edilir."}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reason Note */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Geri Qaytarılma Səbəbi</label>
                  <textarea
                    placeholder="Məs. Müştəri razı qalmadı, Defekt aşkarlandı və s."
                    rows={2}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                  />
                </div>

                {/* Admin Password Block */}
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-bold">
                    <Lock className="w-4 h-4" />
                    <h5 className="text-[11px] uppercase tracking-wider">Təsdiqləmə Tələb Olunur</h5>
                  </div>
                  <p className="text-[10px] text-red-700/80 leading-normal">
                    Qaytarış əməliyyatını tamamlamaq üçün mağaza administratorunun sistem şifrəsini daxil edin. Bu, dövriyyə balansının düzgünlüyü üçün məcburidir.
                  </p>
                  <div className="space-y-1">
                    <input
                      type="password"
                      placeholder="Admin Şifrəsi"
                      required
                      value={returnAdminPassword}
                      onChange={(e) => setReturnAdminPassword(e.target.value)}
                      className="w-full max-w-xs px-3.5 py-2 border border-red-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-white font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsReturnModalOpen(false);
                    setSelectedSaleForReturn(null);
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-100 cursor-pointer transition-all"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-red-600/10 hover-elevate"
                >
                  {isSubmittingReturn ? "Rəsmiləşdirilir..." : (
                    <>
                      <RotateCcw className="w-4 h-4" /> Qaytarışı Təsdiqlə
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
