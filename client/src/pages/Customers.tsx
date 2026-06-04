import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, X, Users, Phone, MapPin, ClipboardList, Lock } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function Customers() {
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
  const isAdmin = user?.role === "Admin";

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyCustomer);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Queries & Mutations
  const { data: list, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const filteredList = (list || []).filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.address && item.address.toLowerCase().includes(q))
    );
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyCustomer) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Müştəri əlavə edildi!", description: "Yeni müştəri profili yaradıldı.", variant: "success" });
      handleClose();
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Müştəri yaradılarkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyCustomer }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Müştəri yeniləndi!", description: "Profil məlumatları yeniləndi.", variant: "success" });
      handleClose();
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Profil yenilənərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Silindi!", description: "Müştəri profili silindi.", variant: "success" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Müştəri silinərkən xəta baş verdi.", variant: "destructive" });
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(emptyCustomer);
    setIsOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData(emptyCustomer);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Xəta!", description: "Müştəri adı daxil edilməlidir.", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (user?.role !== "Admin" && currentUser?.staffCanViewCustomers === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Müştəri Bazasına Giriş Məhdudlaşdırılıb 🔒</h3>
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
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Müştəri Portfeli</h2>
          <p className="text-xs text-gray-400 mt-1">Daimi və nisyə alıcı müştərilərin siyahısı və idarəedilməsi</p>
        </div>

        <button
          onClick={handleOpenNew}
          className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate"
        >
          <Plus className="w-4 h-4" /> Yeni Müştəri
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold max-w-md">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Müştəri Axtar</label>
          <input
            type="text"
            placeholder="Müştəri adı, telefon, e-poçt və ya ünvan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
          />
        </div>
      </div>

      {/* Customers List Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Ad Soyad</th>
                <th className="p-4">Telefon</th>
                <th className="p-4">E-poçt</th>
                <th className="p-4">Ünvan</th>
                <th className="p-4">Qeyd (İxtiyari)</th>
                <th className="p-4 text-right pr-6 w-20"></th>
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
                    {searchQuery ? "Axtarışa uyğun müştəri tapılmadı." : "Müştəri siyahısı boşdur."}
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                    <td className="p-4 text-center font-mono text-gray-400">{idx + 1}</td>
                    <td className="p-4 font-bold text-gray-900">{item.name}</td>
                    <td className="p-4 font-semibold text-gray-600 font-mono">
                      {item.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {item.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-gray-600 font-medium font-mono">
                      {item.email ? item.email : "—"}
                    </td>
                    <td className="p-4 text-gray-600 font-medium">
                      {item.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {item.address}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-gray-400 max-w-xs truncate">
                      {item.notes ? (
                        <span className="flex items-center gap-1">
                          <ClipboardList className="w-3.5 h-3.5 text-gray-300 shrink-0" /> {item.notes}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-gray-900 rounded-xl cursor-pointer transition-all bg-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="p-2 border border-red-50 hover:bg-red-50 text-red-500 rounded-xl cursor-pointer transition-all bg-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                {editingId ? "Profil Düzəlt" : "Yeni Müştəri"}
              </h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ad Soyad *</label>
                <input
                  type="text"
                  placeholder="Məs. Əli Məmmədov"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telefon</label>
                <input
                  type="text"
                  placeholder="Məs. 055-123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">E-poçt (Email)</label>
                <input
                  type="email"
                  placeholder="Məs. ali@mail.com"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ünvan</label>
                <input
                  type="text"
                  placeholder="Məs. Yasamal, Şərifzadə küç. 45"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qeyd (İxtiyari)</label>
                <textarea
                  placeholder="Əlavə məlumat və ya qeydlər"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
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
                  {editingId ? "Yenilə" : "Yarat"}
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
              Bu müştəri profilini silmək istədiyinizə əminsiniz? Müştərinin əvvəlki satış qaimələri sistemdə qalacaq, lakin profil tamamilə silinəcəkdir.
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
    </div>
  );
}
