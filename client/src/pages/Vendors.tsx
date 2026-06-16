import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  FileText,
  Calendar,
  CreditCard,
  Notebook,
  History,
  Trash2,
  Edit2,
  Lock
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface Vendor {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  totalPurchases: number;
  totalPaid: number;
  balance: number; // outstanding debt we owe
}

interface VendorPayment {
  id: number;
  amount: number;
  paymentDate: string;
  paymentType: string;
  notes: string;
}

export default function Vendors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [activeTab, setActiveTab] = useState<"directory" | "ledger">("directory");
  const [searchTerm, setSearchTerm] = useState("");
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  
  // Ledger Pagination & Filter States
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");
  const [ledgerPageSize, setLedgerPageSize] = useState(10);
  const [ledgerPage, setLedgerPage] = useState(1);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });

  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentType: "Nəğd",
    notes: "",
    paymentDate: new Date().toISOString().split("T")[0]
  });

  // Query vendors
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Tədarükçüləri yükləyərkən xəta baş verdi");
      return res.json();
    }
  });

  // Query payments for selected vendor
  const { data: activePayments = [] } = useQuery<VendorPayment[]>({
    queryKey: [`/api/vendors/${selectedVendor?.id}/payments`],
    queryFn: async () => {
      const res = await fetch(`/api/vendors/${selectedVendor?.id}/payments`);
      if (!res.ok) throw new Error("Ödəniş tarixçəsini yükləyərkən xəta baş verdi");
      return res.json();
    },
    enabled: !!selectedVendor,
  });

  // Query all vendor payments globally (wholesale payouts ledger)
  const { data: globalPayments = [], isLoading: isLedgerLoading } = useQuery<any[]>({
    queryKey: ["/api/vendors/payments"],
    queryFn: async () => {
      const res = await fetch("/api/vendors/payments");
      if (!res.ok) throw new Error("Ödəniş tarixçəsini yükləyərkən xəta baş verdi");
      return res.json();
    },
    enabled: activeTab === "ledger",
  });

  // Query all stock entries globally to list purchases
  const { data: stockEntries = [], isLoading: isEntriesLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/entries"],
    queryFn: async () => {
      const res = await fetch("/api/stock/entries");
      if (!res.ok) throw new Error("Mədaxilləri yükləyərkən xəta baş verdi");
      return res.json();
    },
  });

  // Mutation to create vendor
  const createVendorMutation = useMutation({
    mutationFn: async (newVendor: typeof formData) => {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVendor),
      });
      if (!res.ok) throw new Error("Fərdi xəta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsAddModalOpen(false);
      setFormData({ name: "", phone: "", email: "", address: "", notes: "" });
      toast({
        title: "Tədarükçü Əlavə Edildi 👍",
        description: "Yeni topdansatış tədarükçüsü uğurla kataloqa daxil edildi.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Tədarükçü əlavə edilərkən texniki problem yarandı.",
        variant: "destructive",
      });
    }
  });

  // Mutation to log vendor payment
  const logPaymentMutation = useMutation({
    mutationFn: async (payload: { amount: number; paymentType: string; notes: string; paymentDate?: string }) => {
      const res = await fetch(`/api/vendors/${selectedVendor?.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Fərdi xəta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/payments"] });
      if (selectedVendor) {
        queryClient.invalidateQueries({ queryKey: [`/api/vendors/${selectedVendor.id}/payments`] });
      }
      setIsPayModalOpen(false);
      setPaymentData({ amount: "", paymentType: "Nəğd", notes: "", paymentDate: new Date().toISOString().split("T")[0] });
      toast({
        title: "Ödəniş Qeydə Alındı 💳",
        description: "Tədarükçüyə edilən ödəniş uğurla balansdan çıxıldı.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Ödəniş qeydə alınarkən texniki problem yarandı.",
        variant: "destructive",
      });
    }
  });

  // Handle Add Supplier Submission
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createVendorMutation.mutate(formData);
  };

  // Handle Log Payment Submission
  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      return toast({
        title: "Yanlış Məbləğ",
        description: "Zəhmət olmasa düzgün ödəniş məbləği daxil edin.",
        variant: "destructive",
      });
    }
    logPaymentMutation.mutate({
      amount,
      paymentType: paymentData.paymentType,
      notes: paymentData.notes,
      paymentDate: new Date(paymentData.paymentDate).toISOString()
    });
  };

  // Search filter
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone && v.phone.includes(searchTerm))
  );

  // Filter global payments by search term and date range
  const filteredGlobalPayments = globalPayments.filter((p: any) => {
    // 1. Search term filter
    const matchesSearch = 
      !ledgerSearchTerm ||
      p.vendorName.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(ledgerSearchTerm.toLowerCase())) ||
      p.paymentType.toLowerCase().includes(ledgerSearchTerm.toLowerCase());

    // 2. Start date filter
    let matchesStartDate = true;
    if (ledgerStartDate) {
      const pDate = new Date(p.paymentDate);
      const sDate = new Date(ledgerStartDate + "T00:00:00");
      matchesStartDate = pDate >= sDate;
    }

    // 3. End date filter
    let matchesEndDate = true;
    if (ledgerEndDate) {
      const pDate = new Date(p.paymentDate);
      const eDate = new Date(ledgerEndDate + "T23:59:59");
      matchesEndDate = pDate <= eDate;
    }

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // Paginated global payments
  const totalFilteredLedger = filteredGlobalPayments.length;
  const totalLedgerPages = Math.ceil(totalFilteredLedger / ledgerPageSize) || 1;
  
  // Adjust current page if it exceeds total pages due to filtering
  const currentLedgerPage = Math.min(ledgerPage, totalLedgerPages);
  
  const paginatedGlobalPayments = filteredGlobalPayments.slice(
    (currentLedgerPage - 1) * ledgerPageSize,
    currentLedgerPage * ledgerPageSize
  );

  const handleResetLedgerFilters = () => {
    setLedgerSearchTerm("");
    setLedgerStartDate("");
    setLedgerEndDate("");
    setLedgerPageSize(10);
    setLedgerPage(1);
  };

  // Computed aggregate metrics
  const totalVendors = vendors.length;
  const totalOutstandingDebts = vendors.reduce((acc, v) => acc + v.balance, 0);
  const totalPaidToVendors = vendors.reduce((acc, v) => acc + v.totalPaid, 0);

  if (user?.role !== "Admin" && currentUser?.staffCanViewVendors === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-in fade-in-0 duration-300">
        <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 glass-card relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-gray-900">Tədarükçü Uçotuna Giriş Məhdudlaşdırılıb 🔒</h3>
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 select-none">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
            <Truck className="w-3 h-3" />
            <span>Tədarük & Maya Dəyəri</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">🤝 Tədarükçülər və Topdansatış Uçotu</h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">Topdansatış firmalarını izləyin, anbar satınalma öhdəliklərini (borcları) və ödənişləri idarə edin.</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/95 text-white font-black rounded-2xl shadow-lg shadow-primary/20 text-xs tracking-wider uppercase cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Tədarükçü 🤝</span>
        </button>
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Cəmi Tədarükçülər</span>
            <span className="text-xl font-black text-gray-900 block mt-0.5">{totalVendors} firma</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="size-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Tədarükçülərə Borcumuz</span>
            <span className="text-xl font-black text-red-600 block mt-0.5">{totalOutstandingDebts.toFixed(2)} ₼</span>
          </div>
          {totalOutstandingDebts > 0 && (
            <span className="absolute top-4 right-4 size-2.5 rounded-full bg-red-500 animate-pulse"></span>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Cəmi Ödənilən (Wholesale)</span>
            <span className="text-xl font-black text-emerald-600 block mt-0.5">{totalPaidToVendors.toFixed(2)} ₼</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "directory"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Truck className="w-4 h-4" />
          Tədarükçü Siyahısı
        </button>
        <button
          onClick={() => {
            setActiveTab("ledger");
            setLedgerSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "ledger"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <History className="w-4 h-4" />
          Ödəniş Tarixçəsi
        </button>
      </div>

      {activeTab === "directory" ? (
        /* Directory Content Workspace */
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tədarükçü adı və ya telefon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-primary transition-all text-gray-700"
              />
            </div>
          </div>

          {/* Vendors Directory Table */}
          {isLoading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Məlumatlar yüklənir...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Tədarükçü tapılmadı.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-4">Tədarükçü Firma</th>
                    <th className="py-3.5 px-4">Əlaqə Məlumatları</th>
                    <th className="py-3.5 px-4 text-right">Cəmi Alış Dövriyyəsi</th>
                    <th className="py-3.5 px-4 text-right">Ödənilən Məbləğ</th>
                    <th className="py-3.5 px-4 text-right">Mövcud Qalıq Borc</th>
                    <th className="py-3.5 px-4 text-center">Əməliyyatlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-600">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Brand Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center font-black">
                            {vendor.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-black text-gray-900 leading-tight">{vendor.name}</span>
                            <span className="block text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-wide">
                              Qeydiyyat: {new Date(vendor.createdAt).toLocaleDateString("az-AZ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contacts info */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-gray-500 font-medium">
                          {vendor.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span>{vendor.phone}</span>
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-[10px] truncate max-w-[150px]">{vendor.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Dövriyyə */}
                      <td className="py-4 px-4 text-right text-gray-800 font-mono">
                        {vendor.totalPurchases.toFixed(2)} ₼
                      </td>

                      {/* Ödənilən */}
                      <td className="py-4 px-4 text-right text-emerald-600 font-mono">
                        {vendor.totalPaid.toFixed(2)} ₼
                      </td>

                      {/* Qalıq Borc */}
                      <td className="py-4 px-4 text-right">
                        {vendor.balance > 0 ? (
                          <div className="inline-flex items-center gap-1.5 font-mono text-red-600 font-black">
                            <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            <span>{vendor.balance.toFixed(2)} ₼</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-normal">Borc yoxdur</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setIsPayModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Ödəniş et 💸
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setIsPurchasesModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Alışlar 📦</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setLedgerSearchTerm(vendor.name);
                              setActiveTab("ledger");
                            }}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            <span>Tarixçə</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Global Payments Ledger Workspace */
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 space-y-4">
          {/* Advanced Premium Filter Panel */}
          <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Axtarış</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Firma, qeyd və s..."
                  value={ledgerSearchTerm}
                  onChange={(e) => {
                    setLedgerSearchTerm(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-all text-gray-700 font-bold"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Başlanğıc Tarix</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => {
                    setLedgerStartDate(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-all text-gray-700 font-mono font-bold"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Son Tarix</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(e) => {
                    setLedgerEndDate(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-all text-gray-700 font-mono font-bold"
                />
              </div>
            </div>

            {/* Page Size & Reset */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Səhifədə Say</label>
                <select
                  value={ledgerPageSize}
                  onChange={(e) => {
                    setLedgerPageSize(Number(e.target.value));
                    setLedgerPage(1);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-all text-gray-700 cursor-pointer font-bold"
                >
                  <option value={10}>10 sətir</option>
                  <option value={20}>20 sətir</option>
                  <option value={50}>50 sətir</option>
                  <option value={100}>100 sətir</option>
                </select>
              </div>

              {(ledgerSearchTerm || ledgerStartDate || ledgerEndDate || ledgerPageSize !== 10) && (
                <button
                  type="button"
                  onClick={handleResetLedgerFilters}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer self-end border border-red-100"
                  title="Süzgəcləri Təmizlə"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>

          {/* Ledger Table */}
          {isLedgerLoading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Məlumatlar yüklənir...</div>
          ) : paginatedGlobalPayments.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Heç bir ödəniş tapılmadı.</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-gray-50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-3.5 px-4">Tədarükçü Firma</th>
                      <th className="py-3.5 px-4">Ödəniş Tarixi</th>
                      <th className="py-3.5 px-4">Ödəniş Üsulu</th>
                      <th className="py-3.5 px-4">Ödəniş Qeydi</th>
                      <th className="py-3.5 px-4 text-right">Borcdan Silinən Məbləğ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-600">
                    {paginatedGlobalPayments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                              {payment.vendorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-black text-gray-900 leading-tight">{payment.vendorName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-500 font-mono">
                          {new Date(payment.paymentDate).toLocaleDateString("az-AZ")} | {new Date(payment.paymentDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold">
                            <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                            {payment.paymentType}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-500 italic max-w-xs truncate">
                          {payment.notes ? `"${payment.notes}"` : "-"}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-emerald-600 font-black">
                          -{payment.amount.toFixed(2)} ₼
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalFilteredLedger > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    Göstərilir: <span className="text-gray-900 font-black">{Math.min((currentLedgerPage - 1) * ledgerPageSize + 1, totalFilteredLedger)}</span> - <span className="text-gray-900 font-black">{Math.min(currentLedgerPage * ledgerPageSize, totalFilteredLedger)}</span> / <span className="text-gray-900 font-black">{totalFilteredLedger}</span> ödəniş
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLedgerPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentLedgerPage === 1}
                      className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold border border-gray-200/60 rounded-xl text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ◀ Əvvəlki
                    </button>
                    
                    {Array.from({ length: totalLedgerPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalLedgerPages || Math.abs(p - currentLedgerPage) <= 1)
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span className="text-gray-400 px-1 font-bold">...</span>}
                            <button
                              type="button"
                              onClick={() => setLedgerPage(p)}
                              className={`size-9 flex items-center justify-center font-black rounded-xl text-[10px] tracking-wider transition-all cursor-pointer ${
                                currentLedgerPage === p
                                  ? "bg-primary text-white shadow-md shadow-primary/10"
                                  : "bg-white hover:bg-gray-50 text-gray-600 border border-gray-100"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      type="button"
                      onClick={() => setLedgerPage(prev => Math.min(prev + 1, totalLedgerPages))}
                      disabled={currentLedgerPage === totalLedgerPages}
                      className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold border border-gray-200/60 rounded-xl text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Növbəti ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: YENİ TƏDARÜKÇÜ */}
      {isAddModalOpen && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3 text-left">
              <Truck className="w-5 h-5 text-primary" />
              <span>Yeni Topdansatış Tədarükçüsü</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Firma / Tədarükçü Adı *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Məsələn: Sun Food MMC"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Telefon Nömrəsi</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+994 50 123 45 67"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">E-Poçt Ünvanı</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@sunfood.az"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Fiziki Ünvan</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Bakı şəhəri, Nizami r-nu"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Qeydlər / Şərhlər</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Çatdırılma günləri, daxili şərtlər..."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-wide transition-all cursor-pointer text-center"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={createVendorMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer text-center shadow-md shadow-primary/10 hover-elevate"
                >
                  {createVendorMutation.isPending ? "Yaradılır..." : "Tədarükçünü Yarat 👍"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TƏDARÜKÇÜYƏ ÖDƏNİŞ ET */}
      {isPayModalOpen && selectedVendor && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3 text-left">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>Tədarükçüyə Ödəniş</span>
            </h3>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left text-xs font-semibold space-y-2 mt-4">
              <div className="flex justify-between text-gray-600">
                <span>Firma:</span>
                <span className="text-gray-950 font-black">{selectedVendor.name}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Mövcud Borcumuz:</span>
                <span className="text-red-600 font-black font-mono text-sm">{selectedVendor.balance.toFixed(2)} ₼</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 pt-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Ödənilən Məbləğ (₼) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={selectedVendor.balance}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder="Məsələn: 150.00"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all font-mono"
                />
              </div>

              {/* Payment Date Selector Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Ödəniş Tarixi *</label>
                <input
                  type="date"
                  required
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Ödəniş Üsulu</label>
                <select
                  value={paymentData.paymentType}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all cursor-pointer"
                >
                  <option value="Nəğd">Nəğd Pul 💵</option>
                  <option value="Kart">Bank Kartı 💳</option>
                  <option value="Kart2Kart">Kartdan-Karta 📲</option>
                  <option value="Köçürmə">Bank Köçürməsi 🏢</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 block mb-1">Ödəniş Qeydi</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Qəbz nömrəsi, bank transfer qeydi..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white text-gray-900 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-wide transition-all cursor-pointer text-center"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={logPaymentMutation.isPending}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer text-center shadow-md shadow-emerald-600/10 hover-elevate"
                >
                  {logPaymentMutation.isPending ? "Ödənilir..." : "Ödənişi Qeyd Et 💸"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TƏDARÜKÇÜ ALIŞLARI (MƏDAXİLLƏR) */}
      {isPurchasesModalOpen && selectedVendor && (() => {
        const vendorPurchases = stockEntries.filter(
          (entry) =>
            entry.vendorId === selectedVendor.id ||
            (entry.supplier && entry.supplier.toLowerCase().trim() === selectedVendor.name.toLowerCase().trim())
        );

        return (
          <div className="liquid-glass-overlay">
            <div className="liquid-glass-card max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3 text-left">
                <Truck className="w-5 h-5 text-primary" />
                <span>Alış Tarixçəsi: {selectedVendor.name}</span>
              </h3>

              <div className="py-4 text-left">
                {isEntriesLoading ? (
                  <div className="text-center py-8 text-xs text-gray-400 font-bold uppercase tracking-wider">
                    Məlumatlar yüklənir...
                  </div>
                ) : vendorPurchases.length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-400 italic">
                    Bu tədarükçüdən hələ heç bir mal mədaxili edilməyib.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-50 max-h-[50vh]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 sticky top-0 z-10">
                          <th className="py-3 px-4">Mədaxil №</th>
                          <th className="py-3 px-4">Tarix</th>
                          <th className="py-3 px-4">Məhsul</th>
                          <th className="py-3 px-4 text-right">Miqdar</th>
                          <th className="py-3 px-4 text-right">Alış Qiyməti</th>
                          <th className="py-3 px-4 text-right">Cəmi Məbləğ</th>
                          <th className="py-3 px-4 text-center">Ödəniş</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 font-bold text-gray-600">
                        {vendorPurchases.map((entry: any) => (
                          <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                            <td 
                              onClick={() => setSelectedPurchase(entry)}
                              className="py-3 px-4 font-mono font-bold text-primary cursor-pointer hover:underline"
                            >
                              #{entry.id.toString().padStart(5, "0")}
                            </td>
                            <td 
                              onClick={() => setSelectedPurchase(entry)}
                              className="py-3 px-4 text-primary font-mono cursor-pointer hover:underline"
                            >
                              {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString("az-AZ") : "-"}
                            </td>
                            <td className="py-3 px-4 text-gray-900">
                              {entry.productName}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-gray-800">
                              {entry.quantity} {entry.unit || "ədəd"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-gray-750">
                              {parseFloat(entry.purchasePrice || 0).toFixed(2)} ₼
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-gray-950">
                              {(parseFloat(entry.quantity) * parseFloat(entry.purchasePrice || 0)).toFixed(2)} ₼
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                entry.paymentType === "Nisyə" && entry.paidStatus !== "paid"
                                  ? "bg-red-50 text-red-700 border border-red-150"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-150"
                              }`}>
                                {entry.paymentType === "Nisyə" && entry.paidStatus !== "paid" ? "Borc" : "Ödənilib"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsPurchasesModalOpen(false);
                    setSelectedVendor(null);
                  }}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer text-center"
                >
                  Bağla
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: ALIŞ QAİMƏSİ / İCMAL */}
      {selectedPurchase && (
        <div className="liquid-glass-overlay !z-[99] animate-in fade-in-0 duration-200">
          <div className="liquid-glass-card max-w-lg w-full p-6 space-y-6 text-left relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-emerald-500"></div>
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black text-primary uppercase tracking-wider block">Mədaxil İcmalı</span>
                <h3 className="text-lg font-black text-gray-950 tracking-tight mt-0.5">
                  Alış Qaiməsi №{selectedPurchase.id.toString().padStart(5, "0")}
                </h3>
              </div>
              <span className="text-xs text-gray-400 font-mono font-bold">
                {selectedPurchase.entryDate ? new Date(selectedPurchase.entryDate).toLocaleDateString("az-AZ") : "-"}
              </span>
            </div>

            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-3 text-xs font-bold text-gray-600">
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-400">Tədarükçü:</span>
                <span className="text-gray-900">{selectedVendor?.name || selectedPurchase.supplier || "Qeyd olunmayıb"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-400">Ödəniş Növü:</span>
                <span className="text-gray-900">{selectedPurchase.paymentType}</span>
              </div>
              {selectedPurchase.paymentType === "Kart" && selectedPurchase.bankName && (
                <div className="flex justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-400">Bank:</span>
                  <span className="text-gray-900">{selectedPurchase.bankName}</span>
                </div>
              )}
              {selectedPurchase.paymentType === "Nisyə" && selectedPurchase.creditDueDate && (
                <div className="flex justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-400">Son Ödəniş Tarixi:</span>
                  <span className="text-gray-900 font-mono">
                    {new Date(selectedPurchase.creditDueDate).toLocaleDateString("az-AZ")}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-400">Vergi Rejimi (ƏDV):</span>
                <span className="text-gray-900">
                  {selectedPurchase.applyEdv === 1 ? "18% ƏDV Daxil" : "ƏDV-siz (Azad)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ödəniş Statusu:</span>
                <span className={selectedPurchase.paymentType === "Nisyə" && selectedPurchase.paidStatus !== "paid" ? "text-red-600" : "text-emerald-600"}>
                  {selectedPurchase.paymentType === "Nisyə" && selectedPurchase.paidStatus !== "paid" ? "Borc (Ödənilməyib)" : "Ödənilib"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Məhsulların Siyahısı</span>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-2.5 px-4">Məhsul</th>
                      <th className="py-2.5 px-4 text-right">Miqdar</th>
                      <th className="py-2.5 px-4 text-right">Alış Qiyməti</th>
                      <th className="py-2.5 px-4 text-right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-bold text-gray-700">
                    <tr>
                      <td className="py-3 px-4 text-gray-950">{selectedPurchase.productName}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-800">
                        {selectedPurchase.quantity} {selectedPurchase.unit || "ədəd"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-750">
                        {parseFloat(selectedPurchase.purchasePrice || 0).toFixed(2)} ₼
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-950">
                        {(parseFloat(selectedPurchase.quantity) * parseFloat(selectedPurchase.purchasePrice || 0)).toFixed(2)} ₼
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Serial Numbers / IMEIs if present */}
            {selectedPurchase.serialNumbers && selectedPurchase.serialNumbers.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                  Mədaxil Edilən Serial Nömrələri (IMEI)
                </span>
                <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-3 max-h-[120px] overflow-y-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPurchase.serialNumbers.map((sn: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-white border border-blue-100 text-blue-700 font-mono font-bold text-[9px] rounded-lg shadow-2xs">
                        {sn}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedPurchase.notes && (
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Məxaric / Mədaxil Qeydi</span>
                <p className="text-xs text-gray-500 font-semibold bg-gray-50 border border-gray-100 rounded-xl p-3 leading-relaxed">
                  {selectedPurchase.notes}
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedPurchase(null)}
              className="w-full py-3 bg-gray-950 text-white font-bold rounded-xl text-xs uppercase tracking-wide hover:bg-black transition-all cursor-pointer shadow-md shadow-black/10 hover-elevate"
            >
              Bağla
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
