import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Printer, CreditCard, Check, CheckCircle2 } from "lucide-react";
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
                {invoice.items.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-50 text-xs">
                    <td className="py-4 font-bold text-gray-900">{item.productName}</td>
                    <td className="py-4 text-right text-gray-500 font-medium">{item.unit}</td>
                    <td className="py-4 text-right font-semibold text-gray-800 font-mono">{item.quantity}</td>
                    <td className="py-4 text-right text-gray-600 font-mono">{item.salePrice.toFixed(2)} ₼</td>
                    <td className="py-4 text-right font-bold text-gray-950 font-mono pr-2">
                      {(item.quantity * item.salePrice).toFixed(2)} ₼
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals panel */}
          <div className="border-t border-gray-100 pt-6 flex justify-end">
            <div className="w-64 space-y-2 text-xs font-semibold text-gray-500">
              <div className="flex justify-between">
                <span>Cəmi məbləğ</span>
                <span className="font-bold text-gray-950 font-mono text-sm">
                  {invoice.totalAmount.toFixed(2)} ₼
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ödənilən məbləğ</span>
                <span className="font-bold text-green-600 font-mono text-sm">
                  {invoice.totalPaid.toFixed(2)} ₼
                </span>
              </div>
              {isCredit && (
                <div className="flex justify-between items-center text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 mt-2">
                  <span className="font-bold">Qalıq Borc</span>
                  <span className="font-black font-mono text-base">{invoice.remainingDebt.toFixed(2)} ₼</span>
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

        {/* Right Side: Credit repayment actions (Hidden in Print) */}
        {isCredit && (
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card print:hidden space-y-6">
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
                    <span className="font-bold font-mono text-gray-950">{p.amount.toFixed(2)} ₼</span>
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
    </div>
  );
}
