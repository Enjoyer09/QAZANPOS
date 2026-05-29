import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, PlusCircle, CheckCircle, Info } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

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

const paymentTypes = ["Nəğd", "Kart", "Kart2Kart", "Nisyə"];

const paymentBadges: Record<string, string> = {
  Nəğd: "bg-green-50 text-green-700 border-green-100",
  Kart: "bg-blue-50 text-blue-700 border-blue-100",
  Kart2Kart: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Nisyə: "bg-amber-50 text-amber-700 border-amber-100",
};

export default function StockIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState(emptyEntry);
  const [isSuccess, setIsSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

    const payload = {
      productId: parseInt(formData.productId),
      quantity: parseFloat(formData.quantity),
      purchasePrice: parseFloat(formData.purchasePrice),
      supplier: formData.supplier || null,
      notes: formData.notes || null,
      paymentType: formData.paymentType,
      creditDueDate: isCredit ? formData.creditDueDate : null,
      vendorId: formData.vendorId ? parseInt(formData.vendorId) : null,
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
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsul *</label>
              <select
                value={formData.productId}
                onChange={(e) => setFormData((prev) => ({ ...prev, productId: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                required
              >
                <option value="">Məhsul seçin...</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
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
                  <th className="py-3 px-2 text-right pr-4">Tarix</th>
                </tr>
              </thead>
              <tbody>
                {isEntriesLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                      Yüklənir...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-gray-400">
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
                      <td className="py-3 px-2 text-right text-gray-400 pr-4">
                        {new Date(entry.entryDate).toLocaleDateString("az-AZ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
