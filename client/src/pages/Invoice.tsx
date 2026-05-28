import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Printer, CreditCard, Check, CheckCircle2, RotateCw, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { printReceipt } from "../components/ReceiptPrint.tsx";

interface InvoiceProps {
  params: { id: string };
}

export default function Invoice({ params }: InvoiceProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saleId = parseInt(params.id);
  const [payAmount, setPayAmount] = useState("");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItemsState, setReturnItemsState] = useState<Record<number, { quantity: number; status: "returned_to_stock" | "defective" }>>({});
  const [returnReason, setReturnReason] = useState("");

  // Query
  const { data: invoice, isLoading, error } = useQuery<any>({
    queryKey: ["/api/sales", saleId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${saleId}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Query Settings
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Mutations
  const returnMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Geri qaytarış xətası");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Uğurlu!", description: "Geri qaytarış uğurla qeydə alındı!", variant: "success" });
      setShowReturnModal(false);
      setReturnItemsState({});
      setReturnReason("");
    },
    onError: (err: any) => {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    },
  });

  const fullPayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sales/${saleId}/pay-credit`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Uğurlu!", description: "Borc tamamilə ödənildi.", variant: "success" });
    },
  });

  const partialPayMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`/api/sales/${saleId}/add-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ödəniş uğursuz oldu");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Ödəniş qəbul edildi!", description: "Qalıq borc yeniləndi.", variant: "success" });
      setPayAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    },
  });

  const handlePartialPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Xəta!", description: "Düzgün məbləğ daxil edin.", variant: "destructive" });
      return;
    }
    partialPayMutation.mutate(amount);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(returnItemsState)
      .filter(([_, state]) => state.quantity > 0)
      .map(([pIdStr, state]) => {
        const productId = parseInt(pIdStr);
        const originallySold = invoice.items.find((i: any) => i.productId === productId);
        return {
          productId,
          quantity: state.quantity,
          salePrice: originallySold.salePrice,
          purchasePrice: originallySold.purchasePrice,
          status: state.status,
        };
      });

    if (items.length === 0) {
      toast({ title: "Xəta!", description: "Ən azı bir məhsulun miqdarını daxil edin", variant: "destructive" });
      return;
    }

    returnMutation.mutate({
      saleId,
      reason: returnReason.trim() || null,
      items,
    });
  };

  const [printingReceipt, setPrintingReceipt] = useState(false);

  const handlePrintReceipt = async () => {
    if (!invoice) return;
    setPrintingReceipt(true);
    try {
      const success = await printReceipt(invoice, settings);
      if (success) {
        toast({
          title: "Çap qoşuldu",
          description: "Termal qəbz uğurla çapa göndərildi.",
          variant: "success",
        });
      } else {
        toast({
          title: "Xəta!",
          description: "Çap əməliyyatı brauzer və ya QZ Tray vasitəsilə tamamlanmadı.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Xəta!",
        description: "Çap zamanı gözlənilməz xəta baş verdi.",
        variant: "destructive",
      });
    } finally {
      setPrintingReceipt(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <div className="text-xs text-gray-400">Yüklənir...</div>;
  if (error || !invoice) return <div className="text-xs text-red-500">Qaimə tapılmadı.</div>;

  const isCredit = invoice.paymentStatus === "credit";

  // Calculate totals dynamically and robustly
  const totalAmount = parseFloat(invoice.totalAmount) || 0;
  const totalPaid = invoice.paymentStatus === "paid"
    ? totalAmount
    : (invoice.payments || []).reduce((acc: number, p: any) => acc + (parseFloat(p.amount) || 0), 0);
  const remainingDebt = invoice.paymentStatus === "paid"
    ? 0
    : Math.max(0, totalAmount - totalPaid);

  // Helper to calculate returned quantity for a specific product in this invoice
  const getReturnedQty = (productId: number) => {
    if (!invoice || !invoice.returns) return 0;
    return invoice.returns.reduce((sum: number, ret: any) => {
      const item = (ret.items || []).find((i: any) => i.productId === productId);
      return sum + (item ? item.quantity : 0);
    }, 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in-0 print:p-0 print:bg-white print:shadow-none">
      {/* Header controls (Hidden in Print) */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/satislar">
            <button className="p-2 border border-gray-200 hover:border-gray-300 text-gray-500 rounded-xl cursor-pointer bg-white transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Qaimə Əməliyyatları</h2>
            <p className="text-xs text-gray-400 mt-1">
              Qaimə #{invoice.id.toString().padStart(5, "0")} details
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              // Initialize return items map with 0 quantity and normal return status
              const initialMap: Record<number, { quantity: number; status: "returned_to_stock" | "defective" }> = {};
              invoice.items.forEach((item: any) => {
                initialMap[item.productId] = { quantity: 0, status: "returned_to_stock" };
              });
              setReturnItemsState(initialMap);
              setShowReturnModal(true);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl cursor-pointer flex items-center gap-2 shadow-md shadow-amber-500/10 transition-all hover-elevate"
          >
            <RotateCw className="w-4 h-4" /> Geri Qaytarış 🔄
          </button>
          <button
            onClick={handlePrintReceipt}
            disabled={printingReceipt}
            className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-semibold text-sm rounded-xl cursor-pointer flex items-center gap-2 shadow-md shadow-black/10 transition-all hover-elevate disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Qəbzi Çap Et (Termal)
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 cursor-pointer flex items-center gap-2 shadow-md shadow-primary/10 transition-all hover-elevate"
          >
            <Printer className="w-4 h-4" /> Qaiməni Çap Et
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Printable Qaimə Card */}
        <div
          id="qazan-invoice-card"
          className="lg:col-span-2 bg-white border border-gray-100 p-8 rounded-2xl shadow-xs glass-card print:border-0 print:shadow-none print:p-0 print:bg-transparent"
        >
          {/* Print specific custom styles */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #qazan-invoice-card, #qazan-invoice-card * {
                  visibility: visible;
                }
                #qazan-invoice-card {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
              }
            `
          }} />

          {/* Invoice Header */}
          <div className="flex justify-between items-start pb-6 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base">
                  Q
                </div>
                <h3 className="font-extrabold text-lg text-gray-950">{settings?.storeName || "Qazan POS"}</h3>
              </div>
              {settings?.phone && <p className="text-[10px] text-gray-400 font-medium">Əlaqə: {settings.phone}</p>}
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{settings?.address || "Bakı, Azərbaycan"}</p>
            </div>

            <div className="text-right">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                SATIŞ QAİMƏSİ
              </span>
              <h4 className="text-base font-black text-gray-900 mt-3 font-mono">
                № {invoice.id.toString().padStart(5, "0")}
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block">
                Tarix: {new Date(invoice.saleDate).toLocaleDateString("az-AZ")}
              </span>
            </div>
          </div>

          {/* Customer Metadata info */}
          <div className="grid grid-cols-2 gap-6 py-6 border-b border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-2">Müştəri</span>
              <p className="font-bold text-gray-900 text-sm">{invoice.customerName || "Nəğd (Anonim Müştəri)"}</p>
              {invoice.customerPhone && <p className="text-gray-500 mt-1">{invoice.customerPhone}</p>}
            </div>

            <div className="text-right">
              <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-2">
                Ödəniş detalları
              </span>
              <p className="font-semibold text-gray-800">Üsul: {invoice.paymentType}</p>
              <p className="mt-1">
                Status:{" "}
                <span className={`font-bold ${invoice.paymentStatus === "paid" ? "text-green-600" : "text-red-500"}`}>
                  {invoice.paymentStatus === "paid" ? "Tam ödənilib" : "Nisyə (Ödənilməyib)"}
                </span>
              </p>
              {isCredit && invoice.creditDueDate && (
                <p className="text-red-500 font-bold mt-1">
                  Son ödəniş: {new Date(invoice.creditDueDate).toLocaleDateString("az-AZ")}
                </p>
              )}
            </div>
          </div>

          {/* Items listing table */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2">
                  <th className="py-2">Məhsul</th>
                  <th className="py-2 text-right w-16">Vahid</th>
                  <th className="py-2 text-right w-20">Miqdar</th>
                  <th className="py-2 text-right w-24">Qiymət</th>
                  <th className="py-2 text-right w-28 pr-2">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item: any) => {
                  const returnedQty = getReturnedQty(item.productId);
                  return (
                    <tr key={item.id} className="border-b border-gray-50 text-xs">
                      <td className="py-4 font-bold text-gray-900 flex items-center flex-wrap gap-2">
                        <span>{item.productName}</span>
                        {returnedQty > 0 && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[9px] font-bold">
                            Qaytarılıb: {returnedQty} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right text-gray-500 font-medium">{item.unit}</td>
                      <td className="py-4 text-right font-semibold text-gray-800 font-mono">{item.quantity}</td>
                      <td className="py-4 text-right text-gray-600 font-mono">{Number(item.salePrice || 0).toFixed(2)} ₼</td>
                      <td className="py-4 text-right font-bold text-gray-950 font-mono pr-2">
                        {Number((item.quantity * item.salePrice) || 0).toFixed(2)} ₼
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals panel */}
          <div className="border-t border-gray-100 pt-6 flex justify-end">
            <div className="w-64 space-y-2 text-xs font-semibold text-gray-500">
              <div className="flex justify-between">
                <span>Cəmi məbləğ</span>
                <span className="font-bold text-gray-950 font-mono text-sm">
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ödənilən məbləğ</span>
                <span className="font-bold text-green-600 font-mono text-sm">
                  {totalPaid.toFixed(2)} ₼
                </span>
              </div>
              {isCredit && (
                <div className="flex justify-between items-center text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 mt-2">
                  <span className="font-bold">Qalıq Borc</span>
                  <span className="font-black font-mono text-base">{remainingDebt.toFixed(2)} ₼</span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Footer / Custom Text from Settings */}
          {(settings?.invoiceFooter || invoice.notes) && (
            <div className="border-t border-gray-100 pt-6 mt-6 text-center text-[10px] text-gray-400 font-medium leading-relaxed italic">
              {settings?.invoiceFooter && <p>{settings.invoiceFooter}</p>}
              {invoice.notes && <p className="mt-1 font-semibold text-gray-500">Qeyd: {invoice.notes}</p>}
            </div>
          )}
        </div>

        {/* Right Side: Credit repayment actions & Returns history logs (Hidden in Print) */}
        {(isCredit || (invoice.returns && invoice.returns.length > 0)) && (
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card print:hidden space-y-6">
            
            {/* Returns History log */}
            {invoice.returns && invoice.returns.length > 0 && (
              <div className="space-y-3.5 text-xs font-semibold">
                <h3 className="font-extrabold text-amber-700 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-3">
                  <RotateCw className="w-4 h-4" /> Qaytarış Tarixçəsi 🔄
                </h3>
                <div className="space-y-3">
                  {invoice.returns.map((r: any, idx: number) => (
                    <div key={r.id} className="p-3 bg-amber-50/20 border border-amber-100/50 rounded-xl space-y-1.5 text-[11px] animate-in fade-in">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-gray-900">
                          {idx + 1}. Qaytarış #{r.id}
                        </span>
                        <span className="font-mono text-amber-700">-{Number(r.totalAmount || 0).toFixed(2)} ₼</span>
                      </div>
                      <div className="text-gray-400 font-medium">
                        Tarix: {new Date(r.returnDate).toLocaleDateString("az-AZ")} | {new Date(r.returnDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      
                      {/* List returned products */}
                      <div className="text-[10px] space-y-1 text-gray-500 border-t border-gray-100/50 pt-1.5">
                        {(r.items || []).map((item: any) => (
                          <div key={item.id} className="flex justify-between">
                            <span>• {item.productName || `Məhsul (ID: ${item.productId})`} ({item.quantity} ədəd)</span>
                            <span className="font-medium">{item.status === "returned_to_stock" ? "🟢 Anbara" : "🔴 Deffekt"}</span>
                          </div>
                        ))}
                      </div>

                      {r.reason && (
                        <div className="text-gray-600 italic text-[10px] bg-white/50 p-1.5 rounded-lg border border-gray-100 mt-1">
                          Səbəb: {r.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit Repayment actions */}
            {isCredit && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">Borcun Ödənilməsi</h3>
                  <p className="text-[11px] text-gray-400 mt-1">Nisyə borca ödəniş əlavə edin və ya tamamilə bağlayın</p>
                </div>

                {/* Payments History log */}
                {invoice.payments && invoice.payments.length > 0 && (
                  <div className="space-y-2.5 border-t border-b border-gray-100 py-4 text-xs font-semibold">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                      Ödəniş Tarixçəsi
                    </span>
                    {invoice.payments.map((p: any, idx: number) => (
                      <div key={p.id} className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">
                          {idx + 1}. Ödəniş ({new Date(p.paymentDate).toLocaleDateString("az-AZ")})
                        </span>
                        <span className="font-bold font-mono text-gray-950">{Number(p.amount || 0).toFixed(2)} ₼</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Repayment inputs */}
                <div className="space-y-4">
                  <form onSubmit={handlePartialPaySubmit} className="space-y-2 text-xs font-semibold">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məbləğlə ödə</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Məbləğ ₼"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs bg-gray-50/50"
                      />
                      <button
                        type="submit"
                        disabled={partialPayMutation.isPending}
                        className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                      >
                        Ödə
                      </button>
                    </div>
                  </form>

                  <div className="relative flex py-2 items-center text-xs font-medium text-gray-400">
                    <div className="flex-grow border-t border-gray-100"></div>
                    <span className="flex-shrink mx-3">və ya</span>
                    <div className="flex-grow border-t border-gray-100"></div>
                  </div>

                  <button
                    onClick={() => fullPayMutation.mutate()}
                    disabled={fullPayMutation.isPending}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-green-500/5 transition-all"
                  >
                    <Check className="w-4 h-4" /> Tam Borcu Bağla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Geri Qaytarış Modal Overlay */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-300">
          <div className="bg-white border border-gray-100 p-6 rounded-3xl max-w-xl w-full shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Malların Geri Qaytarılması 🔄</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Məhsulların qaytarılacaq miqdarını və anbar statusunu seçin
                </p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-gray-400 hover:text-gray-900 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-6 text-xs font-semibold">
              {/* Items List */}
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {invoice.items.map((item: any) => {
                  const returnedQty = getReturnedQty(item.productId);
                  const maxQty = item.quantity - returnedQty;
                  const itemState = returnItemsState[item.productId] || { quantity: 0, status: "returned_to_stock" };

                  if (maxQty <= 0) return null; // All items returned already

                  return (
                    <div key={item.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-2">
                      {/* Name */}
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 block text-xs">{item.productName}</span>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Satılıb: {item.quantity} {item.unit} | Qaytarıla bilər: {maxQty} {item.unit}
                        </span>
                      </div>

                      {/* Inputs */}
                      <div className="flex items-center gap-3">
                        {/* Qty Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 block">Miqdar</label>
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            step="0.01"
                            value={itemState.quantity}
                            onChange={(e) => {
                              const val = Math.min(maxQty, Math.max(0, parseFloat(e.target.value) || 0));
                              setReturnItemsState((prev) => ({
                                ...prev,
                                [item.productId]: { ...itemState, quantity: val },
                              }));
                            }}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {/* Status Toggle */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 block">Qaytarış Tipi</label>
                          <select
                            value={itemState.status}
                            onChange={(e) => {
                              setReturnItemsState((prev) => ({
                                ...prev,
                                [item.productId]: { ...itemState, status: e.target.value as any },
                              }));
                            }}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          >
                            <option value="returned_to_stock">🟢 Anbara Qayıtsın</option>
                            <option value="defective">🔴 Deffekt / Silinsin</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* If all products in invoice are already fully returned */}
                {invoice.items.every((item: any) => getReturnedQty(item.productId) >= item.quantity) && (
                  <div className="text-center py-8 text-gray-400 italic">
                    Bütün məhsullar artıq tamamilə geri qaytarılıb.
                  </div>
                )}
              </div>

              {/* Live Refund Summary */}
              {Object.values(returnItemsState).some(item => item.quantity > 0) && (
                <div className="flex justify-between items-center bg-amber-50 p-4 rounded-2xl border border-amber-100 animate-in fade-in">
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase tracking-wider block font-bold">Müştəriyə Geri Ödəniləcək</span>
                    <span className="text-lg font-black text-amber-950 font-mono mt-0.5 block">
                      {Object.entries(returnItemsState).reduce((sum, [pIdStr, state]) => {
                        const pId = parseInt(pIdStr);
                        const item = (invoice.items || []).find((i: any) => i.productId === pId);
                        if (!item) return sum;
                        return sum + (state.quantity * item.salePrice);
                      }, 0).toFixed(2)} ₼
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-amber-600 block">Maya Təsiri (COGS)</span>
                    <span className="font-mono text-gray-700 block text-xs font-bold mt-0.5">
                      +{Object.entries(returnItemsState).reduce((sum, [pIdStr, state]) => {
                        const pId = parseInt(pIdStr);
                        const item = (invoice.items || []).find((i: any) => i.productId === pId);
                        if (!item || state.status !== "returned_to_stock") return sum;
                        return sum + (state.quantity * item.purchasePrice);
                      }, 0).toFixed(2)} ₼ (Bərpa)
                    </span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qaytarılma Səbəbi</label>
                <textarea
                  placeholder="Müştəri fikrini dəyişdi, məhsul zədəlidir və ya başqa səbəb..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50/50 min-h-[60px]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end text-xs font-bold pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl cursor-pointer font-semibold"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={returnMutation.isPending || !Object.values(returnItemsState).some(item => item.quantity > 0)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/10 font-semibold"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Geri Qaytarışı Təsdiqlə
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
