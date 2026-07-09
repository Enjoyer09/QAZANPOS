import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, Lock, Edit2, X, Plus } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { sanitizeQtyInput } from "../lib/utils.ts";
import { generateValidEAN13 } from "../components/Barcode.tsx";
import { TableSkeleton } from "../components/Skeleton.tsx";

const emptyEntry = {
  productId: "",
  quantity: "",
  purchasePrice: "",
  supplier: "",
  notes: "",
  paymentType: "Nəğd",
  creditDueDate: "",
  vendorId: "",
  bankName: "",
  applyEdv: true,
  warehouseId: "",
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

  // Full Product Creation Modal States
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductTrackingType, setNewProductTrackingType] = useState("none");
  const [newProductSerialNumber, setNewProductSerialNumber] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductVendorId, setNewProductVendorId] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("ədəd");
  const [newProductWarrantyMonths, setNewProductWarrantyMonths] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [isSubmittingNewProduct, setIsSubmittingNewProduct] = useState(false);

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

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const activeBanksList: string[] = React.useMemo(() => {
    if (!settings?.activeBanks) return [];
    try {
      const parsed = JSON.parse(settings.activeBanks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settings?.activeBanks]);

  const [forceSerialized, setForceSerialized] = useState(false);

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) throw new Error();
      return res.json();
    }
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

  useEffect(() => {
    if (currentUser?.warehouseId && !formData.warehouseId) {
      setFormData((prev) => ({ ...prev, warehouseId: String(currentUser.warehouseId) }));
    }
  }, [currentUser, formData.warehouseId]);

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
  const filteredProducts = (products || []).filter((p) => {
    const q = productSearch.trim();
    if (!q) return true;
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => {
      return (
        normalizeSearchText(p.name).includes(word) ||
        (p.barcode && normalizeSearchText(p.barcode).includes(word)) ||
        (p.category && normalizeSearchText(p.category).includes(word)) ||
        (p.description && normalizeSearchText(p.description).includes(word))
      );
    });
  });
  const filteredEntries = (entries || []).filter((entry) => {
    const q = searchQuery.trim();
    if (!q) return true;
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => {
      return (
        (entry.productName && normalizeSearchText(entry.productName).includes(word)) ||
        (entry.supplier && normalizeSearchText(entry.supplier).includes(word)) ||
        (entry.notes && normalizeSearchText(entry.notes).includes(word)) ||
        (entry.paymentType && normalizeSearchText(entry.paymentType).includes(word))
      );
    });
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

  const handleNewProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast({ title: "Xəta!", description: "Məhsul adı mütləqdir.", variant: "destructive" });
      return;
    }

    setIsSubmittingNewProduct(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "Staff",
          "x-user-username": user?.username || ""
        },
        body: JSON.stringify({
          name: newProductName.trim(),
          category: newProductCategory.trim() || null,
          unit: newProductUnit,
          description: newProductDescription.trim() || null,
          barcode: newProductBarcode.trim() || null,
          trackingType: newProductTrackingType,
          serialNumber: newProductSerialNumber.trim() || null,
          warrantyMonths: newProductWarrantyMonths ? parseInt(newProductWarrantyMonths) : null,
          vendorId: newProductVendorId ? parseInt(newProductVendorId) : null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Məhsul yaradılarkən xəta baş verdi.");
      }

      const createdProduct = await res.json();
      
      // Auto-select this newly created product in the Stock In form
      setFormData((prev) => ({ ...prev, productId: String(createdProduct.id) }));
      setProductSearch(createdProduct.name);
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      
      toast({ title: "Uğurlu!", description: `"${createdProduct.name}" məhsulu kataloqa yaradıldı və seçildi.`, variant: "success" });
      setIsNewProductModalOpen(false);
    } catch (err: any) {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingNewProduct(false);
    }
  };

  const isCredit = formData.paymentType === "Nisyə";
  const calculatedTotal = parseFloat(formData.quantity || "0") * parseFloat(formData.purchasePrice || "0");

  const selectedProduct = products?.find((p) => String(p.id) === formData.productId);
  const isSerializedProduct = selectedProduct?.trackingType === "serialized";
  const isSerialized = isSerializedProduct || forceSerialized;

  useEffect(() => {
    if (isSerializedProduct) {
      setForceSerialized(true);
    } else {
      setForceSerialized(false);
    }
  }, [isSerializedProduct]);

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
      bankName: formData.paymentType === "Kart" ? (formData.bankName || null) : null,
      creditDueDate: isCredit ? formData.creditDueDate : null,
      vendorId: formData.vendorId ? parseInt(formData.vendorId) : null,
      serialNumbers: isSerialized ? parsedSerials : null,
      applyEdv: formData.applyEdv ? 1 : 0,
      warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : (currentUser?.warehouseId || 1),
    };

    createMutation.mutate(payload);
  };



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
              <div className="flex items-center justify-between">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul *</label>
                <button
                  type="button"
                  onClick={() => {
                    setNewProductName("");
                    setNewProductBarcode("");
                    setNewProductCategory("");
                    setNewProductUnit("ədəd");
                    setNewProductDescription("");
                    setNewProductTrackingType("none");
                    setNewProductSerialNumber("");
                    setNewProductWarrantyMonths("");
                    setNewProductVendorId("");
                    setIsNewProductModalOpen(true);
                  }}
                  className="text-primary hover:underline text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  ➕ Yeni Məhsul Yarat
                </button>
              </div>
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
                      <div className="p-4 text-center text-xs text-gray-400 space-y-2">
                        <p>🔍 Məhsul tapılmadı</p>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Pre-fill name or barcode
                            const query = productSearch.trim();
                            if (/^[0-9]{8,15}$/.test(query)) {
                              setNewProductBarcode(query);
                              setNewProductName("");
                            } else {
                              setNewProductName(query);
                              setNewProductBarcode("");
                            }
                            setNewProductCategory("");
                            setNewProductUnit("ədəd");
                            setNewProductDescription("");
                            setNewProductTrackingType("none");
                            setNewProductSerialNumber("");
                            setNewProductWarrantyMonths("");
                            setNewProductVendorId("");
                            setIsNewProductModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-primary/95 cursor-pointer transition-all inline-block hover-elevate shadow-xs"
                        >
                          ➕ Yeni Kataloq Məhsulu Yarat
                        </button>
                      </div>
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

            {/* Serialization override toggle (Only visible if the product is not already serialized) */}
            {selectedProduct && !isSerializedProduct && (
              <div className="flex items-center gap-2 py-1 select-none animate-in fade-in duration-200">
                <input
                  type="checkbox"
                  id="forceSerialized"
                  checked={forceSerialized}
                  onChange={(e) => setForceSerialized(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="forceSerialized" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Serial nömrələri (IMEI) daxil et 🏷️
                </label>
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

            {/* VAT (ƏDV) Toggle */}
            <div className="flex items-center gap-2 py-1 select-none animate-in fade-in duration-200">
              <input
                type="checkbox"
                id="applyEdv"
                checked={!!formData.applyEdv}
                onChange={(e) => setFormData((prev) => ({ ...prev, applyEdv: e.target.checked }))}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer"
              />
              <label htmlFor="applyEdv" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                18% ƏDV Tətbiq Edilsin <span className="text-[10px] text-gray-400 font-normal">(Məbləğə ƏDV daxildir)</span>
              </label>
            </div>

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

            {/* Bank Selection (Only if payment type is Kart) */}
            {formData.paymentType === "Kart" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Bank Hesabı *</label>
                <select
                  value={formData.bankName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer text-xs font-bold"
                  required
                >
                  <option value="">Bank Seçin...</option>
                  {(activeBanksList.length > 0 ? activeBanksList : ["Digər"]).map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* Warehouse Selector */}
            {settings?.multiWarehouseEnabled !== 0 && (
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Mədaxil Anbarı</label>
                <select
                  value={formData.warehouseId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, warehouseId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold text-gray-700"
                >
                  <option value="">Anbar Seçin...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
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
                  <TableSkeleton rows={6} colSpan={6} />
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                      {searchQuery ? "Axtarışa uyğun mədaxil tapılmadı." : "Hələ mədaxil qeydə alınmayıb."}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                      <td className="py-3 px-2 font-bold text-gray-900">
                        <div className="flex flex-col">
                          <span>{entry.productName}</span>
                          {settings?.taxStatus === "edv" && (
                            <span className={`text-[9px] font-bold mt-0.5 w-max px-1.5 py-0.5 rounded-md ${entry.applyEdv !== 0 ? "text-green-600 bg-green-50 border border-green-100" : "text-gray-500 bg-gray-100 border border-gray-200"}`}>
                              {entry.applyEdv !== 0 ? "ƏDV-li" : "ƏDV-siz"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-700 font-mono">
                        {entry.quantity}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-gray-950 font-mono">
                        {Number(entry.purchasePrice || 0).toFixed(2)} ₼
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold ${paymentBadges[entry.paymentType] || "bg-gray-50 text-gray-500"}`}>
                            {entry.paymentType}
                          </span>
                          {entry.paymentType === "Kart" && entry.bankName && (
                            <span className="text-[9px] text-gray-500 font-bold block">{entry.bankName}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400">
                        {(() => {
                          if (!entry.entryDate) return "-";
                          const d = new Date(entry.entryDate);
                          return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("az-AZ");
                        })()}
                      </td>
                      <td className="py-3 px-2 text-center pr-4">
                        {user?.role === "Admin" && (
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setEditFormData({
                                id: entry.id,
                                productId: String(entry.productId),
                                quantity: String(entry.quantity),
                                purchasePrice: String(entry.purchasePrice),
                                paymentType: entry.paymentType,
                                bankName: entry.bankName || "",
                                creditDueDate: entry.creditDueDate || "",
                                supplier: entry.supplier || "",
                                notes: entry.notes || "",
                                vendorId: entry.vendorId ? String(entry.vendorId) : "",
                                applyEdv: entry.applyEdv !== 0,
                              });
                              setAdminPassword("");
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-primary rounded-lg cursor-pointer transition-all inline-flex items-center justify-center"
                            title="Düzəliş et"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                  bankName: editFormData.paymentType === "Kart" ? (editFormData.bankName || null) : null,
                  creditDueDate: isEditCredit ? editFormData.creditDueDate : null,
                  supplier: editFormData.supplier || null,
                  notes: editFormData.notes || null,
                  vendorId: editFormData.vendorId ? parseInt(editFormData.vendorId) : null,
                  adminPassword: adminPassword.trim(),
                  applyEdv: editFormData.applyEdv ? 1 : 0,
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

              {/* Edit VAT (ƏDV) Toggle */}
              <div className="flex items-center gap-2 py-1 select-none animate-in fade-in duration-200">
                <input
                  type="checkbox"
                  id="editApplyEdv"
                  checked={!!editFormData.applyEdv}
                  onChange={(e) => setEditFormData((prev: any) => ({ ...prev, applyEdv: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="editApplyEdv" className="text-xs font-bold text-gray-700 cursor-pointer">
                  18% ƏDV Tətbiq Edilsin 🏷️
                </label>
              </div>

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

              {/* Bank Selection (Only if payment type is Kart) */}
              {editFormData.paymentType === "Kart" && (
                <div className="space-y-1 animate-in slide-in-from-top-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[9px]">Bank Hesabı *</label>
                  <select
                    value={editFormData.bankName}
                    onChange={(e) => setEditFormData((prev: any) => ({ ...prev, bankName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white cursor-pointer"
                    required
                  >
                    <option value="">Bank Seçin...</option>
                    {(activeBanksList.length > 0 ? activeBanksList : ["Digər"]).map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
      {/* 2. FULL NEW PRODUCT CREATION MODAL FOR STOCK IN */}
      {isNewProductModalOpen && (
        <div className="liquid-glass-overlay !z-[110]">
          <div className="liquid-glass-card max-w-md p-6 relative animate-in zoom-in-95 duration-200">
            {/* Top Border Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-teal-500 rounded-t-2xl"></div>

            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-5 mt-2">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Kataloqda Yeni Məhsul Yarat
              </h3>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewProductSubmit} className="space-y-4 text-xs font-semibold max-h-[75vh] overflow-y-auto pr-1">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul adı *</label>
                <input
                  type="text"
                  placeholder="Məs. Korkmaz Qazan 24sm"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-xs font-bold"
                  required
                />
              </div>

              {/* Barcode */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Barkod</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Məhsul barkodu (EAN-13)"
                    value={newProductBarcode}
                    onChange={(e) => setNewProductBarcode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setNewProductBarcode(generateValidEAN13())}
                    className="px-3.5 py-3 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100/50 rounded-xl font-bold transition-all text-[11px] shrink-0 cursor-pointer"
                    title="Avtomatik EAN-13 barkod yarat"
                  >
                    Yarat ⚡
                  </button>
                </div>
              </div>

              {/* Tracking Type */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">İzləmə Növü *</label>
                <select
                  value={newProductTrackingType}
                  onChange={(e) => setNewProductTrackingType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold text-gray-700"
                >
                  <option value="none">Standard (Barkod ilə)</option>
                  <option value="serialized">Serial Nömrə (IMEI ilə izlənilən)</option>
                </select>
              </div>

              {newProductTrackingType === "serialized" && (
                <div className="space-y-1.5 border border-amber-200 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5 duration-200">
                  <label className="text-amber-800 uppercase tracking-wider block text-[10px] font-bold">Serial Nömrə / IMEI (İlkin)</label>
                  <input
                    type="text"
                    placeholder="Məs. SN-1234567"
                    value={newProductSerialNumber}
                    onChange={(e) => setNewProductSerialNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono text-xs"
                  />
                  <p className="text-[10px] text-amber-700/80 leading-normal font-medium mt-1">
                    İxtiyari. Əgər bura serial nömrəsi daxil etsəniz, məhsul yaradılarkən avtomatik olaraq anbara 1 ədəd mədaxil ediləcək (Alış qiyməti: 0 ₼).
                  </p>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kateqoriya</label>
                <input
                  type="text"
                  placeholder="Məs. Qazan, Tava, Mətbəx"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              {/* Vendor */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Tədarükçü (Firma)</label>
                <select
                  value={newProductVendorId}
                  onChange={(e) => setNewProductVendorId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold text-gray-700"
                >
                  <option value="">Seçilməyib (Yoxdur)</option>
                  {(vendors || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ölçü Vahidi *</label>
                <select
                  value={newProductUnit}
                  onChange={(e) => setNewProductUnit(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold text-gray-700"
                >
                  <option value="ədəd">ədəd (ədəd olaraq)</option>
                  <option value="dəst">dəst (dəst olaraq)</option>
                  <option value="kq">kq (kiloqram olaraq)</option>
                  <option value="metr">metr (metrlə)</option>
                </select>
              </div>

              {/* Warranty Months */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Zəmanət Müddəti (Ay)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Məs. 12 (ixtiyari)"
                  value={newProductWarrantyMonths}
                  onChange={(e) => setNewProductWarrantyMonths(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Təsvir (Qeyd)</label>
                <textarea
                  placeholder="İxtiyari əlavə qeydlər daxil edin"
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 h-20 resize-none"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewProduct}
                  className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/95 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-primary/10"
                >
                  {isSubmittingNewProduct ? "Yaradılır..." : "Yarat və Seç"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
