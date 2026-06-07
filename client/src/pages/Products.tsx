import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, X, Tag, Sliders, Info, Lock } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { generateValidEAN13 } from "../components/Barcode.tsx";
import LabelPrintModal from "../components/LabelPrintModal.tsx";

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  description: string | null;
  barcode: string | null;
  trackingType?: string;
}

const emptyProduct = {
  name: "",
  category: "",
  unit: "ədəd",
  description: "",
  barcode: "",
  trackingType: "none",
};

export default function Products() {
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
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null);

  // Fetch settings dynamically to get store name for labels
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return { storeName: "BirSaaS Store" };
      return res.json();
    }
  });

  // Queries & Mutations
  const { data: list, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
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
    const qNorm = normalizeSearchText(q);

    return (
      normalizeSearchText(item.name).includes(qNorm) ||
      (item.category && normalizeSearchText(item.category).includes(qNorm)) ||
      (item.description && normalizeSearchText(item.description).includes(qNorm)) ||
      (item.barcode && normalizeSearchText(item.barcode).includes(qNorm))
    );
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyProduct) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Əlavə edildi!", description: "Yeni məhsul kataloqa əlavə edildi.", variant: "success" });
      handleClose();
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Məhsul yaradılarkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyProduct }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Yeniləndi!", description: "Məhsul məlumatları yeniləndi.", variant: "success" });
      handleClose();
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Məhsul yenilənərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Silindi!", description: "Məhsul kataloqdan silindi.", variant: "success" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Məhsul silinərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(emptyProduct);
    setIsOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category || "",
      unit: product.unit,
      description: product.description || "",
      barcode: product.barcode || "",
      trackingType: product.trackingType || "none",
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData(emptyProduct);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Xəta!", description: "Məhsul adı daxil edilməlidir.", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (user?.role !== "Admin" && currentUser?.staffCanManageCatalog === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Kataloqa Giriş Məhdudlaşdırılıb 🔒</h3>
            <p className="text-xs text-gray-500 font-semibold leading-relaxed">
              Məhsul kataloquna giriş və idarəetmə mağaza administratoru tərəfindən məhdudlaşdırılmışdır. Səlahiyyət almaq üçün administratora müraciət edin.
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
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Məhsul Kataloqu</h2>
          <p className="text-xs text-gray-400 mt-1">Sistemdəki bütün məhsulların siyahısı və idarəedilməsi</p>
        </div>

        <button
          onClick={handleOpenNew}
          className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate"
        >
          <Plus className="w-4 h-4" /> Yeni Məhsul
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold max-w-md">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul Axtar</label>
          <input
            type="text"
            placeholder="Məhsul adı, kateqoriya və ya təsvir..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
          />
        </div>
      </div>

      {/* Main product table card */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Ad</th>
                <th className="p-4">Barkod</th>
                <th className="p-4">Kateqoriya</th>
                <th className="p-4">Ölçü Vahidi</th>
                <th className="p-4">Təsvir (Qeyd)</th>
                <th className="p-4 text-right pr-6">Əməliyyatlar</th>
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
                    {searchQuery ? "Axtarışa uyğun məhsul tapılmadı." : "Kataloq boşdur. Yeni məhsul əlavə edin."}
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                    <td className="p-4 text-center font-mono text-gray-400">{idx + 1}</td>
                    <td className="p-4 font-bold text-gray-900">{item.name}</td>
                    <td className="p-4 font-mono text-[10px] text-gray-500 font-bold">{item.barcode || "—"}</td>
                    <td className="p-4 font-medium text-gray-600">
                      {item.category ? (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {item.category}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-gray-500 font-medium">{item.unit}</td>
                    <td className="p-4 text-gray-400 truncate max-w-xs">{item.description || "—"}</td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedProductForLabel(item)}
                          className="p-2 border border-amber-100 hover:border-amber-200 text-amber-600 hover:text-amber-700 rounded-xl cursor-pointer transition-all bg-white"
                          title="Qiymət Kağızı Çap Et"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-gray-900 rounded-xl cursor-pointer transition-all bg-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 border border-red-50 hover:bg-red-50 text-red-500 rounded-xl cursor-pointer transition-all bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. EDIT / CREATE MODAL */}
      {isOpen && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-5">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight">
                {editingId ? "Məhsulu Düzəlt" : "Yeni Məhsul"}
              </h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul adı *</label>
                <input
                  type="text"
                  placeholder="Məs. Korkmaz Qazan 24sm"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Barkod</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Məhsul barkodu (EAN-13)"
                    value={formData.barcode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, barcode: generateValidEAN13() }))}
                    className="px-3.5 py-3 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100/50 rounded-xl font-bold transition-all text-[11px] shrink-0 cursor-pointer"
                    title="Avtomatik EAN-13 barkod yarat"
                  >
                    Yarat ⚡
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">İzləmə Növü *</label>
                <select
                  value={formData.trackingType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, trackingType: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer font-bold"
                >
                  <option value="none">Standard (Barkod ilə)</option>
                  <option value="serialized">Serial Nömrə (IMEI ilə izlənilən)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kateqoriya</label>
                <input
                  type="text"
                  placeholder="Məs. Qazan, Tava, Mətbəx"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ölçü Vahidi *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="ədəd">ədəd (ədəd olaraq)</option>
                  <option value="dəst">dəst (dəst olaraq)</option>
                  <option value="kq">kq (kiloqram olaraq)</option>
                  <option value="metr">metr (metrlə)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Təsvir (Qeyd)</label>
                <textarea
                  placeholder="İxtiyari əlavə qeydlər daxil edin"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-50 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                >
                  {editingId ? "Yenilə" : "Əlavə et"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CONFIRM DELETE MODAL */}
      {deleteId !== null && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-base leading-tight">Silməyi təsdiqləyin</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Bu məhsulu silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz və məhsulla əlaqəli bütün satış və mədaxil tarixçəsinə təsir edə bilər.
            </p>

            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-gray-50">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
                className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-xl hover:bg-red-700 cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Print Modal overlay */}
      {selectedProductForLabel && (
        <LabelPrintModal
          product={selectedProductForLabel}
          storeName={settings?.storeName || "BirSaaS Store"}
          onClose={() => setSelectedProductForLabel(null)}
        />
      )}
    </div>
  );
}
