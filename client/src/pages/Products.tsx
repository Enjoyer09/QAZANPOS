import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";import {
  Plus, Edit2, Trash2, X, Tag, Sliders, Info, Lock, Archive, RotateCcw, ChevronLeft, ChevronRight
} from "lucide-react";
import { TableSkeleton } from "../components/Skeleton.tsx";
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
  warrantyMonths?: number | null;
  isArchived?: number;
  hasHistory?: boolean;
  vendorId?: number | null;
  minStockLimit?: number | null;
}

const emptyProduct = {
  name: "",
  category: "",
  unit: "ədəd",
  description: "",
  barcode: "",
  trackingType: "none",
  serialNumber: "",
  warrantyMonths: "",
  vendorId: "",
  minStockLimit: "",
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
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, activeTab]);

  const handleTabChange = (tab: "active" | "archived") => {
    setActiveTab(tab);
    setSelectedCategory("all");
  };

  // Fetch settings dynamically to get store name for labels
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return { storeName: "BirSaaS Store" };
      return res.json();
    }
  });

  // Fetch vendors list
  const { data: vendors } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error();
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
    // 1. Filter by Active vs Archived status
    const itemArchived = (item as any).isArchived || 0;
    const isTabMatch = activeTab === "active" ? itemArchived === 0 : itemArchived === 1;
    if (!isTabMatch) return false;

    // 2. Filter by Category
    if (selectedCategory !== "all") {
      const itemCat = item.category?.trim() || "Kateqoriyasız";
      if (itemCat !== selectedCategory) return false;
    }

    // 3. Filter by Search Query
    const q = searchQuery.trim();
    if (!q) return true;
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => {
      return (
        normalizeSearchText(item.name).includes(word) ||
        (item.category && normalizeSearchText(item.category).includes(word)) ||
        (item.description && normalizeSearchText(item.description).includes(word)) ||
        (item.barcode && normalizeSearchText(item.barcode).includes(word))
      );
    });
  });

  // Pagination calculations
  const totalItems = filteredList.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
  
  // Safe-guard currentPage boundary
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredList.length, pageSize, totalPages, currentPage]);

  const paginatedList = pageSize === -1
    ? filteredList
    : filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyProduct) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Məhsul yaradıla bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Əlavə edildi!", description: "Yeni məhsul kataloqa əlavə edildi.", variant: "success" });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Xəta!", description: error.message || "Məhsul yaradılarkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyProduct }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Məhsul yenilənə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Yeniləndi!", description: "Məhsul məlumatları yeniləndi.", variant: "success" });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Xəta!", description: error.message || "Məhsul yenilənərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Məhsul silinərkən xəta baş verdi.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Silindi!", description: "Məhsul kataloqdan silindi.", variant: "success" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Xəta!", description: error.message || "Məhsul silinərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: number; isArchived: number }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Əməliyyat uğursuz oldu");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: variables.isArchived === 1 ? "Arxivləndi!" : "Bərpa edildi!",
        description: variables.isArchived === 1 ? "Məhsul arxivə göndərildi." : "Məhsul yenidən aktiv kataloqa qaytarıldı.",
        variant: "success"
      });
      setArchiveId(null);
    },
    onError: (error: any) => {
      toast({ title: "Xəta!", description: error.message || "Əməliyyat zamanı xəta baş verdi.", variant: "destructive" });
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
      serialNumber: "",
      warrantyMonths: product.warrantyMonths ? String(product.warrantyMonths) : "",
      vendorId: product.vendorId ? String(product.vendorId) : "",
      minStockLimit: product.minStockLimit !== null ? String(product.minStockLimit) : "",
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

  // Calculate active and archived products and category maps
  const activeProducts = (list || []).filter(p => (p as any).isArchived !== 1);
  const archivedProducts = (list || []).filter(p => (p as any).isArchived === 1);

  const activeCatCounts = new Map<string, number>();
  activeProducts.forEach(p => {
    const cat = p.category?.trim() || "Kateqoriyasız";
    activeCatCounts.set(cat, (activeCatCounts.get(cat) || 0) + 1);
  });

  const archivedCatCounts = new Map<string, number>();
  archivedProducts.forEach(p => {
    const cat = p.category?.trim() || "Kateqoriyasız";
    archivedCatCounts.set(cat, (archivedCatCounts.get(cat) || 0) + 1);
  });

  const activeCategories = Array.from(activeCatCounts.keys()).sort();
  const archivedCategories = Array.from(archivedCatCounts.keys()).sort();

  const totalActiveCount = activeProducts.length;
  const totalArchivedCount = archivedProducts.length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-in fade-in-0">
      {/* Sol Sidebar: Kateqoriyalar */}
      <div className="w-full lg:w-60 bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card space-y-4 shrink-0">
        <div>
          <h3 className="text-sm font-black text-gray-950 tracking-tight">Kateqoriyalar</h3>
          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Filterləmək üçün seçin</p>
        </div>

        {/* Aktiv / Arxiv Tabları */}
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50 text-xs">
          <button
            onClick={() => handleTabChange("active")}
            className={`flex-1 py-1.5 text-center text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-primary text-white shadow-xs"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Aktiv ({totalActiveCount})
          </button>
          <button
            onClick={() => handleTabChange("archived")}
            className={`flex-1 py-1.5 text-center text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
              activeTab === "archived"
                ? "bg-red-600 text-white shadow-xs"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Arxiv ({totalArchivedCount})
          </button>
        </div>

        {/* Kateqoriyalar Siyahısı */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-extrabold flex justify-between items-center transition-all cursor-pointer border ${
              selectedCategory === "all"
                ? (activeTab === "active" ? "bg-primary/10 text-primary border-primary/20" : "bg-red-50 text-red-600 border-red-100")
                : "text-gray-700 hover:bg-gray-50 border-transparent"
            }`}
          >
            <span>Hamısı</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
              selectedCategory === "all"
                ? (activeTab === "active" ? "bg-primary text-white" : "bg-red-600 text-white")
                : "bg-gray-200 text-gray-500"
            }`}>
              {activeTab === "active" ? totalActiveCount : totalArchivedCount}
            </span>
          </button>

          {(activeTab === "active" ? activeCategories : archivedCategories).map(cat => {
            const count = (activeTab === "active" ? activeCatCounts : archivedCatCounts).get(cat) || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-extrabold flex justify-between items-center transition-all cursor-pointer border ${
                  isSelected
                    ? (activeTab === "active" ? "bg-primary/10 text-primary border-primary/20" : "bg-red-50 text-red-600 border-red-100")
                    : "text-gray-700 hover:bg-gray-50/50 border-transparent"
                }`}
              >
                <span className="truncate pr-2">{cat}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                  isSelected
                    ? (activeTab === "active" ? "bg-primary text-white" : "bg-red-600 text-white")
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sağ Hissə: Məhsul Siyahısı */}
      <div className="flex-1 w-full space-y-6">
        {/* Top action header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {activeTab === "active" ? "Məhsul Kataloqu" : "Arxivlənmiş Məhsullar"}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === "active" 
                ? "Sistemdəki bütün məhsulların siyahısı və idarəedilməsi" 
                : "Tarixçəsi qorunan, lakin aktiv dövriyyədən çıxarılmış məhsullar"}
            </p>
          </div>

          {activeTab === "active" && (
            <button
              onClick={handleOpenNew}
              className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate shrink-0"
            >
              <Plus className="w-4 h-4" /> Yeni Məhsul
            </button>
          )}
        </div>

        {/* Search Input bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-sm font-semibold max-w-xl">
          <div className="space-y-1.5">
            <label className="text-gray-500 uppercase tracking-wider block text-[10px] font-extrabold">Məhsul Axtar</label>
            <input
              type="text"
              placeholder="Məhsul adı, kateqoriya və ya təsvir..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-sm font-semibold text-gray-800"
            />
          </div>
        </div>

        {/* Main product table card */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-black text-gray-800 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">Ad</th>
                  <th className="p-4">Barkod</th>
                  <th className="p-4">Kateqoriya</th>
                  <th className="p-4">Ölçü Vahidi</th>
                  <th className="p-4">Tədarükçü</th>
                  <th className="p-4">Təsvir (Qeyd)</th>
                  <th className="p-4 text-right pr-6">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <TableSkeleton rows={4} />
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-xs text-gray-400">
                      {searchQuery ? "Axtarışa uyğun məhsul tapılmadı." : "Bu bölmədə məhsul yoxdur."}
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((item, idx) => {
                    const itemIndex = pageSize === -1 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-sm">
                        <td className="p-4 text-center font-mono text-gray-500 font-bold">{itemIndex}</td>
                      <td className="p-4 font-bold text-gray-900">
                        <div>{item.name}</div>
                        {item.warrantyMonths ? (
                          <span className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-md text-[10px] font-black mt-1 select-none animate-in fade-in duration-200">
                            🛡️ {item.warrantyMonths} ay zəmanət
                          </span>
                        ) : null}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-600 font-bold">{item.barcode || "—"}</td>
                      <td className="p-4 font-medium text-gray-600">
                        {item.category ? (
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs font-black">
                            {item.category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-gray-700 font-bold">{item.unit}</td>
                      <td className="p-4 font-bold text-gray-800">
                        {item.vendorId && vendors ? (
                          vendors.find(v => v.id === item.vendorId)?.name || "—"
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-gray-600 font-medium truncate max-w-xs">{item.description || "—"}</td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {item.isArchived === 1 ? (
                            <button
                              onClick={() => archiveMutation.mutate({ id: item.id, isArchived: 0 })}
                              className="p-2 border border-green-100 hover:border-green-200 text-green-600 hover:text-green-700 rounded-xl cursor-pointer transition-all bg-white flex items-center gap-1 text-[10px] font-bold"
                              title="Arxivdən Bərpa Et"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Bərpa Et
                            </button>
                          ) : (
                            <>
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
                              {(item as any).hasHistory ? (
                                <button
                                  onClick={() => setArchiveId(item.id)}
                                  className="p-2 border border-blue-100 hover:border-blue-200 hover:bg-blue-50 text-blue-600 rounded-xl cursor-pointer transition-all bg-white flex items-center gap-1 text-[10px] font-bold"
                                  title="Arxivə Göndər (Tarixçəsi var)"
                                >
                                  <Archive className="w-3.5 h-3.5" /> Arxivlə
                                </button>
                              ) : (
                                <button
                                  onClick={() => setDeleteId(item.id)}
                                  className="p-2 border border-red-50 hover:bg-red-50 text-red-500 rounded-xl cursor-pointer transition-all bg-white"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
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
          {totalItems > 0 && (
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
                    `Toplam ${totalItems} məhsulun hamısı göstərilir`
                  ) : (
                    `Toplam ${totalItems} məhsuldan ${Math.min(totalItems, (currentPage - 1) * pageSize + 1)}-${Math.min(totalItems, currentPage * pageSize)} aralığı`
                  )}
                </span>
              </div>

              {pageSize !== -1 && totalPages > 1 && (
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      totalPages > 6 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - currentPage) > 1
                    ) {
                      if (pageNum === 2 && currentPage > 3) {
                        return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                      }
                      if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
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
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
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

              {formData.trackingType === "serialized" && !editingId && (
                <div className="space-y-1.5 border border-amber-200 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5 duration-200">
                  <label className="text-amber-800 uppercase tracking-wider block text-[10px] font-bold">Serial Nömrə / IMEI (İlkin)</label>
                  <input
                    type="text"
                    placeholder="Məs. SN-1234567"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, serialNumber: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono text-xs"
                  />
                  <p className="text-[10px] text-amber-700/80 leading-normal font-medium mt-1">
                    İxtiyari. Əgər bura serial nömrəsi daxil etsəniz, məhsul yaradılarkən avtomatik olaraq anbara 1 ədəd mədaxil ediləcək (Alış qiyməti: 0 ₼).
                  </p>
                </div>
              )}

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
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Tədarükçü (Firma)</label>
                <select
                  value={formData.vendorId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vendorId: e.target.value }))}
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
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Zəmanət Müddəti (Ay)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Məs. 12 (ixtiyari)"
                  value={formData.warrantyMonths}
                  onChange={(e) => setFormData((prev) => ({ ...prev, warrantyMonths: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Min. Anbar Limiti (Avtomatik PO 🛒)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Məs. 5 (bu limitdən aşağı düşəndə sifariş təklifi yaranir)"
                  value={(formData as any).minStockLimit ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, minStockLimit: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50/30 font-bold"
                />
                <p className="text-[10px] text-orange-600/80 font-medium">
                  Stok bu rəqəmdən aşağı düşəndə Avtomatik Satınalma Sifarişi siyahısına avtomatik əlavə edilir.
                </p>
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

      {/* 3. CONFIRM ARCHIVE MODAL */}
      {archiveId !== null && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="font-bold text-gray-950 text-base leading-tight font-black">Arxivləşdirməyi təsdiqləyin</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed font-semibold">
              Bu məhsulun keçmiş satış/mədaxil tarixçəsi var. Sistemdəki hesabatların pozulmaması üçün o, bazadan tamamilə silinməyəcək, lakin **Arxivə** göndərilərək POS satış və anbar siyahılarından çıxarılacaq.
            </p>

            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-gray-50">
              <button
                onClick={() => setArchiveId(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                onClick={() => archiveId !== null && archiveMutation.mutate({ id: archiveId, isArchived: 1 })}
                className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all"
              >
                Arxivə Göndər
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
