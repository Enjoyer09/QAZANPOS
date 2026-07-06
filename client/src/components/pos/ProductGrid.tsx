import React from "react";
import { Search, Barcode, Plus, AlertTriangle } from "lucide-react";
import { sanitizeQtyInput } from "../../lib/utils.ts";
import { useToast } from "../Toast.tsx";
import type { BasketItem } from "./CartPanel.tsx";

interface CurrentUserData {
  id?: number;
  username?: string;
  role?: string;
  warehouseId?: number;
  staffCanViewStockBalances?: number;
  staffCanViewCustomers?: number;
  staffCanViewVendors?: number;
  staffCanViewExpenses?: number;
  staffCanViewSalesHistory?: number;
  staffCanViewDebts?: number;
  staffCanViewStock?: number;
  [key: string]: unknown;
}

interface StockLevelItem {
  productId: number;
  productName: string;
  unit: string;
  barcode?: string;
  currentQuantity: number;
  lastSalePrice?: number;
  lastPurchasePrice?: number;
  trackingType?: string;
  category?: string;
  description?: string;
  activeSerials?: string[];
  [key: string]: unknown;
}

interface ProductGridProps {
  posMode: "sale" | "return";
  stockLevels: StockLevelItem[] | undefined;
  currentUser: CurrentUserData | undefined;
  isAdmin: boolean;
  basket: BasketItem[];
  scanInput: string;
  productSearchQuery: string;
  selectedProductId: string;
  selectedQuantity: string;
  onScanInput: (val: string) => void;
  onProductSearchQuery: (val: string) => void;
  onSelectedProductId: (val: string) => void;
  onSelectedQuantity: (val: string) => void;
  onAddToBasket: (prod: Record<string, unknown>, serialNum?: string | null, bypassStockCheck?: boolean, customSalePrice?: number) => void;
  onOpenQuickCreate: (name: string) => void;
  onOpenCustomItem: (name: string) => void;
}

