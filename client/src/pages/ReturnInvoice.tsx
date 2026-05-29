import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Printer, RotateCw, AlertTriangle } from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { printReceipt } from "../components/ReceiptPrint.tsx";

interface ReturnInvoiceProps {
  params: { id: string };
}

export default function ReturnInvoice({ params }: ReturnInvoiceProps) {
  const { toast } = useToast();
  const returnId = parseInt(params.id);

  // Fetch Return Details
  const { data: returnData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/returns", returnId],
    queryFn: async () => {
      const res = await fetch(`/api/returns/${returnId}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Fetch settings
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const [printingReceipt, setPrintingReceipt] = useState(false);

  const handlePrintReceipt = async () => {
    if (!returnData) return;
    setPrintingReceipt(true);
    try {
      const returnReceiptObj = {
        id: returnData.id,
        saleDate: returnData.returnDate,
        customerName: "Qaytarış",
        paymentType: "Geri Ödəniş",
        notes: returnData.reason,
        totalAmount: returnData.totalAmount,
        items: returnData.items.map((item: any) => ({
          productName: item.product?.name || item.productName || "Məhsul",
          unit: item.product?.unit || item.unit || "ədəd",
          quantity: item.quantity,
          salePrice: item.salePrice
        }))
      };

      const success = await printReceipt(returnReceiptObj, settings);
      if (success) {
        toast({
          title: "Çap qoşuldu",
          description: "Geri qaytarış qəbzi uğurla termal çapa göndərildi.",
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

  if (isLoading) return <div className="text-xs text-gray-400 py-10 text-center">Yüklənir...</div>;
  if (error || !returnData) return <div className="text-xs text-red-500 py-10 text-center">Geri qaytarış qaiməsi tapılmadı.</div>;

  const totalAmount = parseFloat(returnData.totalAmount) || 0;

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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Qaytarış Qaiməsi</h2>
            <p className="text-xs text-gray-400 mt-1">
              Geri qaytarış № {returnData.id.toString().padStart(5, "0")} məlumatları
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
          id="qazan-return-card"
          className="lg:col-span-2 bg-white border border-gray-100 p-8 rounded-2xl shadow-xs glass-card print:border-0 print:shadow-none print:p-0 print:bg-transparent"
        >
          {/* Print specific custom styles */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #qazan-return-card, #qazan-return-card * {
                  visibility: visible;
                }
                #qazan-return-card {
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
                <div className="size-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold text-base">
                  Q
                </div>
                <h3 className="font-extrabold text-lg text-gray-950">{settings?.storeName || "BirSaaS"}</h3>
              </div>
              {settings?.phone && <p className="text-[10px] text-gray-400 font-medium">Əlaqə: {settings.phone}</p>}
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{settings?.address || "Bakı, Azərbaycan"}</p>
            </div>

            <div className="text-right">
              <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                GERİ QAYTARIŞ QAİMƏSİ
              </span>
              <h4 className="text-base font-black text-gray-900 mt-3 font-mono">
                № {returnData.id.toString().padStart(5, "0")}
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block">
                Tarix: {new Date(returnData.returnDate).toLocaleDateString("az-AZ")} | {new Date(returnData.returnDate).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {/* Customer Metadata info */}
          <div className="grid grid-cols-2 gap-6 py-6 border-b border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-2">Qaytarılan Tərəf</span>
              <p className="font-bold text-gray-900 text-sm">
                {returnData.sale?.customerName || "Nəğd Müştəri / Sürətli Qaytarış"}
              </p>
              {returnData.sale?.customerPhone && <p className="text-gray-500 mt-1">{returnData.sale.customerPhone}</p>}
            </div>

            <div className="text-right">
              <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-2">
                Əməliyyat detalları
              </span>
              <p className="font-semibold text-gray-800">Üsul: Müştəriyə Geri Ödəniş</p>
              <p className="mt-1">
                Status:{" "}
                <span className="font-bold text-amber-600">Mallar Qəbul Edilib</span>
              </p>
              {returnData.saleId && (
                <p className="text-gray-500 font-medium mt-1">
                  Əlaqəli Satış: <Link href={`/satislar/${returnData.saleId}`} className="text-primary hover:underline font-bold">№ {returnData.saleId.toString().padStart(5, "0")}</Link>
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
                  <th className="py-2 text-right w-28 pr-2">Toplam Refund</th>
                </tr>
              </thead>
              <tbody>
                {returnData.items.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-50 text-xs">
                    <td className="py-4 font-bold text-gray-900">
                      <div>{item.product?.name || item.productName || "Məhsul"}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        item.status === "returned_to_stock" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                      }`}>
                        {item.status === "returned_to_stock" ? "Anbara Qayıdıb" : "Deffekt / Silinib"}
                      </span>
                    </td>
                    <td className="py-4 text-right text-gray-500 font-medium">{item.product?.unit || item.unit || "ədəd"}</td>
                    <td className="py-4 text-right font-semibold text-gray-800 font-mono">{item.quantity}</td>
                    <td className="py-4 text-right text-gray-600 font-mono">{Number(item.salePrice || 0).toFixed(2)} ₼</td>
                    <td className="py-4 text-right font-bold text-amber-700 font-mono pr-2">
                      -{Number((item.quantity * item.salePrice) || 0).toFixed(2)} ₼
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals panel */}
          <div className="border-t border-gray-100 pt-6 flex justify-end">
            <div className="w-64 space-y-2 text-xs font-semibold text-gray-500">
              <div className="flex justify-between items-center text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                <span className="font-bold">Geri Ödənilən Cəm</span>
                <span className="font-black font-mono text-base">{totalAmount.toFixed(2)} ₼</span>
              </div>
            </div>
          </div>

          {/* Return Reason info */}
          {returnData.reason && (
            <div className="border-t border-gray-100 pt-6 mt-6">
              <span className="text-gray-400 font-bold uppercase block text-[9px] tracking-wider mb-2">Qaytarılma Səbəbi</span>
              <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 italic">
                "{returnData.reason}"
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Return Info Card (Hidden in Print) */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card print:hidden space-y-4">
          <div className="flex items-center gap-2 mb-2 text-amber-700 border-b border-gray-100 pb-3">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-extrabold text-gray-900 text-sm">Geri Qaytarış Məlumatı</h3>
          </div>
          <p className="text-xs text-gray-500 leading-normal">
            Bu sənəd malların geri qaytarılmasını təsdiq edən rəsmi qaimə vərəqidir. Qaytarılmış mallar qeyd edilən statusa uyğun olaraq anbar qalıqlarına geri əlavə edilib və ya deffekt/zay olaraq qalıqdan silinmişdir.
          </p>
        </div>
      </div>
    </div>
  );
}
