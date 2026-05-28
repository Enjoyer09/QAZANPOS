import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  ShoppingCart,
  Trash2,
  CheckCircle,
  Plus,
  Minus,
  Barcode,
  Receipt,
  UserPlus,
} from "lucide-react";
import { 
  cacheProducts, 
  cacheCustomers, 
  cacheSettings,
  getCachedProducts,
  getCachedCustomers,
  getCachedSettings,
  saveOfflineSale
} from "../lib/offlineSync.ts";
import { useToast } from "../components/Toast.tsx";
import { printReceipt } from "../components/ReceiptPrint.tsx";

interface BasketItem {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  minPrice: number; // Snapshot of lastPurchasePrice
}

export default function POS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = user?.role === "Admin";

  // Basket State
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");

  // Customer State
  const [customerMode, setCustomerMode] = useState<"none" | "existing" | "new">("none");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  // Payment State
  const [paymentType, setPaymentType] = useState("Nəğd");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Checkout Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<any | null>(null);

  // Settings Query for receipt printing config
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const handleResetPOS = () => {
    setBasket([]);
    setSelectedProductId("");
    setSelectedQuantity("1");
    setCustomerMode("none");
    setSelectedCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setPaymentType("Nəğd");
    setCreditDueDate("");
    setNotes("");
    setLastCreatedSale(null);
    setShowSuccessModal(false);
  };

  // Queries
  const { data: stockLevels, isLoading: isStockLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/levels"],
    queryFn: async () => {
      const res = await fetch("/api/stock/levels");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
  });

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
  });

  // Silent automatic cache updates
  useEffect(() => {
    if (isOnline && settings) {
      cacheSettings(settings);
    }
  }, [isOnline, settings]);

  useEffect(() => {
    if (isOnline && stockLevels && Array.isArray(stockLevels)) {
      cacheProducts(stockLevels);
    }
  }, [isOnline, stockLevels]);

  useEffect(() => {
    if (isOnline && customers && Array.isArray(customers)) {
      cacheCustomers(customers);
    }
  }, [isOnline, customers]);

  // Read from local storage if offline
  const activeSettings = isOnline ? settings : getCachedSettings();
  const activeStockLevels = isOnline ? stockLevels : getCachedProducts();
  const activeCustomers = isOnline ? customers : getCachedCustomers();

  // Filter products that have positive stock levels
  const sellableProducts = activeStockLevels?.filter((p) => parseFloat(p.currentQuantity) > 0) || [];

  // Add item to basket
  const handleAddToBasket = () => {
    if (!selectedProductId) {
      toast({ title: "Xəta!", description: "Məhsul seçin", variant: "destructive" });
      return;
    }

    const prod = sellableProducts.find((p) => p.productId === parseInt(selectedProductId));
    if (!prod) return;

    const qty = parseFloat(selectedQuantity) || 1;
    if (qty <= 0) {
      toast({ title: "Xəta!", description: "Düzgün miqdar daxil edin", variant: "destructive" });
      return;
    }

    // Check if adding exceeds stock
    const existingInBasket = basket.find((item) => item.productId === prod.productId);
    const currentBasketQty = existingInBasket ? existingInBasket.quantity : 0;
    if (currentBasketQty + qty > prod.currentQuantity) {
      toast({
        title: "Xəta!",
        description: `Anbarda kifayət qədər yoxdur. Maksimum: ${prod.currentQuantity} ${prod.unit}`,
        variant: "destructive",
      });
      return;
    }

    if (existingInBasket) {
      setBasket((prev) =>
        prev.map((item) =>
          item.productId === prod.productId
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setBasket((prev) => [
        ...prev,
        {
          productId: prod.productId,
          productName: prod.productName,
          unit: prod.unit,
          quantity: qty,
          salePrice: prod.lastPurchasePrice, // Defaults to last purchase price
          minPrice: prod.lastPurchasePrice,
        },
      ]);
    }

    setSelectedProductId("");
    setSelectedQuantity("1");
  };

  // Remove item from basket
  const handleRemoveFromBasket = (id: number) => {
    setBasket((prev) => prev.filter((item) => item.productId !== id));
  };

  // Update item field (quantity or sale price) in basket
  const handleUpdateBasketItem = (id: number, field: "quantity" | "salePrice", val: string) => {
    const value = parseFloat(val) || 0;
    setBasket((prev) =>
      prev.map((item) => {
        if (item.productId !== id) return item;

        // If updating quantity, verify it doesn't exceed stock limit
        if (field === "quantity") {
          const prod = activeStockLevels?.find((p) => p.productId === id);
          if (prod && value > prod.currentQuantity) {
            toast({
              title: "Xəta!",
              description: `Anbar qalığı keçildi. Maksimum: ${prod.currentQuantity} ${prod.unit}`,
              variant: "destructive",
            });
            return item;
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  // Calculations
  const totalAmount = basket.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
  const totalCost = basket.reduce((sum, item) => sum + item.quantity * item.minPrice, 0);
  const profit = totalAmount - totalCost;
  const isSellingAtLoss = basket.some((item) => item.salePrice < item.minPrice);

  const isCredit = paymentType === "Nisyə";

  // Mutations
  const createSaleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Satış tamamlanmadı");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-sales"] });

      // Find active customer if existing selected
      const activeCustomer = activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId));

      // Construct a rich local snapshot of the sale object to pass to the receipt generator
      const saleObj = {
        id: data.id,
        saleDate: new Date().toISOString(),
        customerName: customerMode === "none" ? null : (customerMode === "existing" ? activeCustomer?.name : newCustomerName.trim()),
        customerPhone: customerMode === "existing" ? activeCustomer?.phone : newCustomerPhone.trim() || null,
        paymentType,
        paymentStatus: isCredit ? "credit" : "paid",
        creditDueDate: isCredit ? creditDueDate : null,
        notes: notes.trim() || null,
        totalAmount,
        totalPaid: isCredit ? 0 : totalAmount,
        remainingDebt: isCredit ? totalAmount : 0,
        items: basket.map((item) => ({
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice
        }))
      };

      setLastCreatedSale(saleObj);
      setShowSuccessModal(true);

      toast({
        title: isCredit ? "Nisyə satışı qeydə alındı" : "Satış tamamlandı",
        description: isCredit ? `Borc: ${totalAmount.toFixed(2)} ₼` : `Gəlir: ${totalAmount.toFixed(2)} ₼`,
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Satış tamamlanarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (basket.length === 0) {
      toast({ title: "Xəta!", description: "Səbət boşdur", variant: "destructive" });
      return;
    }

    if (isSellingAtLoss) {
      toast({
        title: "Xəta!",
        description: "Satış qiyməti maya qiymətindən (alış) aşağı ola bilməz!",
        variant: "destructive",
      });
      return;
    }

    if (isCredit) {
      if (customerMode === "none") {
        toast({ title: "Xəta!", description: "Nisyə üçün müştəri seçilməlidir", variant: "destructive" });
        return;
      }
      if (customerMode === "new" && !newCustomerName.trim()) {
        toast({ title: "Xəta!", description: "Müştəri adı daxil edilməlidir", variant: "destructive" });
        return;
      }
      if (!creditDueDate) {
        toast({ title: "Xəta!", description: "Nisyə müddəti (son tarix) daxil edilməlidir", variant: "destructive" });
        return;
      }
    }

    // Prepare Customer Data
    let customerId: number | null = null;
    let customerName: string | null = null;
    let customerPhone: string | null = null;
    let customerEmail: string | null = null;
    let customerAddress: string | null = null;

    if (customerMode === "existing" && selectedCustomerId) {
      const cust = activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId));
      if (cust) {
        customerId = cust.id;
        customerName = cust.name;
        customerPhone = cust.phone;
        customerEmail = cust.email;
        customerAddress = cust.address;
      }
    } else if (customerMode === "new") {
      customerName = newCustomerName.trim();
      customerPhone = newCustomerPhone.trim() || null;
      customerEmail = newCustomerEmail.trim() || null;
      customerAddress = newCustomerAddress.trim() || null;
    }

    const payload = {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      paymentType,
      creditDueDate: isCredit ? creditDueDate : null,
      notes: notes.trim() || null,
      totalAmount,
      totalCost,
      items: basket.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        salePrice: item.salePrice,
        purchasePrice: item.minPrice,
      })),
    };

    if (!isOnline) {
      try {
        const enrichedOfflineSale = saveOfflineSale(payload);
        
        // Enrich items with catalog properties for thermal prints
        enrichedOfflineSale.items = basket.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice,
          purchasePrice: item.minPrice,
        }));

        setLastCreatedSale(enrichedOfflineSale);
        setShowSuccessModal(true);

        toast({
          title: isCredit ? "Oflayn Nisyə satışı qeydə alındı" : "Oflayn Satış tamamlandı 🧾",
          description: `Satış yaddaşda saxlanıldı. İnternet bərpa olunduqda avtomatik buluda sinxronizasiya ediləcək.`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Xəta!",
          description: "Oflayn satışı qeydə alarkən xəta baş verdi.",
          variant: "destructive",
        });
      }
      return;
    }

    createSaleMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 animate-in fade-in-0">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">POS Terminal</h2>
        <p className="text-xs text-gray-400 mt-1">Sürətli satış, kassa və müştəri borclarının idarəedilməsi</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Side: Basket & Product Selection */}
        <div className="xl:col-span-2 space-y-6">
          {/* Product selector card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">Səbətə Məhsul Əlavə Et</h3>
            <div className="flex flex-col sm:flex-row gap-3 text-xs font-semibold">
              <div className="flex-1 w-full">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="">Məhsul seçin...</option>
                  {sellableProducts.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName} — Qalıq: {p.currentQuantity} {p.unit} (Maya: {p.lastPurchasePrice.toFixed(2)} ₼)
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-24">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Miqdar"
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>
              <button
                onClick={handleAddToBasket}
                className="w-full sm:w-auto px-5 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 transition-all"
              >
                <Plus className="w-4 h-4" /> Əlavə et
              </button>
            </div>
          </div>

          {/* Selected Basket Items Table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-sm">Seçilmiş Məhsullar</h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <ShoppingCart className="w-4 h-4" />
                <span>{basket.length} növ məhsul</span>
              </div>
            </div>

            {basket.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                Səbət boşdur. Kataloqdan məhsul seçib əlavə edin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-2">Məhsul</th>
                      <th className="py-3 px-2 text-right w-24">Miqdar</th>
                      <th className="py-3 px-2 text-right w-28">Satış Qiyməti (₼)</th>
                      <th className="py-3 px-2 text-right w-28">Toplam</th>
                      <th className="py-3 px-2 text-right w-20 text-green-600">Gəlir</th>
                      <th className="py-3 px-2 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {basket.map((item) => {
                      const isLoss = item.salePrice < item.minPrice;
                      const itemProfit = (item.salePrice - item.minPrice) * item.quantity;
                      return (
                        <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                          <td className="py-4 px-2">
                            <span className="font-bold block text-gray-900">{item.productName}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Alış Mayası: {item.minPrice.toFixed(2)} ₼ / {item.unit}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleUpdateBasketItem(item.productId, "quantity", e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex flex-col items-end">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.salePrice}
                                onChange={(e) => handleUpdateBasketItem(item.productId, "salePrice", e.target.value)}
                                className={`w-20 px-2 py-1 border rounded-lg text-right focus:outline-none focus:ring-1 ${
                                  isLoss
                                    ? "border-red-400 focus:ring-red-500 bg-red-50/50"
                                    : "border-gray-200 focus:ring-primary"
                                }`}
                              />
                              {isLoss && (
                                <span className="text-[9px] font-bold text-red-500 mt-1">
                                  Min: {item.minPrice.toFixed(2)} ₼
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right font-bold text-gray-900 font-mono">
                            {(item.quantity * item.salePrice).toFixed(2)} ₼
                          </td>
                          <td className={`py-4 px-2 text-right font-bold font-mono ${itemProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {itemProfit >= 0 ? "+" : ""}
                            {itemProfit.toFixed(2)}
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleRemoveFromBasket(item.productId)}
                              className="text-gray-400 hover:text-red-500 cursor-pointer transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Customer & Checkout Actions */}
        <div className="space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">Müştəri Seçimi</h3>
            <div className="flex flex-col xs:flex-row gap-2 text-xs font-semibold mb-4">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("none");
                  setSelectedCustomerId("");
                }}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "none" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Yoxdur (Anonim)
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "existing" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Mövcud Müştəri
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "new" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Yeni Müştəri
              </button>
            </div>

            {/* Existing Customer Dropdown */}
            {customerMode === "existing" && (
              <div className="space-y-2 text-xs font-semibold animate-in slide-in-from-top-2">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Müştəri seçin</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="">Müştəri seçin...</option>
                  {activeCustomers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* New Customer Form */}
            {customerMode === "new" && (
              <div className="space-y-3 text-xs font-semibold animate-in slide-in-from-top-2">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ad Soyad *</label>
                  <input
                    type="text"
                    placeholder="Məs. Əli Məmmədov"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telefon</label>
                    <input
                      type="text"
                      placeholder="055-123-4567"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">E-poçt (Email)</label>
                    <input
                      type="email"
                      placeholder="ad@mail.com"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ünvan</label>
                  <input
                    type="text"
                    placeholder="Məs. Yasamal, Şərifzadə küç. 45"
                    value={newCustomerAddress}
                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Checkout & Totals Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">Ödəniş və Yekun</h3>

            {/* Totals panel */}
            <div className="space-y-2 border-b border-gray-100 pb-4 mb-4 text-xs font-medium text-gray-500">
              <div className="flex justify-between">
                <span>Cəmi məbləğ</span>
                <span className="font-bold text-gray-900 font-mono text-sm">{totalAmount.toFixed(2)} ₼</span>
              </div>
              {isAdmin && (
                <>
                  <div className="flex justify-between">
                    <span>Məhsul mayası</span>
                    <span className="font-mono">{totalCost.toFixed(2)} ₼</span>
                  </div>
                  <div className="flex justify-between items-center text-green-600 bg-green-50/50 p-2.5 rounded-xl border border-green-100/50 glass animate-in fade-in">
                    <span className="font-semibold">Təxmini Mənfəət</span>
                    <span className="font-black font-mono text-sm">+{profit.toFixed(2)} ₼</span>
                  </div>
                </>
              )}
            </div>

            {/* Payment Type */}
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ödəniş Üsulu</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="Nəğd">Nəğd</option>
                  <option value="Kart">Kart</option>
                  <option value="Kart2Kart">Kart2Kart</option>
                  <option value="Nisyə">Nisyə (Borc)</option>
                </select>
              </div>

              {/* Due date if credit sale */}
              {isCredit && (
                <div className="space-y-1.5 border border-amber-100 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
                  <label className="text-amber-700 uppercase tracking-wider block text-[10px]">
                    Borcun Ödənilmə Tarixi *
                  </label>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white cursor-pointer"
                  />
                  <p className="text-[10px] text-amber-600/80 leading-normal font-medium mt-1">
                    Satış nisyəyə verilir. Müştərinin cari borcuna əlavə olunacaq.
                  </p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Satış qeydi</label>
                <input
                  type="text"
                  placeholder="Əlavə məlumat (ixtiyari)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={basket.length === 0 || createSaleMutation.isPending || isSellingAtLoss}
                className={`w-full py-3 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md transition-all ${
                  isCredit
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10"
                    : "bg-primary hover:bg-primary/90 shadow-primary/10"
                }`}
              >
                <CheckCircle className="w-4 h-4" />{" "}
                {isCredit ? "Nisyə Satış Qeyd Et" : "Satışı Tamamla (Qaimə)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && lastCreatedSale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-300">
          <div className="bg-white border border-gray-100 p-8 rounded-3xl max-w-md w-full shadow-2xl relative text-center space-y-6 animate-in zoom-in-95 duration-300">
            
            {/* Success Icon */}
            <div className="mx-auto size-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-100 shadow-sm">
              <CheckCircle className="w-8 h-8" />
            </div>

            {/* Title / Header */}
            <div className="space-y-1">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Satış Uğurla Tamamlandı! 🎉</h3>
              <p className="text-xs text-gray-400">
                Qaimə #{lastCreatedSale.id.toString().padStart(5, "0")} yaradıldı
              </p>
            </div>

            {/* Məbləğ Info Box */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center space-y-0.5 font-semibold">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Ümumi Məbləğ</span>
              <span className="text-2xl font-black text-gray-950 font-mono">{lastCreatedSale.totalAmount.toFixed(2)} ₼</span>
              <span className="text-[10px] text-gray-500">Ödəniş Üsulu: {lastCreatedSale.paymentType}</span>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  try {
                    const success = await printReceipt(lastCreatedSale, activeSettings);
                    if (success) {
                      toast({
                        title: "Çap qoşuldu",
                        description: "Termal qəbz uğurla çapa göndərildi.",
                        variant: "success",
                      });
                    } else {
                      toast({
                        title: "Xəta!",
                        description: "Çap əməliyyatı brauzer və ya QZ Tray vasitəsilə tamamlanmadı.",
                        variant: "destructive",
                      });
                    }
                  } catch (e) {
                    toast({
                      title: "Xəta!",
                      description: "Qəbz çapında xəta baş verdi.",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full py-3 bg-gray-950 hover:bg-black text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition-all hover-elevate font-semibold"
              >
                <Receipt className="w-4 h-4" /> Termal Qəbzi Çap Et
              </button>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  onClick={() => {
                    if (!isOnline) {
                      toast({
                        title: "Oflayn Rejim Məhdudiyyəti 🔒",
                        description: "Oflayn satışların ətraflı fakturasına yalnız sinxronizasiyadan sonra (onlayn rejimdə) baxıla bilər.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const sId = lastCreatedSale.id;
                    handleResetPOS();
                    setLocation(`/satislar/${sId}`);
                  }}
                  className="py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 animate-pulse"
                >
                  Qaiməyə Bax
                </button>
                <button
                  onClick={handleResetPOS}
                  className="py-2.5 bg-primary text-white rounded-xl cursor-pointer hover:bg-primary/90 shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5"
                >
                  Yeni Satış
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
