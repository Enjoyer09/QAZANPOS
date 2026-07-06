import React, { useState } from "react";
import { Trash2, ShoppingCart } from "lucide-react";
import { cleanNumberInput } from "../../lib/utils.ts";
import { useToast } from "../Toast.tsx";

export interface BasketItem {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  minPrice: number;
  serialNumbers?: string[];
  category?: string;
  originalPrice?: number;
}

interface CartPanelProps {
  basket: BasketItem[];
  posMode: "sale" | "return";
  isAdmin: boolean;
  onRemoveFromBasket: (id: number) => void;
  onUpdateItem: (id: number, field: "quantity" | "salePrice", val: string) => void;
  onRemoveSerial: (productId: number, serialNum: string) => void;
  onOpenDiscountModal: (item: BasketItem) => void;
  onPrintPickTicket: () => void;
}

export default function CartPanel({
  basket, posMode, isAdmin,
  onRemoveFromBasket, onUpdateItem, onRemoveSerial, onOpenDiscountModal,
  onPrintPickTicket
}: CartPanelProps) {
  const { toast } = useToast();
  const [editingPrices, setEditingPrices] = useState<Record<number, string>>({});
  const [editingQuantities, setEditingQuantities] = useState<Record<number, string>>({});

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-gray-900 text-sm">Seçilmiş Məhsullar</h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ShoppingCart className="w-4 h-4" />
          <span>{basket.length} növ məhsul</span>
        </div>
      </div>

      {basket.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-400">Səbət boşdur. Kataloqdan məhsul seçib əlavə edin.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-2">Məhsul</th>
                <th className="py-3 px-2 text-right w-24">Miqdar</th>
                <th className="py-3 px-2 text-right w-24">Maya (₼)</th>
                <th className="py-3 px-2 text-right w-28">
                  {posMode === "return" ? "Qaytarış Qiyməti (₼)" : "Satış Qiyməti (₼)"}
                </th>
                <th className="py-3 px-2 text-right w-28">Toplam</th>
                {posMode === "sale" && isAdmin && <th className="py-3 px-2 text-right w-20 text-green-600">Gəlir</th>}
                <th className="py-3 px-2 w-12 text-center" />
              </tr>
            </thead>
            <tbody>
              {basket.map((item) => {
                const isLoss = posMode === "sale" && item.salePrice < item.minPrice;
                const itemProfit = (item.salePrice - item.minPrice) * item.quantity;
                return (
                  <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all text-xs">
                    <td className="py-4 px-2">
                      <span className="font-bold block text-gray-900">{item.productName}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">Ölçü vahidi: {item.unit}</span>
                      {item.serialNumbers && item.serialNumbers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 max-w-xs">
                          {item.serialNumbers.map((s: string) => (
                            <span key={s} className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1">
                              {s}
                              <button type="button" onClick={() => onRemoveSerial(item.productId, s)}
                                className="text-red-500 hover:text-red-700 font-bold font-sans cursor-pointer text-[10px]" title="Serialı sil">✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2 text-right">
                      <input type="text" inputMode="decimal"
                        value={editingQuantities[item.productId] !== undefined ? editingQuantities[item.productId] : item.quantity.toString()}
                        onChange={(e) => {
                          const sanitized = cleanNumberInput(e.target.value);
                          setEditingQuantities(prev => ({ ...prev, [item.productId]: sanitized }));
                          if (!sanitized.endsWith(".")) onUpdateItem(item.productId, "quantity", sanitized);
                        }}
                        onBlur={() => {
                          setEditingQuantities(prev => { const copy = { ...prev }; delete copy[item.productId]; return copy; });
                        }}
                        className={`w-16 px-2 py-1 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"} ${item.serialNumbers && item.serialNumbers.length > 0 ? "bg-gray-100 cursor-not-allowed opacity-80" : ""}`}
                        readOnly={!!(item.serialNumbers && item.serialNumbers.length > 0)} />
                    </td>
                    <td className="py-4 px-2 text-right font-bold text-gray-500 font-mono">{item.minPrice.toFixed(2)} ₼</td>
                    <td className="py-4 px-2 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 justify-end">
                          {posMode === "sale" && item.originalPrice && item.salePrice < item.originalPrice && (
                            <span className="text-[10px] text-gray-400 line-through font-mono">{item.originalPrice.toFixed(2)} ₼</span>
                          )}
                          <input type="text" inputMode="decimal"
                            value={editingPrices[item.productId] !== undefined ? editingPrices[item.productId] : item.salePrice.toString()}
                            onChange={(e) => {
                              const sanitized = cleanNumberInput(e.target.value);
                              setEditingPrices(prev => ({ ...prev, [item.productId]: sanitized }));
                              if (!sanitized.endsWith(".")) onUpdateItem(item.productId, "salePrice", sanitized);
                            }}
                            onBlur={() => {
                              setEditingPrices(prev => { const copy = { ...prev }; delete copy[item.productId]; return copy; });
                            }}
                            className={`w-18 px-2 py-1 border rounded-lg text-right focus:outline-none focus:ring-1 ${isLoss ? "border-red-400 focus:ring-red-500 bg-red-50/50" : (posMode === "return" ? "border-gray-200 focus:ring-amber-500" : "border-gray-200 focus:ring-primary")}`} />
                          {posMode === "sale" && (
                            <button type="button" onClick={() => onOpenDiscountModal(item)}
                              className="p-1 rounded-lg border border-amber-100 hover:bg-amber-50 text-amber-600 transition cursor-pointer" title="Fərdi Endirim">🏷️</button>
                          )}
                        </div>
                        {isLoss && <span className="text-[9px] font-bold text-red-500 mt-1">Min: {item.minPrice.toFixed(2)} ₼</span>}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right font-bold text-gray-900 font-mono">{(item.quantity * item.salePrice).toFixed(2)} ₼</td>
                    {posMode === "sale" && isAdmin && (
                      <td className={`py-4 px-2 text-right font-bold font-mono ${itemProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {itemProfit >= 0 ? "+" : ""}{itemProfit.toFixed(2)}
                      </td>
                    )}
                    <td className="py-4 px-2 text-center">
                      <button onClick={() => onRemoveFromBasket(item.productId)} className="text-gray-400 hover:text-red-500 cursor-pointer transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
