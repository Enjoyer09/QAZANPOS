import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Edit2, Trash2, X, Users, Phone, MapPin, ClipboardList, 
  Lock, Gift, Mail,
  ChevronRight, ChevronDown, Clock, ArrowRight, Save,
  User
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { TableSkeleton } from "../components/Skeleton.tsx";

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  loyaltyPoints: number | null;
  createdByName: string | null;
}

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const getAvatarGradient = (name: string) => {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-teal-500 to-emerald-500",
    "from-amber-500 to-orange-500",
    "from-fuchsia-500 to-purple-600",
  ];
  return gradients[hash % gradients.length];
};

const getInitials = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

  // CRM Detail Drawer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "sales" | "activity">("overview");
  const [newActivity, setNewActivity] = useState("");
  const [expandedSales, setExpandedSales] = useState<Record<number, boolean>>({});

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

  // Fetch sales for selected customer
  const { data: customerSales, isLoading: isSalesLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", selectedCustomerId, "sales"],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const res = await fetch(`/api/customers/${selectedCustomerId}/sales`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!selectedCustomerId,
  });

  const selectedCustomer = list?.find(c => c.id === selectedCustomerId);

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

  // In-Drawer inline note update mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const current = list?.find(c => c.id === id);
      if (!current) throw new Error();
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: current.name,
          phone: current.phone || "",
          email: current.email || "",
          address: current.address || "",
          notes: notes
        }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Qeyd yadda saxlanıldı", variant: "success" });
    },
    onError: () => {
      toast({ title: "Xəta!", description: "Qeyd saxlanılarkən səhv baş verdi.", variant: "destructive" });
    }
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
      setSelectedCustomerId(null);
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

  // Activity Log Timeline Manager (Stored locally for simulation)
  const getActivities = (customerId: number) => {
    try {
      const data = localStorage.getItem(`qazanpos_crm_activity_${customerId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const addActivityLog = (customerId: number, text: string) => {
    if (!text.trim()) return;
    const current = getActivities(customerId);
    const newLog = {
      id: Date.now(),
      text: text,
      date: new Date().toISOString(),
      author: user?.name || "Kassir"
    };
    const updated = [newLog, ...current];
    localStorage.setItem(`qazanpos_crm_activity_${customerId}`, JSON.stringify(updated));
    setNewActivity("");
    toast({ title: "Aktivlik qeyd edildi", variant: "success" });
  };

  // Compute calculated metrics
  const totalPurchased = customerSales?.reduce((acc, sale) => acc + parseFloat(sale.totalAmount || "0"), 0) || 0;
  const totalDebt = customerSales?.reduce((acc, sale) => {
    const paid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0) || 0;
    const debt = parseFloat(sale.totalAmount || "0") - paid;
    return acc + (debt > 0 ? debt : 0);
  }, 0) || 0;

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
    <div className="space-y-6 animate-in fade-in-0 relative min-h-[80vh] pb-10">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary shrink-0" /> Müştəri Portfeli
          </h2>
          <p className="text-xs text-gray-400 mt-1">Twenty CRM üslubunda müştəri kartları və əlaqə idarəetməsi</p>
        </div>

        <button
          onClick={handleOpenNew}
          className="px-4 py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate"
        >
          <Plus className="w-4 h-4" /> Yeni Müştəri
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card text-xs font-semibold max-w-md">
        <div className="space-y-1">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Axtarış</label>
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
                <th className="p-4">Müştəri</th>
                <th className="p-4">Telefon</th>
                <th className="p-4">E-poçt</th>
                <th className="p-4">Ünvan</th>
                <th className="p-4 text-center">Loyallıq Balı</th>
                <th className="p-4 text-right pr-6 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={8} colSpan={7} />
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-xs text-gray-400">
                    {searchQuery ? "Axtarışa uyğun müştəri tapılmadı." : "Müştəri siyahısı boşdur."}
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const pts = parseFloat(String(item.loyaltyPoints ?? 0)) || 0;
                  const initials = getInitials(item.name);
                  const gradient = getAvatarGradient(item.name);
                  const isSelected = selectedCustomerId === item.id;

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => { setSelectedCustomerId(item.id); setDrawerTab("overview"); }}
                      className={`border-b border-gray-50 hover:bg-primary/5 cursor-pointer transition-all text-xs ${isSelected ? 'bg-primary/5 font-semibold' : ''}`}
                    >
                      <td className="p-4 text-center font-mono text-gray-400">{idx + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-extrabold text-[10px] shadow-sm`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-tight">{item.name}</div>
                            {item.notes && <div className="text-[10px] text-gray-400 truncate max-w-[150px] font-medium mt-0.5">{item.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-gray-600 font-mono">
                        {item.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {item.phone}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-600 font-medium font-mono">
                        {item.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {item.email}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-600 font-medium">
                        {item.address ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {item.address}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {pts > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px]">
                            <Gift className="w-3 h-3 text-amber-500" />
                            {pts.toFixed(1)} bal
                          </span>
                        ) : (
                          <span className="text-gray-300 font-semibold">0 bal</span>
                        )}
                      </td>
                      <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 border border-gray-100 hover:border-gray-200 text-gray-500 hover:text-gray-900 rounded-lg cursor-pointer transition-all bg-white"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="p-1.5 border border-red-50 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition-all bg-white"
                            >
                              <Trash2 className="w-3 h-3" />
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

      {/* CRM Sliding Drawer Panel */}
      {selectedCustomerId && selectedCustomer && (
        <>
          {/* Backdrop overlay */}
          <div 
            onClick={() => setSelectedCustomerId(null)}
            className="fixed inset-0 bg-gray-900/10 backdrop-blur-xs z-40 transition-all duration-200"
          />

          {/* Drawer container */}
          <div className="fixed top-0 right-0 h-full w-[480px] bg-white border-l border-gray-150 shadow-2xl z-50 transform transition-transform duration-300 translate-x-0 flex flex-col animate-in slide-in-from-right duration-250">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between relative bg-gradient-to-b from-gray-50/50 to-white">
              <button 
                onClick={() => setSelectedCustomerId(null)}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl cursor-pointer transition-all absolute top-4 left-4"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center mx-auto text-center mt-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(selectedCustomer.name)} flex items-center justify-center text-white font-black text-2xl shadow-md`}>
                  {getInitials(selectedCustomer.name)}
                </div>
                <h3 className="text-lg font-black text-gray-900 mt-3 leading-tight">{selectedCustomer.name}</h3>
                
                {/* Contact links tags */}
                <div className="flex flex-wrap gap-2 justify-center mt-2 text-[10px] font-semibold text-gray-500">
                  {selectedCustomer.phone && (
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                      <Phone className="w-3 h-3 text-gray-400" /> {selectedCustomer.phone}
                    </span>
                  )}
                  {selectedCustomer.email && (
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                      <Mail className="w-3 h-3 text-gray-400" /> {selectedCustomer.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons inside Drawer Header */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(selectedCustomer)}
                  className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg cursor-pointer transition-all"
                  title="Düzəliş Et"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setDeleteId(selectedCustomer.id)}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition-all"
                    title="Müştərini Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tab navigation buttons */}
            <div className="flex border-b border-gray-100 text-xs font-bold text-gray-400">
              <button
                onClick={() => setDrawerTab("overview")}
                className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${drawerTab === "overview" ? "border-primary text-primary bg-primary/5" : "border-transparent hover:text-gray-900"}`}
              >
                İcmal
              </button>
              <button
                onClick={() => setDrawerTab("sales")}
                className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer relative ${drawerTab === "sales" ? "border-primary text-primary bg-primary/5" : "border-transparent hover:text-gray-900"}`}
              >
                Satışlar
                {customerSales && customerSales.length > 0 && (
                  <span className="ml-1 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.2 text-[9px] font-black">
                    {customerSales.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDrawerTab("activity")}
                className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${drawerTab === "activity" ? "border-primary text-primary bg-primary/5" : "border-transparent hover:text-gray-900"}`}
              >
                Aktivlik
                {getActivities(selectedCustomer.id).length > 0 && (
                  <span className="ml-1 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.2 text-[9px] font-black">
                    {getActivities(selectedCustomer.id).length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* === OVERVIEW TAB === */}
              {drawerTab === "overview" && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  {/* KPI Cards widget */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-center space-y-1 shadow-2xs">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Cəmi Alış</span>
                      <span className="text-sm font-black text-gray-800 font-mono">
                        {isSalesLoading ? "..." : `${totalPurchased.toFixed(2)} ₼`}
                      </span>
                    </div>

                    <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl text-center space-y-1 shadow-2xs">
                      <span className="text-[10px] text-red-500 uppercase tracking-wider block font-bold">Nisyə Borc</span>
                      <span className={`text-sm font-black font-mono ${totalDebt > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {isSalesLoading ? "..." : `${totalDebt.toFixed(2)} ₼`}
                      </span>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-center space-y-1 shadow-2xs">
                      <span className="text-[10px] text-amber-600 uppercase tracking-wider block font-bold">Loyallıq</span>
                      <span className="text-sm font-black text-amber-700 font-mono">
                        {(selectedCustomer.loyaltyPoints ?? 0).toFixed(1)} bal
                      </span>
                    </div>
                  </div>

                  {/* General details lists */}
                  <div className="space-y-4 bg-white border border-gray-100 p-4 rounded-xl shadow-3xs">
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-50 pb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" /> Profil Məlumatları
                    </h4>

                    <div className="space-y-3 text-xs font-semibold">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-400">Ünvan:</span>
                        <span className="text-gray-700 font-bold">{selectedCustomer.address || "Qeyd edilməyib"}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-t border-gray-50">
                        <span className="text-gray-400">Qeydiyyatçı:</span>
                        <span className="text-gray-600 font-bold">{selectedCustomer.createdByName || "Sistem"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Editable Notes Section */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-gray-400" /> Müştəri Qeydləri (CRM Notes)
                    </label>
                    <div className="relative group">
                      <textarea
                        defaultValue={selectedCustomer.notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (selectedCustomer.notes || "")) {
                            updateNotesMutation.mutate({ id: selectedCustomer.id, notes: e.target.value });
                          }
                        }}
                        placeholder="Müştəri haqqında daxili qeydlər daxil edin. Sahədən çıxdıqda avtomatik yadda saxlanılır..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/40 text-xs font-semibold leading-relaxed h-28 resize-none shadow-3xs group-hover:border-gray-300 transition-all"
                      />
                      <span className="absolute bottom-2.5 right-3 text-[9px] text-gray-300 group-focus-within:text-primary transition-all font-black flex items-center gap-0.5">
                        <Save className="w-2.5 h-2.5" /> Auto-Save
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* === SALES HISTORY TIMELINE TAB === */}
              {drawerTab === "sales" && (
                <div className="space-y-4 animate-in fade-in-0 duration-200">
                  {isSalesLoading ? (
                    <div className="text-center py-10 text-xs font-semibold text-gray-400">Yüklenir...</div>
                  ) : !customerSales || customerSales.length === 0 ? (
                    <div className="text-center py-12 text-xs font-semibold text-gray-400">Satış tarixçəsi boşdur.</div>
                  ) : (
                    <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-6">
                      {customerSales.map((sale) => {
                        const paid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0) || 0;
                        const debt = parseFloat(sale.totalAmount || "0") - paid;
                        const isExpanded = !!expandedSales[sale.id];
                        const dateFormatted = new Date(sale.saleDate).toLocaleDateString("az-AZ") + " " + new Date(sale.saleDate).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={sale.id} className="relative group">
                            {/* Dot indicator on timeline */}
                            <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary border-2 border-white ring-2 ring-primary/10 group-hover:bg-primary transition-all" />
                            
                            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-3xs hover:border-gray-200 transition-all space-y-2">
                              {/* Header info */}
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-800 font-mono">Qaimə #{sale.id}</span>
                                <span className="text-[10px] text-gray-400 font-bold">{dateFormatted}</span>
                              </div>

                              <div className="flex justify-between items-center text-xs">
                                <div className="space-y-0.5">
                                  <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-bold">Ödəniş Növü</span>
                                  <span className="font-bold text-gray-600">{sale.paymentType}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-bold">Məbləğ</span>
                                  <span className="font-black text-gray-900 font-mono">{parseFloat(sale.totalAmount).toFixed(2)} ₼</span>
                                </div>
                              </div>

                              {/* Debt warning tag */}
                              {debt > 0 && (
                                <div className="bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg flex items-center justify-between text-[10px] font-bold text-red-600">
                                  <span>Ödənilməmiş borc:</span>
                                  <span className="font-black font-mono">{debt.toFixed(2)} ₼</span>
                                </div>
                              )}

                              {/* Collapsing products toggle */}
                              <button
                                onClick={() => setExpandedSales(prev => ({ ...prev, [sale.id]: !isExpanded }))}
                                className="w-full pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] font-black text-primary cursor-pointer hover:text-primary-dark transition-all"
                              >
                                <span>{sale.items?.length || 0} məhsul</span>
                                <span className="flex items-center gap-0.5">
                                  Göstər {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </span>
                              </button>

                              {/* Collapsed items list */}
                              {isExpanded && sale.items && (
                                <div className="pt-2 space-y-1.5 border-t border-gray-50 bg-gray-50/30 p-2 rounded-lg animate-in fade-in-0 duration-200">
                                  {sale.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-start text-[10px] font-semibold text-gray-600">
                                      <div className="max-w-[180px] truncate">
                                        <span>{item.product?.name || "Məhsul"}</span>
                                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                                          <div className="text-[8px] text-gray-400 font-mono mt-0.2">IMEI: {item.serialNumbers.join(", ")}</div>
                                        )}
                                      </div>
                                      <span className="font-mono">{item.quantity} {item.product?.unit || "ədəd"} × {parseFloat(item.price).toFixed(2)} ₼</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* === ACTIVITY LOGS TAB === */}
              {drawerTab === "activity" && (
                <div className="space-y-5 animate-in fade-in-0 duration-200">
                  {/* Quick Activity Creator */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Yeni Aktivlik Qeyd Et</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Məs. Zəng edib nisyə borcu xatırlatdım..."
                        value={newActivity}
                        onChange={(e) => setNewActivity(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addActivityLog(selectedCustomer.id, newActivity);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-semibold bg-gray-50/50"
                      />
                      <button
                        onClick={() => addActivityLog(selectedCustomer.id, newActivity)}
                        className="px-3 bg-primary text-white font-bold rounded-xl cursor-pointer hover:bg-primary/90 transition-all flex items-center justify-center"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Activity Timeline List */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Fəaliyyət Tarixçəsi
                    </h4>

                    {(() => {
                      const logs = getActivities(selectedCustomer.id);
                      if (logs.length === 0) {
                        return (
                          <div className="bg-gray-50 border border-dashed border-gray-200 p-6 text-center text-xs font-semibold text-gray-400 rounded-xl">
                            Müştəri ilə bağlı heç bir aktivlik loqu yoxdur.
                          </div>
                        );
                      }
                      return (
                        <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-5">
                          {logs.map((log: any) => (
                            <div key={log.id} className="relative group">
                              <span className="absolute -left-[20px] top-1.5 size-2 rounded-full bg-gray-300 group-hover:bg-primary transition-all" />
                              <div className="space-y-0.5 text-xs font-semibold leading-relaxed">
                                <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                                  <span>{log.author}</span>
                                  <span>{new Date(log.date).toLocaleDateString("az-AZ") + " " + new Date(log.date).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-gray-700 leading-normal">{log.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 1. EDIT / CREATE MODAL */}
      {isOpen && (
        <div className="liquid-glass-overlay !z-100">
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
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-base leading-tight">Silməyi təsdiqləyin</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Bu müştəri profilini silmək istədiyinizə əminsiniz? Müştərinin əvvəlki satış qaimələri sistemdə qalacak, lakin profil tamamilə silinəcəkdir.
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
