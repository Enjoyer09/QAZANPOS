import React from "react";
import { CheckCircle, DollarSign, Bookmark, BookmarkCheck } from "lucide-react";
import type { BasketItem } from "./CartPanel.tsx";

interface SettingsData {
  storeName?: string;
  phone?: string;
  address?: string;
  taxStatus?: string;
  activeBanks?: string;
  marketplaceCommissions?: string;
  loyaltyMinPointsRedeem?: string;
  receiptFooter?: string;
  [key: string]: unknown;
}

interface PaymentPanelProps {
  basket: BasketItem[];
  posMode: "sale" | "return";
  isAdmin: boolean;
  isOnline: boolean;
  totalAmount: number;
  totalCost: number;
  profit: number;
  marketplaceFee: number;
  isCredit: boolean;
  customerMode: "none" | "existing" | "new";
  selectedCustomerId: string;
  customerLoyaltyPoints: number;
  paymentType: string;
  bankName: string;
  creditDueDate: string;
  notes: string;
  salesChannel: string;
  applyEdv: boolean;
  returnStatus: "returned_to_stock" | "defective";
  cashReceivedInput: string;
  useLoyaltyPoints: boolean;
  loyaltyDiscountInput: string;
  activeBanksList: string[];
  activeSettings: SettingsData | null | undefined;
  isSellingAtLoss: boolean;
  heldSales: any[] | undefined;
  createSalePending: boolean;
  createReturnPending: boolean;
  onPaymentType: (val: string) => void;
  onBankName: (val: string) => void;
  onCreditDueDate: (val: string) => void;
  onNotes: (val: string) => void;
  onSalesChannel: (val: string) => void;
  onApplyEdv: (val: boolean) => void;
  onReturnStatus: (val: "returned_to_stock" | "defective") => void;
  onCashReceived: (val: string) => void;
  onUseLoyaltyPoints: (val: boolean) => void;
  onLoyaltyDiscountInput: (val: string) => void;
  onCheckout: () => void;
  onOpenHoldModal: () => void;
  onOpenHeldList: () => void;
  onPrintPickTicket: () => void;

}

