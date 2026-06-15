import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/Toast.tsx";
import {
  RotateCw,
  Plus,
  Search,
  Truck,
  Calendar,
  DollarSign,
  FileText,
  Check,
  Trash2,
  Eye,
  Info,
  X,
  PlusCircle,
  AlertTriangle,
} from "lucide-react";

export default function VendorReturns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"history" | "new">("history");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  // New Return Form States
  const [vendorId, setVendorId] = useState("");
  const [paymentType, setPaymentType] = useState("Borcdan Silinmə");
  const [notes, setNotes] = useState("");
  const [returnItems, setReturnItems] = useState<any[]>([]);

  // Search product inside new return
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductForReturn, setSelectedProductForReturn] = useState<any>(null);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  // Queries
  const { data: vendors } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: returns, isLoading: isReturnsLoading } = useQuery<any[]>({
    queryKey: ["/api/vendor-returns"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-returns");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/stock/levels"],
    queryFn: async () => {
      const res = await fetch("/api/stock/levels");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: stockEntries } = useQuery<any[]>({
    queryKey: ["/api/stock/entries"],
    queryFn: async () => {
      const res = await fetch("/api/stock/entries");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Create Return Mutation
  const createReturnMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/vendor-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Geri Qaytarış zamanı xəta baş verdi");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Uğurlu əməliyyat!",
        description: "Tədarükçüyə geri qaytarış sənədi uğurla yaradıldı.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/entries"] });
      
      // Reset form
      setVendorId("");
      setPaymentType("Borcdan Silinmə");
      setNotes("");
      setReturnItems([]);
      setActiveTab("history");
    },
    onError: (error: any) => {
      toast({
        title: "Xəta!",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter stock entries for selected vendor
  const vendorEntries = stockEntries?.filter((e) => e.vendorId === parseInt(vendorId)) || [];

  // Filter products that belong to the selected vendor's entries
  const vendorProducts = products?.filter((p) =>
    vendorEntries.some((entry) => entry.productId === p.productId)
  ) || [];

  const handleAddProduct = () => {
    if (!selectedProductForReturn) {
      toast({
        title: "Xəta!",
        description: "Məhsul seçilməlidir.",
        variant: "destructive",
      });
      return;
    }

    const qty = parseFloat(returnQty);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Xəta!",
        description: "Düzgün miqdar daxil edin.",
        variant: "destructive",
      });
      return;
    }

    // Check stock limit
    if (qty > selectedProductForReturn.currentQuantity) {
      toast({
        title: "Xəta!",
        description: `Qaytarılan miqdar anbarda olan qalıqdan (${selectedProductForReturn.currentQuantity} ${selectedProductForReturn.unit}) çox ola bilməz.`,
        variant: "destructive",
      });
      return;
    }

    let purchasePrice = selectedProductForReturn.lastPurchasePrice || 0;
    let entryLabel = "Ümumi Stok";

    if (selectedEntryId) {
      const entry = vendorEntries.find((e) => e.id === parseInt(selectedEntryId));
      if (entry) {
        purchasePrice = entry.purchasePrice;
        entryLabel = `Mədaxil №${entry.id} (Alış: ${purchasePrice} ₼)`;

        // Validate against batch quantity
        const alreadyReturnedInItems = returnItems
          .filter((item) => item.stockEntryId === entry.id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (qty + alreadyReturnedInItems > entry.quantity) {
          toast({
            title: "Xəta!",
            description: `Seçilmiş mədaxil partiyası üzrə qaytarıla biləcək miqdar aşılır (Mədaxil miqdarı: ${entry.quantity}).`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Check if item already exists in return list
    const existingIdx = returnItems.findIndex(
      (item) =>
        item.productId === selectedProductForReturn.productId &&
        item.stockEntryId === (selectedEntryId ? parseInt(selectedEntryId) : null)
    );

    if (existingIdx !== -1) {
      const updated = [...returnItems];
      updated[existingIdx].quantity += qty;
      setReturnItems(updated);
    } else {
      setReturnItems([
        ...returnItems,
        {
          productId: selectedProductForReturn.productId,
          productName: selectedProductForReturn.productName,
          unit: selectedProductForReturn.unit,
          stockEntryId: selectedEntryId ? parseInt(selectedEntryId) : null,
          entryLabel,
          quantity: qty,
          purchasePrice,
          notes: itemNotes,
        },
      ]);
    }

    // Reset inputs
    setSelectedProductForReturn(null);
    setSelectedEntryId("");
    setReturnQty("");
    setItemNotes("");
    setProductSearch("");
  };

  const handleRemoveItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const handleSubmitReturn = () => {
    if (!vendorId) {
      toast({
        title: "Xəta!",
        description: "Zəhmət olmasa tədarükçü seçin.",
        variant: "destructive",
      });
      return;
    }
    if (returnItems.length === 0) {
      toast({
        title: "Xəta!",
        description: "Geri qaytarmaq üçün ən azı bir məhsul əlavə etməlisiniz.",
        variant: "destructive",
      });
      return;
    }

    createReturnMutation.mutate({
      vendorId: parseInt(vendorId),
      paymentType,
      notes,
      items: returnItems.map((item) => ({
        productId: item.productId,
        stockEntryId: item.stockEntryId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        notes: item.notes,
      })),
    });
  };

  const totalReturnCost = returnItems.reduce(
    (sum, item) => sum + item.quantity * item.purchasePrice,
    0
  );

  const filteredReturns = returns?.filter((r) => {
    const vName = r.vendor?.name || "";
    const notesMatch = r.notes || "";
    return (
      vName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notesMatch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toString().includes(searchTerm)
    );
  }) || [];

  return (
    <div className="space-y-6 animate-in fade-in-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Tədarükçüyə Qaytarışlar</h2>
          <p className="text-xs text-gray-400 mt-1">
            Tədarükçülərdən alınmış yararsız və ya artıq malların geri qaytarılması və borcların silinməsi uçotu
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              activeTab === "history"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Qaytarış Tarixçəsi
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "new"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Yeni Qaytarış
          </button>
        </div>
      </div>

      {activeTab === "history" ? (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tədarükçü adı və ya qeyd üzrə axtar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium placeholder-gray-400"
              />
            </div>
          </div>

          {/* Return History Table */}
          {isReturnsLoading ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-xs text-gray-400">
              Yüklənir...
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-gray-50 text-gray-300 rounded-full">
                <RotateCw className="w-8 h-8" />
              </div>
              <span>Heç bir tədarükçü qaytarışı tapılmadı.</span>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="p-4">Qaytarış №</th>
                      <th className="p-4">Tarix</th>
                      <th className="p-4">Tədarükçü</th>
                      <th className="p-4">Üsul</th>
                      <th className="p-4 text-right">Ümumi Məbləğ</th>
                      <th className="p-4">Qeydlər</th>
                      <th className="p-4 text-center">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReturns.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-gray-900">
                          #{r.id.toString().padStart(5, "0")}
                        </td>
                        <td className="p-4 text-gray-500 font-medium">
                          {new Date(r.returnDate).toLocaleDateString("az-AZ")} |{" "}
                          {new Date(r.returnDate).toLocaleTimeString("az-AZ", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-4 font-bold text-gray-900">
                          <div>{r.vendor?.name || `ID: ${r.vendorId}`}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-1.5 space-y-1">
                            {(r.items || []).map((item: any) => (
                              <div key={item.id} className="flex items-center gap-1.5">
                                <span className="text-gray-500">• {item.product?.name || item.productName || `Məhsul (ID: ${item.productId})`}:</span>
                                <span className="text-gray-800 font-bold">{item.quantity} {item.product?.unit || "ədəd"}</span>
                                <span className="text-gray-400 font-mono">({parseFloat(item.purchasePrice || 0).toFixed(2)} ₼)</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              r.paymentType === "Borcdan Silinmə"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {r.paymentType}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-gray-900 font-mono">
                          {parseFloat(r.totalAmount || 0).toFixed(2)} ₼
                        </td>
                        <td className="p-4 text-gray-400 italic max-w-xs truncate">
                          {r.notes || "—"}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedReturn(r)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" /> Bax
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Create New Return Wizard */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Return Form Card */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-6">
            <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" /> Qaytarış Məlumatları
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Select Vendor */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                  Tədarükçü (Vendor)
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    setReturnItems([]);
                    setSelectedProductForReturn(null);
                  }}
                  className="w-full p-3 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                >
                  <option value="">Seçin...</option>
                  {vendors?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Borc: {parseFloat(v.balance || 0).toFixed(2)} ₼)
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Return Payment Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                  Kompensasiya Üsulu
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                >
                  <option value="Borcdan Silinmə">Borcdan Silinmə (Tədarükçü borcundan çıx)</option>
                  <option value="Nəğd">Nəğd (Kassaya mədaxil kimi al)</option>
                  <option value="Kart">Kart (Hesaba geri ödəniş)</option>
                  <option value="Köçürmə">Bank köçürməsi</option>
                </select>
              </div>
            </div>

            {/* Return Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                Qaytarış Qeydi (Sənəd Səbəbi)
              </label>
              <textarea
                rows={2}
                placeholder="Bu sənəd üzrə ümumi qeydlər, yararsız mal səbəbləri və s."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
              />
            </div>

            {/* Search & Add Product Section */}
            {vendorId ? (
              <div className="border border-gray-100 bg-gray-50/50 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-gray-800">Məhsul Əlavə Et</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Select Product */}
                  <div className="md:col-span-2 relative">
                    <label className="block text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                      Məhsul
                    </label>
                    <select
                      value={selectedProductForReturn?.productId || ""}
                      onChange={(e) => {
                        const prod = vendorProducts.find((p) => String(p.productId) === e.target.value);
                        setSelectedProductForReturn(prod || null);
                        setSelectedEntryId("");
                      }}
                      className="w-full p-2.5 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                    >
                      <option value="">Məhsul Seçin...</option>
                      {vendorProducts.map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.productName} (Anbarda: {p.currentQuantity} {p.unit} | Son Alış: {Number(p.lastPurchasePrice || 0).toFixed(2)} ₼)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Batch / Stock Entry */}
                  {selectedProductForReturn && (
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                        Mədaxil Partiyası (Batch)
                      </label>
                      <select
                        value={selectedEntryId}
                        onChange={(e) => setSelectedEntryId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                      >
                        <option value="">Fərq etməz (FIFO Alış Qiyməti)</option>
                        {vendorEntries
                          .filter((e) => e.productId === selectedProductForReturn.productId)
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              Mədaxil №{e.id} ({e.quantity} {selectedProductForReturn.unit} | Alış: {e.purchasePrice} ₼)
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {selectedProductForReturn && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    {/* Return Quantity */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                        Qaytarılan Miqdar
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="0.00"
                          value={returnQty}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
                            setReturnQty(sanitized);
                          }}
                          className="w-full p-2.5 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                          {selectedProductForReturn.unit}
                        </span>
                      </div>
                      {(() => {
                        const purchasePrice = selectedEntryId
                          ? (vendorEntries.find((e) => e.id === parseInt(selectedEntryId))?.purchasePrice || selectedProductForReturn.lastPurchasePrice || 0)
                          : (selectedProductForReturn.lastPurchasePrice || 0);
                        const qty = parseFloat(returnQty) || 0;
                        return (
                          <div className="text-[10px] text-gray-400 mt-1 flex justify-between font-bold">
                            <span>Alış Qiyməti: {purchasePrice.toFixed(2)} ₼</span>
                            {qty > 0 && (
                              <span className="text-amber-700 font-extrabold animate-in fade-in">
                                Cəmi: {(qty * purchasePrice).toFixed(2)} ₼
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Item Notes */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                        Səbəb / Qeyd
                      </label>
                      <input
                        type="text"
                        placeholder="Zay məhsul, defekt və s."
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:border-primary transition-all font-medium"
                      />
                    </div>

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" /> Əlavə et
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex gap-2 items-start">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Qaytarışa məhsul əlavə etmək üçün əvvəlcə tədarükçü seçin.</span>
              </div>
            )}

            {/* Added Return Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">Qaytarılacaq Məhsulların Siyahısı</h4>
              {returnItems.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400 rounded-xl">
                  Siyahı boşdur. Məhsul seçib siyahıya əlavə edin.
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="p-3">Məhsul</th>
                        <th className="p-3">Partiya / Mənbə</th>
                        <th className="p-3 text-right">Miqdar</th>
                        <th className="p-3 text-right">Alış Qiyməti</th>
                        <th className="p-3 text-right">Cəmi</th>
                        <th className="p-3">Məhsul Qeydi</th>
                        <th className="p-3 text-center">Sil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {returnItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/20">
                          <td className="p-3 font-bold text-gray-900">{item.productName}</td>
                          <td className="p-3 text-gray-500 font-medium">{item.entryLabel}</td>
                          <td className="p-3 text-right font-bold text-gray-900">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-gray-700">
                            {item.purchasePrice.toFixed(2)} ₼
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">
                            {(item.quantity * item.purchasePrice).toFixed(2)} ₼
                          </td>
                          <td className="p-3 text-gray-400 italic">{item.notes || "—"}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Return Summary & Actions Sidebar */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-6">
            <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-3">
              Qaytarış Xülasəsi
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Tədarükçü:</span>
                <span className="font-bold text-gray-800">
                  {vendors?.find((v) => String(v.id) === vendorId)?.name || "Seçilməyib"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Məhsul Sayı:</span>
                <span className="font-bold text-gray-800">{returnItems.length} növ</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Ödəniş növü:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                  {paymentType}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                  Cəmi Qaytarış:
                </span>
                <span className="text-xl font-black text-gray-950 font-mono">
                  {totalReturnCost.toFixed(2)} ₼
                </span>
              </div>
            </div>

            {paymentType === "Borcdan Silinmə" && vendorId && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-800 flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Bu əməliyyat tədarükçüyə olan borcu <strong>{totalReturnCost.toFixed(2)} ₼</strong> azaltmaqla borc balansını düzəldəcəkdir.
                </span>
              </div>
            )}

            <button
              onClick={handleSubmitReturn}
              disabled={createReturnMutation.isPending || returnItems.length === 0}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all hover-elevate disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createReturnMutation.isPending ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Qaytarışı Təsdiqlə
            </button>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-100 animate-in fade-in-0 duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 m-4">
            {/* Modal Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-gray-900">
                  Tədarükçü Qaytarışı №{selectedReturn.id.toString().padStart(5, "0")}
                </h3>
                <span className="text-[10px] text-gray-400 font-medium">
                  Tarix: {new Date(selectedReturn.returnDate).toLocaleDateString("az-AZ")} |{" "}
                  {new Date(selectedReturn.returnDate).toLocaleTimeString("az-AZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6 text-xs border-b border-gray-100 pb-4">
                <div>
                  <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-1">
                    Tədarükçü
                  </span>
                  <p className="font-bold text-gray-900 text-sm">
                    {selectedReturn.vendor?.name || `ID: ${selectedReturn.vendorId}`}
                  </p>
                  {selectedReturn.vendor?.phone && (
                    <p className="text-gray-500 mt-0.5">{selectedReturn.vendor.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-1">
                    Ödəniş / Kompensasiya
                  </span>
                  <p className="font-bold text-gray-900">{selectedReturn.paymentType}</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Mallar anbardan silinib</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-800">Qaytarılan Məhsullar</h4>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="p-3">Məhsul</th>
                        <th className="p-3 text-right">Miqdar</th>
                        <th className="p-3 text-right">Alış Qiyməti</th>
                        <th className="p-3 text-right">Cəmi</th>
                        <th className="p-3">Qeyd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedReturn.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="p-3 font-bold text-gray-900">
                            {item.product?.name || item.productName || `ID: ${item.productId}`}
                          </td>
                          <td className="p-3 text-right font-bold text-gray-900">
                            {item.quantity} {item.product?.unit || "ədəd"}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-gray-700">
                            {parseFloat(item.purchasePrice || 0).toFixed(2)} ₼
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">
                            {(parseFloat(item.quantity) * parseFloat(item.purchasePrice || 0)).toFixed(2)} ₼
                          </td>
                          <td className="p-3 text-gray-400 italic">{item.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Note */}
              {selectedReturn.notes && (
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs text-gray-600">
                  <strong className="block text-gray-800 text-[10px] uppercase font-bold tracking-wider mb-1">
                    Sənəd Qeydi:
                  </strong>
                  {selectedReturn.notes}
                </div>
              )}

              {/* Total Summary */}
              <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Cəmi Məbləğ:
                </span>
                <span className="text-xl font-black text-gray-950 font-mono">
                  {parseFloat(selectedReturn.totalAmount || 0).toFixed(2)} ₼
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
