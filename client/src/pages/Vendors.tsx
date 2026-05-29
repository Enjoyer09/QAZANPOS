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
  Edit2
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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

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
    notes: ""
  });

  // Query vendors
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  // Query payments for selected vendor
  const { data: activePayments = [] } = useQuery<VendorPayment[]>({
    queryKey: [`/api/vendors/${selectedVendor?.id}/payments`],
    enabled: !!selectedVendor,
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
    mutationFn: async (payload: { amount: number; paymentType: string; notes: string }) => {
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
      if (selectedVendor) {
        queryClient.invalidateQueries({ queryKey: [`/api/vendors/${selectedVendor.id}/payments`] });
      }
      setIsPayModalOpen(false);
      setPaymentData({ amount: "", paymentType: "Nəğd", notes: "" });
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
      notes: paymentData.notes
    });
  };

  // Search filter
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone && v.phone.includes(searchTerm))
  );

  // Computed aggregate metrics
  const totalVendors = vendors.length;
  const totalOutstandingDebts = vendors.reduce((acc, v) => acc + v.balance, 0);
  const totalPaidToVendors = vendors.reduce((acc, v) => acc + v.totalPaid, 0);

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

      {/* Directory Content Workspace */}
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
                            setIsHistoryModalOpen(true);
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

      {/* MODAL 1: YENİ TƏDARÜKÇÜ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-100 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-3xl w-full max-w-md shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3 text-left">
              <Truck className="w-5 h-5 text-primary" />
              <span>Yeni Topdansatış Tədarükçüsü</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-left">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Firma / Tədarükçü Adı *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Məsələn: Sun Food MMC"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Telefon Nömrəsi</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+994 50 123 45 67"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">E-Poçt Ünvanı</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@sunfood.az"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Fiziki Ünvan</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Bakı şəhəri, Nizami r-nu"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Qeydlər / Şərhlər</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Çatdırılma günləri, daxili şərtlər..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={createVendorMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
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
        <div className="fixed inset-0 z-100 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3 text-left">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>Tədarükçüyə Ödəniş</span>
            </h3>

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-left text-xs font-bold space-y-1.5 mt-4">
              <div className="flex justify-between text-gray-400">
                <span>Firma:</span>
                <span className="text-gray-900 font-black">{selectedVendor.name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Mövcud Borcumuz:</span>
                <span className="text-red-600 font-black font-mono">{selectedVendor.balance.toFixed(2)} ₼</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 pt-4 text-left">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ödənilən Məbləğ (₼) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={selectedVendor.balance}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder="Məsələn: 150.00"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ödəniş Üsulu</label>
                <select
                  value={paymentData.paymentType}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentType: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                >
                  <option value="Nəğd">Nəğd Pul 💵</option>
                  <option value="Kart">Bank Kartı 💳</option>
                  <option value="Kart2Kart">Kartdan-Karta 📲</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ödəniş Qeydi</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Qəbz nömrəsi, bank transfer qeydi..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={logPaymentMutation.isPending}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {logPaymentMutation.isPending ? "Ödənilir..." : "Ödənişi Qeyd Et 💸"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ÖDƏNİŞ TARİXÇƏSİ */}
      {isHistoryModalOpen && selectedVendor && (
        <div className="fixed inset-0 z-100 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-3xl w-full max-w-md shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 text-left">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <History className="w-5 h-5 text-gray-700" />
              <span>{selectedVendor.name} - Ödəniş Tarixçəsi</span>
            </h3>

            <div className="max-h-[300px] overflow-y-auto space-y-2 mt-4 pr-1">
              {activePayments.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Heç bir ödəniş edilməyib.</div>
              ) : (
                activePayments.map((p) => (
                  <div key={p.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between text-xs font-bold">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                        <span>Növ: {p.paymentType}</span>
                      </div>
                      {p.notes && <span className="block text-[10px] text-gray-400 font-medium">Qeyd: {p.notes}</span>}
                      <span className="block text-[8px] text-gray-400 font-mono">
                        Tarix: {new Date(p.paymentDate).toLocaleString("az-AZ")}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-600 font-black font-mono">-{p.amount.toFixed(2)} ₼</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-full py-3 bg-gray-950 hover:bg-gray-800 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