export default function ProductGrid({
  posMode, stockLevels, currentUser, isAdmin, basket,
  scanInput, productSearchQuery, selectedProductId, selectedQuantity,
  onScanInput, onProductSearchQuery, onSelectedProductId, onSelectedQuantity,
  onAddToBasket, onOpenQuickCreate, onOpenCustomItem
}: ProductGridProps) {
  const { toast } = useToast();

  const sellableProducts = posMode === "sale"
    ? (stockLevels?.filter((p) => Number(p.currentQuantity) > 0) || [])
    : (stockLevels || []);

  const normalizeSearchText = (text: any): string => {
    if (text === null || text === undefined) return "";
    return String(text).toLocaleLowerCase("az-AZ")
      .replace(/ı/g, "i").replace(/ə/g, "e").replace(/ö/g, "o")
      .replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
  };

  const searchedProducts = sellableProducts.filter((p) => {
    const q = productSearchQuery.trim();
    if (!q) return true;
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) =>
      normalizeSearchText(p.productName).includes(word) ||
      (p.barcode && normalizeSearchText(p.barcode).includes(word)) ||
      (p.description && normalizeSearchText(p.description).includes(word))
    );
  });

  const handleScanInput = (val: string) => {
    onScanInput(val);
    const cleaned = val.trim().toUpperCase();
    if (!cleaned) return;

    let foundProduct: any = null;
    let foundSerial: string | null = null;

    for (const p of sellableProducts) {
      if (p.activeSerials && p.activeSerials.map((s: string) => s.toUpperCase()).includes(cleaned)) {
        foundProduct = p;
        foundSerial = cleaned;
        break;
      }
    }

    if (!foundProduct) {
      foundProduct = sellableProducts.find((p) => p.barcode === val.trim());
    }

    if (foundProduct) {
      onAddToBasket(foundProduct, foundSerial);
      onScanInput("");
      toast({ title: "Skan edildi!", description: `Məhsul səbətə əlavə olundu: ${foundProduct.productName}${foundSerial ? ` (IMEI: ${foundSerial})` : ""}`, variant: "success" });
    }
  };

  const handleAddToBasketFromSelect = () => {
    if (!selectedProductId) {
      toast({ title: "Xəta!", description: "Məhsul seçin", variant: "destructive" });
      return;
    }
    const prod = sellableProducts.find((p) => p.productId === parseInt(selectedProductId));
    if (!prod) return;

    if (prod.trackingType === "serialized") {
      toast({ title: "Serial Məhsul", description: "Serial nömrəli məhsulları Sürətli Skaner ilə əlavə edin.", variant: "destructive" });
      return;
    }

    const qty = parseFloat(selectedQuantity) || 1;
    if (qty <= 0) { toast({ title: "Xəta!", description: "Düzgün miqdar daxil edin", variant: "destructive" }); return; }

    if (prod.unit.trim().toLowerCase() === "ədəd" && qty % 1 !== 0) {
      toast({ title: "Xəta!", description: `"${prod.productName}" məhsulunun vahidi "ədəd" olduğu üçün miqdar tam ədəd olmalıdır.`, variant: "destructive" });
      return;
    }

    const existingInBasket = basket.find((item) => item.productId === prod.productId);
    const currentBasketQty = existingInBasket ? existingInBasket.quantity : 0;
    if (posMode === "sale" && currentBasketQty + qty > prod.currentQuantity) {
      toast({
        title: "Xəta!",
        description: (isAdmin || currentUser?.staffCanViewStockBalances !== 0)
          ? `Anbarda kifayət qədər yoxdur. Maksimum: ${prod.currentQuantity} ${prod.unit}`
          : "Anbarda bu miqdarda məhsul yoxdur.",
        variant: "destructive",
      });
      return;
    }

    const defaultPrice = prod.lastSalePrice || prod.lastPurchasePrice || 0;
    if (existingInBasket) {
      onAddToBasket(prod, null, false, defaultPrice);
    } else {
      onAddToBasket(prod, null, false, defaultPrice);
    }

    onSelectedProductId("");
    onSelectedQuantity("1");
    onProductSearchQuery("");
  };

  const handleSelectProduct = (val: string) => {
    onSelectedProductId(val);
    if (val) {
      const prod = sellableProducts.find((p) => p.productId === parseInt(val));
      if (prod) {
        if (prod.trackingType === "serialized") {
          toast({ title: "Diqqət!", description: "Serial nömrəli (IMEI) məhsulları Sürətli Skan bölməsindən əlavə edin.", variant: "destructive" });
        } else {
          onAddToBasket(prod);
          onSelectedProductId("");
          toast({ title: "Əlavə edildi!", description: `"${prod.productName}" səbətə əlavə olundu.`, variant: "success" });
        }
      }
    }
  };

  return (
    <div className={`bg-white border p-6 rounded-2xl shadow-xs glass-card transition-all ${posMode === "return" ? "border-amber-300 ring-2 ring-amber-500/10" : "border-gray-100"}`}>
      <h3 className="font-extrabold text-gray-900 text-sm mb-4">
        {posMode === "return" ? "Geri Qaytarılacaq Məhsul Seçin" : "Səbətə Məhsul Əlavə Et"}
      </h3>

      {posMode === "return" && (
        <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold flex items-start gap-2.5 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block mb-0.5 text-amber-900">Nisyə Satışların Qaytarılması:</span>
            Nisyə satılmış malların qaytarılması üçün <strong className="text-amber-950 font-bold">"Satış Tarixçəsi"</strong> bölməsindən müvafiq qaiməni tapıb qaytarış edin.
          </div>
        </div>
      )}

      <div className="mb-4 space-y-1.5">
        <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Sürətli Skan / Barkod və ya IMEI</label>
        <div className="relative">
          <input type="text" placeholder="Barkod və ya IMEI skan edin..."
            value={scanInput}
            onChange={(e) => handleScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanInput(scanInput); } }}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-xs font-bold" />
          <Barcode className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="relative w-full mb-3">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Satılacaq məhsul axtar (ad, barkod və ya kateqoriya)..."
          value={productSearchQuery}
          onChange={(e) => onProductSearchQuery(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 text-xs font-bold focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`} />
      </div>

      {productSearchQuery.trim() && (
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-lg max-h-60 overflow-y-auto space-y-2 mb-4 animate-in fade-in duration-200">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Axtarış Nəticələri ({searchedProducts.length})</span>
          {searchedProducts.length === 0 ? (
            <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl space-y-3.5 text-center animate-in fade-in duration-200">
              <p className="text-xs text-gray-400 font-semibold">🔍 Axtarışa uyğun məhsul tapılmadı.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                <button type="button" onClick={() => onOpenQuickCreate(productSearchQuery.trim())}
                  className="w-full sm:w-auto px-3.5 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-primary/95 cursor-pointer transition-all flex items-center justify-center gap-1.5 hover-elevate shadow-xs">
                  ➕ Kataloqda Yeni Məhsul Yarat
                </button>
                <button type="button" onClick={() => onOpenCustomItem(productSearchQuery.trim())}
                  className="w-full sm:w-auto px-3.5 py-2 bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-purple-700 cursor-pointer transition-all flex items-center justify-center gap-1.5 hover-elevate shadow-xs">
                  ⚡ Müvəqqəti Sərbəst Satış Et
                </button>
              </div>
            </div>
          ) : (
            searchedProducts.map((p) => (
              <div key={p.productId} onClick={() => {
                if (p.trackingType === "serialized") {
                  toast({ title: "Diqqət!", description: "Serial nömrəli məhsulları Sürətli Skan bölməsindən əlavə edin.", variant: "destructive" });
                } else {
                  onAddToBasket(p);
                  onProductSearchQuery("");
                  toast({ title: "Əlavə edildi!", description: `"${p.productName}" səbətə əlavə olundu.`, variant: "success" });
                }
              }}
                className="flex items-center justify-between p-2.5 hover:bg-primary/5 rounded-xl cursor-pointer transition-colors border border-gray-50 hover:border-primary/10 text-xs font-semibold text-left">
                <div className="text-left">
                  <span className="block font-bold text-gray-900">{p.productName}</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    {(isAdmin || currentUser?.staffCanViewStockBalances !== 0) ? `Qalıq: ${p.currentQuantity} ${p.unit} | ` : ""}Barkod: {p.barcode || "Yoxdur"}
                  </span>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-900">{(p.lastSalePrice || p.lastPurchasePrice || 0).toFixed(2)} ₼</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wider">+ Əlavə Et</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 text-xs font-semibold">
        <div className="flex-1 w-full">
          <select value={selectedProductId} onChange={(e) => handleSelectProduct(e.target.value)}
            className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}>
            <option value="">{searchedProducts.length === 0 ? "Axtarışa uyğun məhsul tapılmadı..." : "Məhsul seçin..."}</option>
            {searchedProducts.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productName} {(isAdmin || currentUser?.staffCanViewStockBalances !== 0) ? `— Qalıq: ${p.currentQuantity} ${p.unit} ` : ""}
                ({posMode === "sale" ? `Satış: ${(p.lastSalePrice || p.lastPurchasePrice || 0).toFixed(2)} ₼` : `Geri Ödəniş: ${(p.lastSalePrice || p.lastPurchasePrice || 0).toFixed(2)} ₼`})
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-24">
          <input type="text" inputMode="decimal" placeholder="Miqdar" value={selectedQuantity}
            onChange={(e) => onSelectedQuantity(sanitizeQtyInput(e.target.value))}
            className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`} />
        </div>
        <button onClick={handleAddToBasketFromSelect}
          className={`w-full sm:w-auto px-5 py-3 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${posMode === "return" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/10" : "bg-primary hover:bg-primary/90 shadow-primary/10"}`}>
          <Plus className="w-4 h-4" /> {posMode === "return" ? "Qaytarışa əlavə et" : "Əlavə et"}
        </button>
      </div>
    </div>
  );
}