export default function PaymentPanel({
  basket, posMode, isAdmin, totalAmount, totalCost, profit, marketplaceFee: _marketplaceFee, isCredit,
  customerMode: _customerMode, selectedCustomerId: _selectedCustomerId, customerLoyaltyPoints: _customerLoyaltyPoints,
  paymentType, bankName, creditDueDate, notes, salesChannel, applyEdv: _applyEdv, returnStatus,
  cashReceivedInput, useLoyaltyPoints, loyaltyDiscountInput, activeBanksList, activeSettings: _activeSettings,
  isSellingAtLoss: _isSellingAtLoss, heldSales, createSalePending, createReturnPending,
  onPaymentType, onBankName, onCreditDueDate, onNotes, onSalesChannel, onApplyEdv: _onApplyEdv,
  onReturnStatus, onCashReceived, onUseLoyaltyPoints: _onUseLoyaltyPoints, onLoyaltyDiscountInput: _onLoyaltyDiscountInput,
  onCheckout, onOpenHoldModal, onOpenHeldList, onPrintPickTicket,
}: PaymentPanelProps) {
  return (
    <div className={`bg-white border p-6 rounded-2xl shadow-xs glass-card transition-all ${posMode === "return" ? "border-amber-300 ring-2 ring-amber-500/10" : "border-gray-100"}`}>
      <h3 className="font-extrabold text-gray-900 text-sm mb-4">
        {posMode === "return" ? "Geri Qaytarış və Yekun" : "Ödəniş və Yekun"}
      </h3>

      {/* Totals */}
      <div className="space-y-2 border-b border-gray-100 pb-4 mb-4 text-xs font-medium text-gray-500 font-semibold">
        <div className="flex justify-between">
          <span>{posMode === "return" ? "Geri Ödəniləcək Cəmi" : "Cəmi məbləğ"}</span>
          <span className={`font-bold font-mono text-sm ${posMode === "return" ? "text-amber-600" : "text-gray-900"}`}>
            {totalAmount.toFixed(2)} ₼
          </span>
        </div>
        {posMode === "sale" && useLoyaltyPoints && parseFloat(loyaltyDiscountInput) > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold animate-in fade-in">
            <span>Bonus Güzəşti</span>
            <span className="font-mono">-{parseFloat(loyaltyDiscountInput).toFixed(2)} ₼</span>
          </div>
        )}
        {posMode === "sale" && useLoyaltyPoints && parseFloat(loyaltyDiscountInput) > 0 && (
          <div className="flex justify-between text-gray-900 font-bold border-t border-dashed border-gray-100 pt-1.5">
            <span>Ödəniləcək Yekun</span>
            <span className="font-mono text-sm">{Math.max(0, totalAmount - (parseFloat(loyaltyDiscountInput) || 0)).toFixed(2)} ₼</span>
          </div>
        )}
        {posMode === "sale" && isAdmin && (
          <>
            <div className="flex justify-between"><span>Məhsul mayası</span><span className="font-mono">{totalCost.toFixed(2)} ₼</span></div>
            <div className={`flex justify-between items-center p-2.5 rounded-xl border ${profit >= 0 ? "text-green-600 bg-green-50/50 border-green-100/50" : "text-red-600 bg-red-50/55 border-red-100/50"} glass animate-in fade-in`}>
              <span className="font-semibold">{profit >= 0 ? "Təxmini Mənfəət" : "Təxmini Zərər ⚠️"}</span>
              <span className="font-black font-mono text-sm">{profit >= 0 ? "+" : "-"}{Math.abs(profit).toFixed(2)} ₼</span>
            </div>
          </>
        )}
      </div>

      {posMode === "sale" && (
        <div className="space-y-1.5 text-xs font-semibold">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Satış Kanalı 🌐</label>
          <select value={salesChannel} onChange={(e) => onSalesChannel(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 focus:ring-primary">
            <option value="Mağaza">🏠 Mağaza (Pərakəndə)</option>
            <option value="birmarket.az">🌐 birmarket.az (Marketplace)</option>
          </select>
        </div>
      )}

      <div className="space-y-4 text-xs font-semibold">
        <div className="space-y-1.5">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
            {posMode === "return" ? "Geri Ödəniş Üsulu" : "Ödəniş Üsulu"}
          </label>
          <select value={paymentType} onChange={(e) => onPaymentType(e.target.value)}
            className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}>
            <option value="Nəğd">Nəğd</option>
            <option value="Kart">Kart</option>
            <option value="Kart2Kart">Kart2Kart</option>
            <option value="Köçürmə">Köçürmə</option>
            {posMode === "sale" && <option value="Nisyə">Nisyə (Borc)</option>}
          </select>
        </div>

        {posMode === "sale" && paymentType === "Kart" && (
          <div className="space-y-1.5 animate-in slide-in-from-top-1.5">
            <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Bank Hesabı *</label>
            <select value={bankName} onChange={(e) => onBankName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer text-xs font-bold" required>
              <option value="">Bank Seçin...</option>
              {(activeBanksList.length > 0 ? activeBanksList : ["Digər"]).map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
        )}

        {posMode === "return" && (
          <div className="space-y-1.5 animate-in slide-in-from-top-1.5">
            <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qaytarış Tipi</label>
            <select value={returnStatus} onChange={(e) => onReturnStatus(e.target.value as "returned_to_stock" | "defective")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50/50 cursor-pointer text-xs font-semibold">
              <option value="returned_to_stock">🟢 Anbara Geri Qayıtsın</option>
              <option value="defective">🔴 Deffekt / Zədəli</option>
            </select>
          </div>
        )}

        {posMode === "sale" && isCredit && (
          <div className="space-y-1.5 border border-amber-100 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
            <label className="text-amber-700 uppercase tracking-wider block text-[10px]">Borcun Ödənilmə Tarixi *</label>
            <input type="date" value={creditDueDate} onChange={(e) => onCreditDueDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white cursor-pointer" />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
            {posMode === "return" ? "Qaytarılma Səbəbi" : "Satış qeydi"}
          </label>
          <input type="text" placeholder={posMode === "return" ? "Qaytarılma səbəbini qeyd edin..." : "Əlavə məlumat (ixtiyari)"}
            value={notes} onChange={(e) => onNotes(e.target.value)}
            className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`} />
        </div>

        {posMode === "sale" && paymentType === "Nəğd" && (
          <div className="space-y-1.5 border border-emerald-100 bg-emerald-50/20 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
            <label className="text-emerald-700 uppercase tracking-wider block text-[10px] font-bold flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Nəğd Qəbul Edildi
            </label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={cashReceivedInput}
              onChange={(e) => onCashReceived(e.target.value)}
              className="w-full px-4 py-3 border border-emerald-200 rounded-xl focus:outline-none bg-white focus:ring-1 focus:ring-emerald-400 font-mono font-bold text-sm" />
            {parseFloat(cashReceivedInput) > 0 && (
              <div className={`flex justify-between items-center font-bold text-sm px-1 pt-1 ${parseFloat(cashReceivedInput) >= totalAmount ? "text-emerald-700" : "text-red-600"}`}>
                <span>{parseFloat(cashReceivedInput) >= totalAmount ? "Qaytarılacaq:" : "Çatmayan:"}</span>
                <span className="font-mono">{Math.abs(parseFloat(cashReceivedInput) - totalAmount).toFixed(2)} ₼</span>
              </div>
            )}
          </div>
        )}

        <button onClick={onCheckout} disabled={basket.length === 0 || createSalePending || createReturnPending}
          className={`w-full py-3 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md transition-all ${posMode === "return" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10" : (isCredit ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10" : "bg-primary hover:bg-primary/90 shadow-primary/10")}`}>
          <CheckCircle className="w-4 h-4" />
          {posMode === "return" ? "Geri Qaytarlışı Tamamla" : (isCredit ? "Nisye Satış Qeyd Et" : "Satışı Tamamla (Qaimə)")}
        </button>

        {posMode === "sale" && (
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={onOpenHoldModal} disabled={basket.length === 0}
              className="w-full py-2.5 border border-amber-200 bg-amber-50/40 text-amber-700 font-bold rounded-xl cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1 text-[10px] hover:bg-amber-50 transition-all">
              <Bookmark className="w-3 h-3" /> Saxla
            </button>
            <button onClick={onOpenHeldList}
              className="relative w-full py-2.5 border border-blue-200 bg-blue-50/40 text-blue-700 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1 text-[10px] hover:bg-blue-50 transition-all">
              <BookmarkCheck className="w-3 h-3" /> Saxlanmış
              {heldSales && heldSales.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {heldSales.length}
                </span>
              )}
            </button>
            <button onClick={onPrintPickTicket}
              className="w-full py-2.5 border border-purple-200 bg-purple-50/40 text-purple-700 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1 text-[10px] hover:bg-purple-50 transition-all">
              📋 Yığım Bileti
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
