import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, PlusCircle, CheckCircle, Info, Lock, Edit2, X } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { sanitizeQtyInput } from "../lib/utils.ts";

const emptyEntry = {
  productId: "",
  quantity: "",
  purchasePrice: "",
  supplier: "",
  notes: "",
  paymentType: "Nəğd",
  creditDueDate: "",
  vendorId: "",
};

const paymentTypes = ["Nəğd", "Kart", "Kart2Kart", "Köçürmə", "Nisyə"];

const paymentBadges: Record<string, string> = {
  Nəğd: "bg-green-50 text-green-700 border-green-100",
  Kart: "bg-blue-50 text-blue-700 border-blue-100",
  Kart2Kart: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Köçürmə: "bg-purple-50 text-purple-700 border-purple-100",
  Nisyə: "bg-amber-50 text-amber-700 border-amber-100",
};

export default function StockIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const [formData, setFormData] = useState(emptyEntry);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [serialNumbersText, setSerialNumbersText] = useState("");

  // Edit Modal States
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [adminPassword, setAdminPassword] = useState("");

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/stock/entries/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Düzəliş qeydə alınmadı");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({
        title: "Düzəliş edildi!",
        description: "Mədaxil məlumatları uğurla yeniləndi.",
        variant: "success",
      });
      setIsEditModalOpen(false);
      setEditingEntry(null);
      setEditFormData(null);
      setAdminPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Xəta!",
        description: error.message || "Mədaxil qeydə alınarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // Queries
  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: vendors } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: entries, isLoading: isEntriesLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/entries"],
    queryFn: async () => {
      const res = await fetch("/api/stock/entries");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  useEffect(() => {
    if (formData.productId && products) {
      const selected = products.find((p) => String(p.id) === formData.productId);
      if (selected) {
        setProductSearch(selected.name);
      }
    } else {
      setProductSearch("");
    }
  }, [formData.productId, products]);

  const filteredProducts = (products || []).filter((p) => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  const filteredEntries = (entries || []).filter((entry) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.productName?.toLowerCase().includes(q) ||
      (entry.supplier && entry.supplier.toLowerCase().includes(q)) ||
      (entry.notes && entry.notes.toLowerCase().includes(q)) ||
      (entry.paymentType && entry.paymentType.toLowerCase().includes(q))
    );
  });

  // Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/stock/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Mədaxil alınmadı");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({
        title: "Daxil edildi!",
        description: `Məhsul anbara daxil edildi (${formData.paymentType})`,
        variant: "success",
      });
      setIsSuccess(true);
      setFormData(emptyEntry);
      setProductSearch("");
      setSerialNumbersText("");
      setTimeout(() => setIsSuccess(false), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Xəta!",
        description: error.message || "Mədaxil qeydə alınarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const isCredit = formData.paymentType === "Nisyə";
  const calculatedTotal = parseFloat(formData.quantity || "0") * parseFloat(formData.purchasePrice || "0");

  const selectedProduct = products?.find((p) => String(p.id) === formData.productId);
  const isSerialized = selectedProduct?.trackingType === "serialized";

  const parsedSerials = serialNumbersText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || !formData.quantity || !formData.purchasePrice) {
      toast({ title: "Xəta!", description: "Məcburi sahələri doldurun.", variant: "destructive" });
      return;
    }

    if (isCredit && !formData.creditDueDate) {
      toast({ title: "Xəta!", description: "Nisyə üçün ödəmə tarixi daxil edilməlidir.", variant: "destructive" });
      return;
    }

    if (isSerialized) {
      if (parsedSerials.length !== parseInt(formData.quantity || "0")) {
        toast({
          title: "Xəta!",
          description: `Məhsul serial nömrəlidir. Daxil edilən serial sayı (${parsedSerials.length}) məhsul miqdarı (${formData.quantity}) ilə bərabər olmalıdır.`,
          variant: "destructive"
        });
        return;
      }
      // Check for local duplicates in user input
      const uniqueSerialsInput = new Set(parsedSerials.map(s => s.toUpperCase()));
      if (uniqueSerialsInput.size !== parsedSerials.length) {
        toast({ title: "Xəta!", description: "Daxil etdiyiniz serial nömrələrində təkrarlanma (dublikat) var.", variant: "destructive" });
        return;
      }
    }

    const payload = {
      productId: parseInt(formData.productId),
      quantity: parseFloat(formData.quantity),
      purchasePrice: parseFloat(formData.purchasePrice),
      supplier: formData.supplier || null,
      notes: formData.notes || null,
      paymentType: formData.paymentType,
      creditDueDate: isCredit ? formData.creditDueDate : null,
      vendorId: formData.vendorId ? parseInt(formData.vendorId) : null,
      serialNumbers: isSerialized ? parsedSerials : null,
    };

    createMutation.mutate(payload);
  };

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
      {/* Back button & Header */}
      <div className="flex items-center gap-3">
        <Link href="/anbar">
          <button className="p-2 border border-gray-200 hover:border-gray-300 text-gray-500 rounded-xl cursor-pointer bg-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Anbara Mədaxil</h2>
          <p className="text-xs text-gray-400 mt-1">Anbara yeni məhsul daxil etmək üçün form</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Restocking Entry Form */}
        <div className="lg:col-span-1 bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
          <h3 className="font-extrabold text-gray-900 text-sm mb-4">Mal Daxil Et</h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            {/* Product selection */}
            <div className="space-y-1.5 relative">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Məhsul adı və ya barkod..."
                  value={productSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProductSearch(val);
                    if (!val.trim()) {
                      setFormData((prev) => ({ ...prev, productId: "" }));
                    }
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
                {showProductDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">Məhsul tapılmadı</div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, productId: String(p.id) }));
                            setProductSearch(p.name);
                            setShowProductDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-all font-semibold flex justify-between items-center border-b border-gray-50 last:border-b-0"
                        >
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-bold">{p.name}</span>
                            {p.barcode && <span className="text-[10px] text-gray-400 font-mono">Barkod: {p.barcode}</span>}
                          </div>
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-bold shrink-0">{p.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quantity and Purchase Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Miqdar *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.quantity}
                  onChange={(e) => {
                    const sanitized = sanitizeQtyInput(e.target.value);
                    setFormData((prev) => ({ ...prev, quantity: sanitized }));
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Alış Qiyməti (₼) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
              </div>
            </div>

            {/* Live Total Value Calculation */}
            {calculatedTotal > 0 && (
              <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between">
                <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Ümumi Dəyəri:</span>
                <span className="font-bold text-primary font-mono text-base">{calculatedTotal.toFixed(2)} ₼</span>
              </div>
            )}

            {/* Serial Numbers (Only if product is serialized) */}
            {isSerialized && (
              <div className="space-y-1.5 border border-amber-200 bg-amber-50/15 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
                <label className="text-amber-800 uppercase tracking-wider block text-[10px] font-bold">
                  Serial Nömrələr / IMEI-lər *
                </label>
                <textarea
                  placeholder="Hər sətirdə bir IMEI / Serial kodu yazın və ya skan edin..."
                  value={serialNumbersText}
                  onChange={(e) => setSerialNumbersText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono text-xs h-24 resize-none"
                  required={isSerialized}
                />
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 mt-1">
                  <span>Tələb olunan: {parseInt(formData.quantity || "0")} ədəd</span>
                  <span className={parsedSerials.length === parseInt(formData.quantity || "0") ? "text-green-600" : "text-red-500"}>
                    Daxil edilən: {parsedSerials.length} ədəd
                  </span>
                </div>
              </div>
            )}

            {/* Payment Type */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ödəniş Üsulu *</label>
              <select
                value={formData.paymentType}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentType: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
              >
                {paymentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date for Credit Restocking */}
            {isCredit && (
              <div className="space-y-1.5 border border-amber-200/60 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
                <label className="text-amber-700 uppercase tracking-wider block text-[10px]">
                  Nisyə Ödəmə Tarixi *
                </label>
                <input
                  type="date"
                  value={formData.creditDueDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, creditDueDate: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white ${
                    formData.creditDueDate ? "border-gray-200" : "border-amber-400"
                  }`}
                  required={isCredit}
                />
                <p className="text-[10px] text-amber-600/80 leading-normal font-medium mt-1.5">
                  Bu mal nisyəyə alınır — {!formData.vendorId && "DİQQƏT: Borcun topdansatış kartına işlənməsi üçün aşağıdan qeydiyyatlı tədarükçü seçməyiniz tövsiyə olunur."}
                </p>
              </div>
            )}

            {/* Supplier / Vendor Selector */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qeydiyyatlı Tədarükçü (Ledger)</label>
              <select
                value={formData.vendorId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = vendors?.find((v) => String(v.id) === val);
                  setFormData((prev) => ({
                    ...prev,
                    vendorId: val,
                    supplier: found ? found.name : "",
                  }));
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
              >
                <option value="">Sərbəst / Yoxdur</option>
                {vendors?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.phone || "Telefon yoxdur"})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Supplier Text Input if free-form or to show the selected name */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Tədarükçü Adı (Sərbəst Yazı)</label>
              <input
                type="text"
                placeholder="Şirkət / şəxs adı (ixtiyari)"
                value={formData.supplier}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qeyd</label>
              <input
                type="text"
                placeholder="Əlavə məlumat (ixtiyari)"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md shadow-primary/10 transition-all"
            >
              {isSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Daxil edildi!
                </>
              ) : (
                "Anbara Daxil Et"
              )}
            </button>
          </form>
        </div>

        {/* Recent Restockings Table */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-50">
            <h3 className="font-extrabold text-gray-900 text-sm">Son Mədaxillər</h3>
            <input
              type="text"
              placeholder="Mədaxil axtar (məhsul, tədarükçü...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 w-full sm:w-60"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-2">Məhsul</th>
                  <th className="py-3 px-2 text-right">Miqdar</th>
                  <th className="py-3 px-2 text-right">Alış ₼</th>
                  <th className="py-3 px-2 text-center">Ödəniş</th>
                  <th className="py-3 px-2 text-right">Tarix</th>
                  <th className="py-3 px-2 text-center pr-4">Düzəliş</th>
                </tr>
              </thead>
              <tbody>
                {isEntriesLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                      Yüklənir...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                      {searchQuery ? "Axtarışa uyğun mədaxil tapılmadı." : "Hələ mədaxil qeydə alınmayıb."}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                      <td className="py-3 px-2 font-bold text-gray-900">{entry.productName}</td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-700 font-mono">
                        {entry.quantity}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-gray-950 font-mono">
                        {entry.purchasePrice.toFixed(2)} ₼
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold ${paymentBadges[entry.paymentType] || "bg-gray-50 text-gray-500"}`}>
                          {entry.paymentType}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400">
                        {new Date(entry.entryDate).toLocaleDateString("az-AZ")}
                      </td>
                      <td className="py-3 px-2 text-center pr-4">
                        <button
                          onClick={() => {
                            setEditingEntry(entry);
                            setEditFormData({
                              id: entry.id,
                              productId: String(entry.productId),
                              quantity: String(entry.quantity),
                              purchasePrice: String(entry.purchasePrice),
                              paymentType: entry.paymentType,
                              creditDueDate: entry.creditDueDate || "",
                              supplier: entry.supplier || "",
                              notes: entry.notes || "",
                              vendorId: entry.vendorId ? String(entry.vendorId) : "",
                            });
                            setAdminPassword("");
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-primary rounded-lg cursor-pointer transition-all inline-flex items-center justify-center"
                          title="Düzəliş et"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Restocking Modal */}
      {isEditModalOpen && editingEntry && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden glass-card space-y-4 animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-blue-500"></div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
              <div>
                <h3 className="text-sm font-black text-gray-900">Mədaxil Düzəlişi №{editingEntry.id}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Admin şifrəsi ilə redaktə edin</p>
              </div>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingEntry(null);
                  setEditFormData(null);
                  setAdminPassword("");
                }}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editFormData.quantity || !editFormData.purchasePrice) {
                  toast({ title: "Xəta!", description: "Məcburi sahələri doldurun.", variant: "destructive" });
                  return;
                }
                const isEditCredit = editFormData.paymentType === "Nisyə";
                if (isEditCredit && !editFormData.creditDueDate) {
                  toast({ title: "Xəta!", description: "Nisyə üçün ödəmə tarixi daxil edilməlidir.", variant: "destructive" });
                  return;
                }
                if (!adminPassword.trim()) {
                  toast({ title: "Xəta!", description: "Təsdiq üçün admin şifrəsini yazın.", variant: "destructive" });
                  return;
                }

                const payload = {
                  id: editFormData.id,
                  quantity: parseFloat(editFormData.quantity),
                  purchasePrice: parseFloat(editFormData.purchasePrice),
                  paymentType: editFormData.paymentType,
                  creditDueDate: isEditCredit ? editFormData.creditDueDate : null,
                  supplier: editFormData.supplier || null,
                  notes: editFormData.notes || null,
                  vendorId: editFormData.vendorId ? parseInt(editFormData.vendorId) : null,
                  adminPassword: adminPassword.trim(),
                };

                updateMutation.mutate(payload);
              }}
              className="space-y-4 text-xs font-semibold"
            >
              {/* Product Info (Read-Only) */}
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Məhsul</label>
                <input
                  type="text"
                  value={editingEntry.productName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed font-bold"
                />
              </div>

              {/* Quantity & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Miqdar *</label>
                  {products?.find(p => String(p.id) === editFormData.productId)?.trackingType === "serialized" ? (
                    <div>
                      <input
                        type="number"
                        value={editFormData.quantity}
                        disabled
                        className="w-full px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed font-mono"
                      />
                      <span className="text-[9px] text-amber-600 block mt-0.5 leading-tight">
                        Serial nömrəli məhsul miqdarı dəyişdirilə bilməz.
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editFormData.quantity}
                      onChange={(e) => {
                        const sanitized = sanitizeQtyInput(e.target.value);
                        setEditFormData((prev: any) => ({ ...prev, quantity: sanitized }));
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      required
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Alış Qiyməti (₼) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editFormData.purchasePrice}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, purchasePrice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    required
                  />
                </div>
              </div>

              {/* Total display */}
              {parseFloat(editFormData.quantity || "0") * parseFloat(editFormData.purchasePrice || "0") > 0 && (
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Yeni Ümumi Dəyəri:</span>
                  <span className="font-bold text-gray-900 font-mono">
                    {(parseFloat(editFormData.quantity || "0") * parseFloat(editFormData.purchasePrice || "0")).toFixed(2)} ₼
                  </span>
                </div>
              )}

              {/* Payment Type */}
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Ödəniş Üsulu *</label>
                <select
                  value={editFormData.paymentType}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, paymentType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white cursor-pointer"
                >
                  {paymentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date for Credit */}
              {editFormData.paymentType === "Nisyə" && (
                <div className="space-y-1 border border-amber-100 bg-amber-50/20 p-2.5 rounded-xl">
                  <label className="text-amber-700 uppercase tracking-wider block text-[9px]">
                    Nisyə Ödəmə Tarixi *
                  </label>
                  <input
                    type="date"
                    value={editFormData.creditDueDate}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, creditDueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    required
                  />
                </div>
              )}

              {/* Registered Vendor */}
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Qeydiyyatlı Tədarükçü</label>
                <select
                  value={editFormData.vendorId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = vendors?.find((v) => String(v.id) === val);
                    setEditFormData((prev: any) => ({
                      ...prev,
                      vendorId: val,
                      supplier: found ? found.name : "",
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white cursor-pointer"
                >
                  <option value="">Sərbəst / Yoxdur</option>
                  {vendors?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Free-form Supplier & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Tədarükçü (Sərbəst)</label>
                  <input
                    type="text"
                    placeholder="Şirkət / şəxs adı"
                    value={editFormData.supplier}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, supplier: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Qeyd</label>
                  <input
                    type="text"
                    placeholder="Əlavə məlumat"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  />
                </div>
              </div>

              {/* Admin Password Input */}
              <div className="space-y-1.5 pt-2 border-t border-gray-50 relative">
                <label className="text-red-700 uppercase tracking-wider block text-[9px] font-extrabold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-red-500" /> Admin Şifrəsi *
                </label>
                <input
                  type="password"
                  placeholder="Düzəlişi təsdiqləmək üçün şifrə yazın..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-red-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-red-50/10 font-bold"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEntry(null);
                    setEditFormData(null);
                    setAdminPassword("");
                  }}
                  className="w-1/2 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-all font-bold cursor-pointer text-center"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-1/2 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer text-center disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Yenilənir..." : "Təsdiqlə və Saxla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
