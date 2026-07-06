import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  ShoppingCart,
  Trash2,
  CheckCircle,
  Plus,
  Minus,
  Barcode,
  Receipt,
  UserPlus,
  AlertTriangle,
  Globe,
  Zap,
  X,
  Bookmark,
  BookmarkCheck,
  Clock,
  DollarSign,
} from "lucide-react";
import { 
  cacheProducts, 
  cacheCustomers, 
  cacheSettings,
  getCachedProducts,
  getCachedCustomers,
  getCachedSettings,
  saveOfflineSale,
  saveOfflineReturn
} from "../lib/offlineSync.ts";
import { useToast } from "../components/Toast.tsx";
import { printReceipt, printZReport, printPickTicket } from "../components/ReceiptPrint.tsx";
import { sanitizeQtyInput, cleanNumberInput } from "../lib/utils.ts";
import CartPanel from "../components/pos/CartPanel.tsx";
import ProductGrid from "../components/pos/ProductGrid.tsx";
import PaymentPanel from "../components/pos/PaymentPanel.tsx";

interface BasketItem {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  minPrice: number; // Snapshot of lastPurchasePrice
  serialNumbers?: string[];
  category?: string;
  originalPrice?: number;
}

export default function POS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const user = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = user?.role === "Admin";

  // Basket State
  const [basket, setBasket] = useState<BasketItem[]>(() => {
    try {
      const saved = localStorage.getItem("qazanpos_pos_basket");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("qazanpos_pos_basket", JSON.stringify(basket));
    } catch (e) {
      console.error("Persisting basket failed:", e);
    }
  }, [basket]);
  const [editingPrices, setEditingPrices] = useState<Record<number, string>>({});
  const [editingQuantities, setEditingQuantities] = useState<Record<number, string>>({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Customer State
  const [customerMode, setCustomerMode] = useState<"none" | "existing" | "new">("none");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  // Payment State
  const [paymentType, setPaymentType] = useState("Nəğd");
  const [bankName, setBankName] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [salesChannel, setSalesChannel] = useState<string>("Mağaza");
  const [applyEdv, setApplyEdv] = useState(true);

  // Quick Create Modal States
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreatePrice, setQuickCreatePrice] = useState("");
  const [quickCreateBarcode, setQuickCreateBarcode] = useState("");
  const [quickCreateCategory, setQuickCreateCategory] = useState("Ümumi");
  const [quickCreateUnit, setQuickCreateUnit] = useState("ədəd");
  const [isSubmittingQuickCreate, setIsSubmittingQuickCreate] = useState(false);

  // Custom Item Modal States
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [isSubmittingCustomItem, setIsSubmittingCustomItem] = useState(false);

  // POS Mode State
  const [posMode, setPosMode] = useState<"sale" | "return">("sale");
  const [returnStatus, setReturnStatus] = useState<"returned_to_stock" | "defective">("returned_to_stock");

  // Checkout Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<any | null>(null);

  // Settings Query for receipt printing config
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Shifts State & Queries
  const { data: activeShiftData, isLoading: isActiveShiftLoading } = useQuery<any>({
    queryKey: ["/api/shifts/active"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/active");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
  });
  const activeShift = activeShiftData?.activeShift;

  const [openingCashInput, setOpeningCashInput] = useState("0");
  const [actualCashInput, setActualCashInput] = useState("");
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [closeShiftStats, setCloseShiftStats] = useState<any>(null);

  const openShiftMutation = useMutation({
    mutationFn: async (openingCash: number) => {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Növbə açıla bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/active"] });
      toast({ title: "Növbə Açıldı!", description: "Kassa növbəniz uğurla aktivləşdirildi.", variant: "success" });
    },
    onError: (err: any) => {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    }
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (actualCash: number) => {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualCash }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Növbə bağlana bilmədi");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setCloseShiftStats(data);
      toast({ title: "Növbə Bağlandı!", description: "Z-Hesabatı uğurla hazırlandı.", variant: "success" });
    },
    onError: (err: any) => {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    }
  });

  // Loyalty Points State
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [loyaltyDiscountInput, setLoyaltyDiscountInput] = useState("0");

  // Cash Payment State (change calculator)
  const [cashReceivedInput, setCashReceivedInput] = useState("");

  // Hold/Resume State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [isHeldListOpen, setIsHeldListOpen] = useState(false);
  const [isHoldingCart, setIsHoldingCart] = useState(false);

  // Per-item Discount State
  const [discountModalItem, setDiscountModalItem] = useState<BasketItem | null>(null);
  const [discountVal, setDiscountVal] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");

  const handleResetPOS = () => {
    setBasket([]);
    setEditingPrices({});
    setEditingQuantities({});
    setSelectedProductId("");
    setSelectedQuantity("1");
    setCustomerMode("none");
    setSelectedCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setPaymentType("Nəğd");
    setBankName("");
    setCreditDueDate("");
    setNotes("");
    setLastCreatedSale(null);
    setApplyEdv(true);
    setShowSuccessModal(false);
    setPosMode("sale");
    setReturnStatus("returned_to_stock");
    setUseLoyaltyPoints(false);
    setLoyaltyDiscountInput("0");
    setActualCashInput("");
    setCashReceivedInput("");
    setCloseShiftStats(null);
  };

  // Queries
  const { data: stockLevels, isLoading: isStockLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/levels", currentUser?.warehouseId],
    queryFn: async () => {
      const url = currentUser?.warehouseId 
        ? `/api/stock/levels?warehouseId=${currentUser.warehouseId}` 
        : "/api/stock/levels";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline && currentUser !== undefined,
  });

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
  });

  // Held Sales Query
  const { data: heldSales, refetch: refetchHeldSales } = useQuery<any[]>({
    queryKey: ["/api/held-sales"],
    queryFn: async () => {
      const res = await fetch("/api/held-sales");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
  });
  const activeHeldSales: any[] = heldSales || [];

  const handleHoldCart = async () => {
    if (basket.length === 0) {
      toast({ title: "Xəta!", description: "Səbət boşdur.", variant: "destructive" });
      return;
    }
    setIsHoldingCart(true);
    try {
      const activeCustomer = activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId));
      const res = await fetch("/api/held-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketJson: JSON.stringify(basket),
          label: holdLabel.trim() || null,
          customerId: selectedCustomerId || null,
          customerName: customerMode === "existing" ? activeCustomer?.name : newCustomerName || null,
          paymentType,
          notes,
          warehouseId: currentUser?.warehouseId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Saxlandı! 🔖", description: `Satış saxlandı: "${holdLabel || "Adsız"}"`, variant: "success" });
      handleResetPOS();
      setIsHoldModalOpen(false);
      setHoldLabel("");
      refetchHeldSales();
    } catch (err: any) {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    } finally {
      setIsHoldingCart(false);
    }
  };

  const handleResumeHeld = (held: any) => {
    try {
      const parsed: BasketItem[] = JSON.parse(held.basketJson);
      setBasket(parsed);
      if (held.customerId) setSelectedCustomerId(held.customerId.toString());
      if (held.paymentType) setPaymentType(held.paymentType);
      if (held.notes) setNotes(held.notes);
      setIsHeldListOpen(false);
      toast({ title: "Davam edildi! ▶️", description: `"${held.label || "Adsız"}" satışı yükləndi.`, variant: "success" });
      // Auto-delete from held list after resuming
      fetch(`/api/held-sales/${held.id}`, { method: "DELETE" }).then(() => refetchHeldSales());
    } catch {
      toast({ title: "Xəta!", description: "Saxlanmış satış yüklənə bilmədi.", variant: "destructive" });
    }
  };

  const handleDeleteHeld = async (id: number) => {
    await fetch(`/api/held-sales/${id}`, { method: "DELETE" });
    refetchHeldSales();
    toast({ title: "Silindi", description: "Saxlanmış satış silindi.", variant: "success" });
  };



  // Silent automatic cache updates
  useEffect(() => {
    if (isOnline && settings) {
      cacheSettings(settings);
    }
  }, [isOnline, settings]);

  useEffect(() => {
    if (isOnline && stockLevels && Array.isArray(stockLevels)) {
      cacheProducts(stockLevels);
    }
  }, [isOnline, stockLevels]);

  useEffect(() => {
    if (isOnline && customers && Array.isArray(customers)) {
      cacheCustomers(customers);
    }
  }, [isOnline, customers]);

  // Read from local storage if offline
  const activeSettings = isOnline ? settings : getCachedSettings();
  const activeStockLevels = isOnline ? stockLevels : getCachedProducts();
  const activeCustomers = isOnline ? customers : getCachedCustomers();

  const selectedCustomer = selectedCustomerId
    ? activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId))
    : null;
  const customerLoyaltyPoints = selectedCustomer ? parseFloat(selectedCustomer.loyaltyPoints || 0) : 0;

  const activeBanksList: string[] = React.useMemo(() => {
    if (!activeSettings?.activeBanks) return [];
    try {
      const parsed = JSON.parse(activeSettings.activeBanks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeSettings?.activeBanks]);

  // Filter products that have positive stock levels (in sale mode) or all products (in return mode)
  const sellableProducts = posMode === "sale"
    ? (activeStockLevels?.filter((p) => parseFloat(p.currentQuantity) > 0) || [])
    : (activeStockLevels || []);

  const normalizeSearchText = (text: any): string => {
    if (text === null || text === undefined) return "";
    const str = String(text);
    return str
      .toLocaleLowerCase("az-AZ")
      .replace(/ı/g, "i")
      .replace(/ə/g, "e")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g");
  };
  
  // Filter products by manual search input
  const searchedProducts = sellableProducts.filter((p) => {
    const q = productSearchQuery.trim();
    if (!q) return true;
    const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => {
      return (
        normalizeSearchText(p.productName).includes(word) ||
        (p.barcode && normalizeSearchText(p.barcode).includes(word)) ||
        (p.description && normalizeSearchText(p.description).includes(word))
      );
    });
  });  // Scanning State & Helpers
  const [scanInput, setScanInput] = useState("");

  const addProductToBasket = (prod: any, serialNum?: string | null, bypassStockCheck = false, customSalePrice?: number) => {
    const qty = 1;
    
    // Check if adding exceeds stock (only in sale mode)
    const existingInBasket = basket.find((item) => item.productId === prod.productId);
    const currentBasketQty = existingInBasket ? existingInBasket.quantity : 0;
    
    if (posMode === "sale" && !bypassStockCheck && currentBasketQty + qty > prod.currentQuantity) {
      toast({
        title: "Xəta!",
        description: (isAdmin || currentUser?.staffCanViewStockBalances !== 0)
          ? `Anbarda kifayət qədər yoxdur. Maksimum: ${prod.currentQuantity} ${prod.unit}`
          : "Anbarda bu miqdarda məhsul yoxdur.",
        variant: "destructive",
      });
      return;
    }

    // Check if this specific serial number is already in the basket
    if (serialNum) {
      const serialAlreadyInBasket = basket.some((item) => 
        item.serialNumbers && item.serialNumbers.includes(serialNum)
      );
      if (serialAlreadyInBasket) {
        toast({ title: "Diqqət!", description: "Bu serial nömrəsi artıq səbətdə var.", variant: "destructive" });
        return;
      }
    }

    if (existingInBasket) {
      setBasket((prev) =>
        prev.map((item) => {
          if (item.productId === prod.productId) {
            const updatedSerials = item.serialNumbers ? [...item.serialNumbers] : [];
            if (serialNum) updatedSerials.push(serialNum);
            const defaultPrice = customSalePrice !== undefined ? customSalePrice : item.salePrice;
            return {
              ...item,
              quantity: item.quantity + qty,
              salePrice: defaultPrice,
              originalPrice: item.originalPrice || defaultPrice,
              serialNumbers: updatedSerials,
            };
          }
          return item;
        })
      );
    } else {
      const defaultPrice = customSalePrice !== undefined ? customSalePrice : (prod.lastSalePrice || prod.lastPurchasePrice || 0);
      setBasket((prev) => [
        ...prev,
        {
          productId: prod.productId,
          productName: prod.productName,
          unit: prod.unit,
          quantity: qty,
          salePrice: defaultPrice,
          originalPrice: defaultPrice,
          minPrice: prod.lastPurchasePrice || 0,
          serialNumbers: serialNum ? [serialNum] : [],
          category: prod.category,
        },
      ]);
    }
  };

  // Submit Quick Create product to DB and add to basket
  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCreateName.trim()) {
      toast({ title: "Xəta!", description: "Məhsul adı daxil edilməlidir.", variant: "destructive" });
      return;
    }
    if (!quickCreatePrice || parseFloat(quickCreatePrice) <= 0) {
      toast({ title: "Xəta!", description: "Düzgün satış qiyməti daxil edilməlidir.", variant: "destructive" });
      return;
    }

    setIsSubmittingQuickCreate(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "Staff",
          "x-user-username": user?.username || ""
        },
        body: JSON.stringify({
          name: quickCreateName.trim(),
          category: quickCreateCategory,
          unit: quickCreateUnit,
          barcode: quickCreateBarcode.trim() || null,
          trackingType: "standard",
          salePrice: parseFloat(quickCreatePrice)
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Məhsul yaradılarkən xəta baş verdi.");
      }

      const createdProduct = await res.json();
      
      // Add immediately to basket
      const mappedForBasket = {
        productId: createdProduct.id,
        productName: createdProduct.name,
        unit: createdProduct.unit,
        currentQuantity: 0,
        lastSalePrice: parseFloat(quickCreatePrice),
        lastPurchasePrice: 0,
        category: createdProduct.category
      };

      addProductToBasket(mappedForBasket, null, true, parseFloat(quickCreatePrice));
      
      // Invalidate stock query to update search list
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      
      toast({ title: "Uğurlu!", description: `"${createdProduct.name}" kataloqa yaradıldı və səbətə əlavə olundu.`, variant: "success" });
      
      // Reset forms
      setIsQuickCreateOpen(false);
      setQuickCreateName("");
      setQuickCreatePrice("");
      setQuickCreateBarcode("");
      setQuickCreateCategory("Ümumi");
      setQuickCreateUnit("ədəd");
      setProductSearchQuery(""); // Clear search bar
    } catch (err: any) {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingQuickCreate(false);
    }
  };

  // Submit Custom Item (background create and add to basket)
  const handleCustomItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) {
      toast({ title: "Xəta!", description: "Məhsul adı daxil edilməlidir.", variant: "destructive" });
      return;
    }
    if (!customItemPrice || parseFloat(customItemPrice) <= 0) {
      toast({ title: "Xəta!", description: "Düzgün satış qiyməti daxil edilməlidir.", variant: "destructive" });
      return;
    }

    setIsSubmittingCustomItem(true);
    try {
      // Background product creation
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "Staff",
          "x-user-username": user?.username || ""
        },
        body: JSON.stringify({
          name: `[Sərbəst] ${customItemName.trim()}`,
          category: "Sərbəst Satış",
          unit: "ədəd",
          trackingType: "standard"
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Müvəqqəti məhsul yaradılarkən xəta baş verdi.");
      }

      const createdProduct = await res.json();
      
      // Add immediately to basket
      const mappedForBasket = {
        productId: createdProduct.id,
        productName: createdProduct.name,
        unit: createdProduct.unit,
        currentQuantity: 0,
        lastSalePrice: parseFloat(customItemPrice),
        lastPurchasePrice: 0,
        category: createdProduct.category
      };

      addProductToBasket(mappedForBasket, null, true, parseFloat(customItemPrice));
      
      // Invalidate query
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      
      toast({ title: "Uğurlu!", description: `"${customItemName}" müvəqqəti satış kimi səbətə əlavə olundu.`, variant: "success" });
      
      setIsCustomItemOpen(false);
      setCustomItemName("");
      setCustomItemPrice("");
      setProductSearchQuery(""); // Clear search bar
    } catch (err: any) {
      toast({ title: "Xəta!", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingCustomItem(false);
    }
  };

  const handleScanInput = (val: string) => {
    setScanInput(val);
    const cleaned = val.trim().toUpperCase();
    if (!cleaned) return;

    // 1. Check if the scanned value matches an active serial number (IMEI)
    let foundProduct = null;
    let foundSerial = null;

    for (const p of sellableProducts) {
      if (p.activeSerials && p.activeSerials.map((s: string) => s.toUpperCase()).includes(cleaned)) {
        foundProduct = p;
        foundSerial = cleaned;
        break;
      }
    }

    // 2. If not found as a serial number, check if it matches a standard barcode
    if (!foundProduct) {
      foundProduct = sellableProducts.find((p) => p.barcode === val.trim());
    }

    if (foundProduct) {
      addProductToBasket(foundProduct, foundSerial);
      setScanInput(""); // Clear scan input!
      toast({
        title: "Skan edildi!",
        description: `Məhsul səbətə əlavə olundu: ${foundProduct.productName}${foundSerial ? ` (IMEI: ${foundSerial})` : ""}`,
        variant: "success"
      });
    }
  };

  const handleRemoveSerialFromBasket = (productId: number, serialNum: string) => {
    setBasket((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const updatedSerials = item.serialNumbers
              ? item.serialNumbers.filter((s: string) => s !== serialNum)
              : [];
            return {
              ...item,
              quantity: Math.max(0, item.quantity - 1),
              serialNumbers: updatedSerials,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast({
        title: "Xəta!",
        description: "Müştəri adı daxil edilməlidir.",
        variant: "destructive"
      });
      return;
    }

    setSavingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
          address: newCustomerAddress.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Müştəri qeyd edilərkən xəta baş verdi");
      }

      const createdCustomer = await res.json();
      
      // Invalidate queries so select list is updated
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      // Auto-select the newly created customer
      setSelectedCustomerId(createdCustomer.id.toString());
      setCustomerMode("existing");
      
      // Clear fields
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddress("");

      toast({
        title: "Müştəri yaradıldı! 👤",
        description: `"${createdCustomer.name}" müştərisi uğurla bazaya qeyd olundu və satış üçün seçildi.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Xəta!",
        description: err.message || "Texniki problem yarandı.",
        variant: "destructive",
      });
    } finally {
      setSavingCustomer(false);
    }
  };

  // Add item to basket
  const handleAddToBasket = () => {
    if (!selectedProductId) {
      toast({ title: "Xəta!", description: "Məhsul seçin", variant: "destructive" });
      return;
    }

    const prod = sellableProducts.find((p) => p.productId === parseInt(selectedProductId));
    if (!prod) return;

    if (prod.trackingType === "serialized") {
      toast({
        title: "Serial Məhsul Daxiletməsi",
        description: "Serial nömrəli məhsulları lütfən yuxarıdakı Sürətli Skaner bölməsindən birbaşa IMEI/Serial nömrəsini skan edərək əlavə edin.",
        variant: "destructive"
      });
      return;
    }

    const qty = parseFloat(selectedQuantity) || 1;
    if (qty <= 0) {
      toast({ title: "Xəta!", description: "Düzgün miqdar daxil edin", variant: "destructive" });
      return;
    }

    if (prod.unit.trim().toLowerCase() === "ədəd" && qty % 1 !== 0) {
      toast({
        title: "Xəta!",
        description: `"${prod.productName}" məhsulunun ölçü vahidi "ədəd" olduğu üçün miqdarı yalnız tam ədəd daxil edilə bilər (məs. 1, 2, 5).`,
        variant: "destructive"
      });
      return;
    }

    // Check if adding exceeds stock (only in sale mode)
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

    if (existingInBasket) {
      setBasket((prev) =>
        prev.map((item) => {
          if (item.productId === prod.productId) {
            return {
              ...item,
              quantity: item.quantity + qty,
              originalPrice: item.originalPrice || item.salePrice
            };
          }
          return item;
        })
      );
    } else {
      const defaultPrice = prod.lastSalePrice || prod.lastPurchasePrice || 0;
      setBasket((prev) => [
        ...prev,
        {
          productId: prod.productId,
          productName: prod.productName,
          unit: prod.unit,
          quantity: qty,
          salePrice: defaultPrice,
          originalPrice: defaultPrice,
          minPrice: prod.lastPurchasePrice,
          category: prod.category,
        },
      ]);
    }

    setSelectedProductId("");
    setSelectedQuantity("1");
    setProductSearchQuery(""); // Clear manual search query after adding!
  };

  // Remove item from basket
  const handleRemoveFromBasket = (id: number) => {
    setBasket((prev) => prev.filter((item) => item.productId !== id));
    setEditingPrices((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setEditingQuantities((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Update item field (quantity or sale price) in basket
  const handleUpdateBasketItem = (id: number, field: "quantity" | "salePrice", val: string) => {
    const value = parseFloat(val) || 0;
    setBasket((prev) =>
      prev.map((item) => {
        if (item.productId !== id) return item;

        // If updating quantity, verify it is an integer for "ədəd" unit
        if (field === "quantity") {
          if (item.unit.trim().toLowerCase() === "ədəd" && value % 1 !== 0) {
            toast({
              title: "Xəta!",
              description: `"${item.productName}" məhsulunun ölçü vahidi "ədəd" olduğu üçün miqdarı yalnız tam ədəd daxil edilə bilər (məs. 1, 2, 5).`,
              variant: "destructive",
            });
            return item;
          }
        }

        // If updating quantity, verify it doesn't exceed stock limit (only in sale mode)
        if (field === "quantity" && posMode === "sale") {
          const prod = activeStockLevels?.find((p) => p.productId === id);
          if (prod && value > prod.currentQuantity) {
            toast({
              title: "Xəta!",
              description: (isAdmin || currentUser?.staffCanViewStockBalances !== 0)
                ? `Anbar qalığı keçildi. Maksimum: ${prod.currentQuantity} ${prod.unit}`
                : "Anbarda bu miqdarda məhsul yoxdur.",
              variant: "destructive",
            });
            return item;
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const applyItemDiscount = (productId: number, val: string, type: "percent" | "amount") => {
    const inputVal = parseFloat(val) || 0;
    setBasket((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const orig = item.originalPrice || item.salePrice;
        let finalPrice = orig;

        if (type === "percent") {
          finalPrice = orig * (1 - inputVal / 100);
        } else {
          finalPrice = Math.max(0, orig - inputVal);
        }

        return {
          ...item,
          salePrice: parseFloat(finalPrice.toFixed(2)),
          originalPrice: orig,
        };
      })
    );
    setDiscountModalItem(null);
    setDiscountVal("");
    toast({ title: "Endirim tətbiq edildi! 🏷️", variant: "success" });
  };

  // Calculations
  const totalAmount = basket.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
  const totalCost = basket.reduce((sum, item) => sum + item.quantity * item.minPrice, 0);
  const profit = totalAmount - totalCost;
  const isSellingAtLoss = basket.some((item) => item.salePrice < item.minPrice);

  const parsedCommissions = React.useMemo(() => {
    try {
      return settings?.marketplaceCommissions ? JSON.parse(settings?.marketplaceCommissions) : {};
    } catch (e) {
      return {};
    }
  }, [settings?.marketplaceCommissions]);

  const marketplaceFee = React.useMemo(() => {
    if (salesChannel !== "birmarket.az") return 0;
    return basket.reduce((sum, item) => {
      const cat = item.category?.trim() || "";
      const rate = parsedCommissions[cat] || 0;
      return sum + (item.quantity * item.salePrice * rate / 100);
    }, 0);
  }, [salesChannel, basket, parsedCommissions]);

  const isCredit = paymentType === "Nisyə";

  // Mutations
  const createSaleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Satış tamamlanmadı");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-sales"] });

      // Find active customer if existing selected
      const activeCustomer = activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId));

      const loyaltyDiscount = useLoyaltyPoints ? parseFloat(loyaltyDiscountInput) || 0 : 0;
      // Construct a rich local snapshot of the sale object to pass to the receipt generator
      const saleObj = {
        id: data.id,
        saleDate: new Date().toISOString(),
        customerName: customerMode === "none" ? null : (customerMode === "existing" ? activeCustomer?.name : newCustomerName.trim()),
        customerPhone: customerMode === "existing" ? activeCustomer?.phone : newCustomerPhone.trim() || null,
        paymentType,
        bankName: paymentType === "Kart" ? bankName : null,
        paymentStatus: isCredit ? "credit" : "paid",
        creditDueDate: isCredit ? creditDueDate : null,
        notes: notes.trim() || null,
        applyEdv: activeSettings?.taxStatus === "edv" ? (applyEdv ? 1 : 0) : 1,
        totalAmount,
        loyaltyDiscountPaid: loyaltyDiscount,
        totalPaid: isCredit ? 0 : Math.max(0, totalAmount - loyaltyDiscount),
        remainingDebt: isCredit ? Math.max(0, totalAmount - loyaltyDiscount) : 0,
        items: basket.map((item) => ({
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice,
          serialNumbers: item.serialNumbers || [],
        }))
      };

      setLastCreatedSale(saleObj);
      setShowSuccessModal(true);

      toast({
        title: isCredit ? "Nisyə satışı qeydə alındı" : "Satış tamamlandı",
        description: isCredit ? `Borc: ${totalAmount.toFixed(2)} ₼` : `Gəlir: ${totalAmount.toFixed(2)} ₼`,
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Satış tamamlanarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Geri qaytarış tamamlanmadı");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      // Construct return snapshot for print success modal
      const returnObj = {
        id: data.id,
        saleDate: new Date().toISOString(),
        customerName: "Qaytarış",
        paymentType: "Geri Ödəniş",
        notes: notes.trim() || null,
        totalAmount,
        items: basket.map((item) => ({
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice
        }))
      };

      setLastCreatedSale(returnObj);
      setShowSuccessModal(true);

      toast({
        title: "Geri qaytarış tamamlandı 🔄",
        description: `Məbləğ: ${totalAmount.toFixed(2)} ₼`,
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Geri qaytarış qeydə alınarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (basket.length === 0) {
      toast({ title: "Xəta!", description: "Səbət boşdur", variant: "destructive" });
      return;
    }

    if (posMode === "return") {
      const payload = {
        saleId: null, // Sürətli qaytarış ad-hoc-dur
        reason: notes.trim() || "Sürətli qaytarış",
        items: basket.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          purchasePrice: item.minPrice,
          status: returnStatus,
        })),
      };

      if (!isOnline) {
        try {
          const enrichedOfflineReturn = saveOfflineReturn(payload);

          // Construct print representation for offline success modal
          enrichedOfflineReturn.items = basket.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unit: item.unit,
            quantity: item.quantity,
            salePrice: item.salePrice,
            purchasePrice: item.minPrice,
            status: returnStatus,
          }));

          setLastCreatedSale({
            ...enrichedOfflineReturn,
            totalAmount,
            customerName: "Qaytarış",
            paymentType: "Geri Ödəniş",
            notes: notes.trim() || null,
          });
          setShowSuccessModal(true);

          toast({
            title: "Oflayn geri qaytarış qeydə alındı 🔄",
            description: "Qaytarış yaddaşda saxlanıldı. İnternet bərpa olunduqda avtomatik sinxronizasiya ediləcək.",
            variant: "success",
          });
        } catch (err) {
          toast({
            title: "Xəta!",
            description: "Oflayn qaytarışı qeydə alarkən xəta baş verdi.",
            variant: "destructive",
          });
        }
        return;
      }

      createReturnMutation.mutate(payload);
      return;
    }

    if (customerMode === "new") {
      toast({
        title: "Müştəri qeydiyyatı gözlənilir!",
        description: "Lütfən, yeni müştərini yadda saxlamaq üçün 'Müştərini Yadda Saxla' düyməsinə klikləyin.",
        variant: "destructive"
      });
      return;
    }

    if (isSellingAtLoss && !isAdmin) {
      toast({
        title: "Məhdudiyyət! 🔒",
        description: "Kassir və satıcı heyəti (Staff) malları maya dəyərindən ucuz sata bilməz! Satışı tamamlamaq üçün qiyməti dəyişin.",
        variant: "destructive",
      });
      return;
    }

    if (isSellingAtLoss) {
      toast({
        title: "Maya dəyərindən ucuz satış ⚠️",
        description: "Bəzi məhsullar maya dəyərindən aşağı qiymətə satılır.",
        variant: "default",
      });
    }

    if (isCredit) {
      if (customerMode === "none") {
        toast({ title: "Xəta!", description: "Nisyə üçün müştəri seçilməlidir", variant: "destructive" });
        return;
      }
      if (!creditDueDate) {
        toast({ title: "Xəta!", description: "Nisyə müddəti (son tarix) daxil edilməlidir", variant: "destructive" });
        return;
      }
    }

    if (posMode === "sale" && paymentType === "Kart" && !bankName) {
      toast({ title: "Xəta!", description: "Kart ödənişi üçün bank seçilməlidir", variant: "destructive" });
      return;
    }

    // Prepare Customer Data
    let customerId: number | null = null;
    let customerName: string | null = null;
    let customerPhone: string | null = null;
    let customerEmail: string | null = null;
    let customerAddress: string | null = null;

    if (customerMode === "existing" && selectedCustomerId) {
      const cust = activeCustomers?.find((c) => c.id === parseInt(selectedCustomerId));
      if (cust) {
        customerId = cust.id;
        customerName = cust.name;
        customerPhone = cust.phone;
        customerEmail = cust.email;
        customerAddress = cust.address;
      }
    }

    let loyaltyDiscount = 0;
    if (posMode === "sale" && useLoyaltyPoints) {
      loyaltyDiscount = parseFloat(loyaltyDiscountInput) || 0;
      if (loyaltyDiscount <= 0) {
        toast({ title: "Xəta!", description: "Düzgün bonus məbləği daxil edin", variant: "destructive" });
        return;
      }
      if (loyaltyDiscount > customerLoyaltyPoints) {
        toast({ title: "Xəta!", description: "Müştərinin kifayət qədər bonus balı yoxdur", variant: "destructive" });
        return;
      }
      if (loyaltyDiscount > totalAmount) {
        toast({ title: "Xəta!", description: "Bonus məbləği satışın ümumi məbləğindən çox ola bilməz", variant: "destructive" });
        return;
      }
      const minPoints = activeSettings?.loyaltyMinPointsRedeem ? parseFloat(activeSettings.loyaltyMinPointsRedeem) : 0;
      if (minPoints > 0 && loyaltyDiscount < minPoints) {
        toast({
          title: "Xəta!",
          description: `Minimum istifadə edilə bilən bonus balı: ${minPoints} bal`,
          variant: "destructive"
        });
        return;
      }
    }

    const payload = {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      paymentType,
      bankName: paymentType === "Kart" ? (bankName || null) : null,
      creditDueDate: isCredit ? creditDueDate : null,
      notes: notes.trim() || null,
      applyEdv: activeSettings?.taxStatus === "edv" ? (applyEdv ? 1 : 0) : 1,
      totalAmount,
      totalCost,
      offlineId: `ONL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      salesChannel,
      marketplaceFee,
      warehouseId: currentUser?.warehouseId || 1,
      shiftId: activeShift?.id || null,
      loyaltyDiscountPaid: loyaltyDiscount,
      items: basket.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        salePrice: item.salePrice,
        purchasePrice: item.minPrice,
        serialNumbers: item.serialNumbers || [],
      })),
    };

    if (!isOnline) {
      try {
        const enrichedOfflineSale = saveOfflineSale(payload);
        
        // Enrich items with catalog properties for thermal prints
        enrichedOfflineSale.items = basket.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          salePrice: item.salePrice,
          purchasePrice: item.minPrice,
        }));

        setLastCreatedSale(enrichedOfflineSale);
        setShowSuccessModal(true);

        toast({
          title: isCredit ? "Oflayn Nisyə satışı qeydə alındı" : "Oflayn Satış tamamlandı 🧾",
          description: `Satış yaddaşda saxlanıldı. İnternet bərpa olunduqda avtomatik buluda sinxronizasiya ediləcək.`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Xəta!",
          description: "Oflayn satışı qeydə alarkən xəta baş verdi.",
          variant: "destructive",
        });
      }
      return;
    }

    createSaleMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 animate-in fade-in-0">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">POS Terminal</h2>
          <p className="text-xs text-gray-400 mt-1">Sürətli satış, kassa və müştəri borclarının idarəedilməsi</p>
        </div>

        {/* Mode Toggle Controls */}
        <div className="flex bg-white/70 p-1 rounded-xl border border-gray-100/50 shadow-sm glass">
          <button
            onClick={() => {
              if (basket.length > 0) {
                if (confirm("Səbət təmizlənəcək. Davam edilsin?")) setBasket([]);
                else return;
              }
              setPosMode("sale");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              posMode === "sale"
                ? "bg-primary text-white shadow-md shadow-primary/10"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            ⚡ Satış Rejimi
          </button>
          <button
            onClick={() => {
              if (basket.length > 0) {
                if (confirm("Səbət təmizlənəcək. Davam edilsin?")) setBasket([]);
                else return;
              }
              setPosMode("return");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              posMode === "return"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/10"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            🔄 Sürətli Qaytarış
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Side: Basket & Product Selection */}
        <div className="xl:col-span-2 space-y-6">
          {/* Product Grid */}
          <ProductGrid
            posMode={posMode}
            stockLevels={activeStockLevels}
            currentUser={currentUser}
            isAdmin={isAdmin}
            basket={basket}
            scanInput={scanInput}
            productSearchQuery={productSearchQuery}
            selectedProductId={selectedProductId}
            selectedQuantity={selectedQuantity}
            onScanInput={setScanInput}
            onProductSearchQuery={setProductSearchQuery}
            onSelectedProductId={setSelectedProductId}
            onSelectedQuantity={setSelectedQuantity}
            onAddToBasket={addProductToBasket}
            onOpenQuickCreate={(name) => {
              setQuickCreateName(name);
              setIsQuickCreateOpen(true);
            }}
            onOpenCustomItem={(name) => {
              setCustomItemName(name);
              setIsCustomItemOpen(true);
            }}
          />

          {/* Cart Panel */}
          <CartPanel
            basket={basket}
            posMode={posMode}
            isAdmin={isAdmin}
            onRemoveFromBasket={handleRemoveFromBasket}
            onUpdateItem={handleUpdateBasketItem}
            onRemoveSerial={handleRemoveSerialFromBasket}
            onOpenDiscountModal={(item: BasketItem) => {
              setDiscountModalItem(item);
              setDiscountVal("");
            }}
            onPrintPickTicket={async () => {
              if (basket.length === 0) {
                toast({ title: "Xəta!", description: "Səbət boşdur", variant: "destructive" });
                return;
              }
              const ok = await printPickTicket(basket, holdLabel || "");
              if (ok) {
                toast({ title: "Yığım bileti göndərildi! 📋", variant: "success" });
              } else {
                toast({ title: "Xəta!", description: "Çap edilərkən səhv baş verdi", variant: "destructive" });
              }
            }}
          />
        </div>

        {/* Right Side: Customer & Checkout Actions */}
        <div className="space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">Müştəri Seçimi</h3>
            <div className="flex flex-col xs:flex-row gap-2 text-xs font-semibold mb-4">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("none");
                  setSelectedCustomerId("");
                }}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "none" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Yoxdur (Anonim)
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "existing" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Mövcud Müştəri
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`flex-1 py-2.5 border rounded-xl cursor-pointer transition-all ${
                  customerMode === "new" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Yeni Müştəri
              </button>
            </div>

            {/* Existing Customer Dropdown */}
            {customerMode === "existing" && (
              <div className="space-y-2 text-xs font-semibold animate-in slide-in-from-top-2">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Müştəri seçin</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setUseLoyaltyPoints(false);
                    setLoyaltyDiscountInput("0");
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="">Müştəri seçin...</option>
                  {activeCustomers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>

                {selectedCustomerId && (
                  <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Mövcud Bonus:</span>
                      <span className="font-bold text-primary">{customerLoyaltyPoints.toFixed(2)} bal</span>
                    </div>

                    {customerLoyaltyPoints > 0 && posMode === "sale" && (
                      <div className="space-y-2 pt-1.5 border-t border-primary/10">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                          <input
                            type="checkbox"
                            checked={useLoyaltyPoints}
                            onChange={(e) => {
                              setUseLoyaltyPoints(e.target.checked);
                              setLoyaltyDiscountInput(e.target.checked ? Math.min(customerLoyaltyPoints, totalAmount).toFixed(2) : "0");
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <span>Bonus ballarından istifadə et</span>
                        </label>

                        {useLoyaltyPoints && (
                          <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                            <label className="text-gray-400 text-[10px] uppercase block">İstifadə ediləcək bal (1 bal = 1 ₼)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max={Math.min(customerLoyaltyPoints, totalAmount)}
                              value={loyaltyDiscountInput}
                              onChange={(e) => {
                                const val = Math.min(customerLoyaltyPoints, totalAmount, parseFloat(e.target.value) || 0);
                                setLoyaltyDiscountInput(val.toString());
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-bold font-mono text-xs bg-white"
                            />
                            {settings?.loyaltyMinPointsRedeem && parseFloat(settings.loyaltyMinPointsRedeem) > 0 && (
                              <span className="text-[9px] text-gray-400 block font-normal">
                                * Minimum istifadə balı: {settings.loyaltyMinPointsRedeem} bal
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* New Customer Form */}
            {customerMode === "new" && (
              <div className="space-y-3 text-xs font-semibold animate-in slide-in-from-top-2">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ad Soyad *</label>
                  <input
                    type="text"
                    placeholder="Məs. Əli Məmmədov"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telefon</label>
                    <input
                      type="text"
                      placeholder="055-123-4567"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">E-poçt (Email)</label>
                    <input
                      type="email"
                      placeholder="ad@mail.com"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ünvan</label>
                  <input
                    type="text"
                    placeholder="Məs. Yasamal, Şərifzadə küç. 45"
                    value={newCustomerAddress}
                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveNewCustomer}
                  disabled={savingCustomer || !newCustomerName.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer text-center text-xs tracking-wide uppercase transition-all shadow-md shadow-emerald-600/10 hover-elevate disabled:opacity-50 mt-2"
                >
                  {savingCustomer ? "Yadda saxlanılır..." : "Müştərini Yadda Saxla 💾"}
                </button>
              </div>
            )}
          </div>

          {/* Payment Panel */}
          <PaymentPanel
            basket={basket}
            posMode={posMode}
            isAdmin={isAdmin}
            isOnline={isOnline}
            totalAmount={totalAmount}
            totalCost={totalCost}
            profit={profit}
            marketplaceFee={marketplaceFee}
            isCredit={isCredit}
            customerMode={customerMode}
            selectedCustomerId={selectedCustomerId}
            customerLoyaltyPoints={customerLoyaltyPoints}
            paymentType={paymentType}
            bankName={bankName}
            creditDueDate={creditDueDate}
            notes={notes}
            salesChannel={salesChannel}
            applyEdv={applyEdv}
            returnStatus={returnStatus}
            cashReceivedInput={cashReceivedInput}
            useLoyaltyPoints={useLoyaltyPoints}
            loyaltyDiscountInput={loyaltyDiscountInput}
            activeBanksList={activeBanksList}
            activeSettings={activeSettings}
            isSellingAtLoss={isSellingAtLoss}
            heldSales={activeHeldSales}
            createSalePending={createSaleMutation.isPending}
            createReturnPending={createReturnMutation.isPending}
            onPaymentType={setPaymentType}
            onBankName={setBankName}
            onCreditDueDate={setCreditDueDate}
            onNotes={setNotes}
            onSalesChannel={setSalesChannel}
            onApplyEdv={setApplyEdv}
            onReturnStatus={setReturnStatus}
            onCashReceived={setCashReceivedInput}
            onUseLoyaltyPoints={setUseLoyaltyPoints}
            onLoyaltyDiscountInput={setLoyaltyDiscountInput}
            onCheckout={handleCheckout}
            onOpenHoldModal={() => setIsHoldModalOpen(true)}
            onOpenHeldList={() => { setIsHeldListOpen(true); refetchHeldSales(); }}
            onPrintPickTicket={async () => {
              if (basket.length === 0) {
                toast({ title: "Xəta!", description: "Səbət boşdur", variant: "destructive" });
                return;
              }
              const ok = await printPickTicket(basket, holdLabel || "");
              if (ok) toast({ title: "Yığım bileti gönderildi! 📋", variant: "success" });
              else toast({ title: "Xəta!", description: "Çap edilerken səhv baş verdi", variant: "destructive" });
            }}
          />
        </div>
      </div>

      {/* === HOLD CART MODAL === */}
      {isHoldModalOpen && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-sm p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Satışı Saxla</h3>
                <p className="text-[11px] text-gray-400">{basket.length} məhsul, {totalAmount.toFixed(2)} ₼</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px] font-bold">Ad / Etiket (ixtiyari)</label>
              <input
                type="text"
                placeholder="məs. Müştəri 2, Masa 4..."
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHoldCart()}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50 focus:ring-1 focus:ring-amber-400 text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setIsHoldModalOpen(false); setHoldLabel(""); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all"
              >
                Ləğv Et
              </button>
              <button
                onClick={handleHoldCart}
                disabled={isHoldingCart}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Bookmark className="w-4 h-4" />
                {isHoldingCart ? "Saxlanır..." : "Saxla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === HELD SALES LIST MODAL === */}
      {isHeldListOpen && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-7 space-y-5 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <BookmarkCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Saxlanmış Satışlar</h3>
                  <p className="text-[11px] text-gray-400">{heldSales?.length || 0} saxlanmış satış</p>
                </div>
              </div>
              <button onClick={() => setIsHeldListOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {(!heldSales || heldSales.length === 0) ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Saxlanmış satış yoxdur</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {heldSales.map((held) => {
                  let items: any[] = [];
                  try { items = JSON.parse(held.basketJson); } catch {}
                  const heldTotal = items.reduce((s, i) => s + i.quantity * i.salePrice, 0);
                  return (
                    <div key={held.id} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50/50 hover:border-blue-200 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{held.label || "Adsız Satış"}</p>
                        <p className="text-[11px] text-gray-400">
                          {items.length} məhsul • <span className="font-mono font-bold text-gray-700">{heldTotal.toFixed(2)} ₼</span>
                        </p>
                        <p className="text-[10px] text-gray-300">
                          {new Date(held.heldAt).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })} • {held.heldBy}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => handleResumeHeld(held)}
                          className="px-3 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition flex items-center gap-1"
                        >
                          ▶️ Davam
                        </button>
                        <button
                          onClick={() => handleDeleteHeld(held.id)}
                          className="px-2 py-2 border border-red-100 text-red-500 font-bold rounded-lg text-xs hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === INDIVIDUAL ITEM DISCOUNT MODAL === */}
      {discountModalItem && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-sm p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg">
                🏷️
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Məhsul Endirimi</h3>
                <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{discountModalItem.productName}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${discountType === "percent" ? "bg-white text-gray-900 shadow-xs" : "text-gray-400"}`}
                >
                  Faiz (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("amount")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${discountType === "amount" ? "bg-white text-gray-900 shadow-xs" : "text-gray-400"}`}
                >
                  Məbləğ (₼)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px] font-bold">Endirim Dəyəri</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={discountVal}
                    onChange={(e) => setDiscountVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        applyItemDiscount(discountModalItem.productId, discountVal, discountType);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm font-bold"
                    autoFocus
                  />
                  <span className="absolute right-4 top-3 text-gray-400 font-bold text-xs">
                    {discountType === "percent" ? "%" : "₼"}
                  </span>
                </div>
              </div>

              {/* Min price warning (OpenTHC guard style) */}
              {(() => {
                const val = parseFloat(discountVal) || 0;
                const orig = discountModalItem.originalPrice || discountModalItem.salePrice;
                const targetPrice = discountType === "percent" ? orig * (1 - val / 100) : orig - val;
                const isPriceBelowMin = targetPrice < discountModalItem.minPrice;
                
                if (isPriceBelowMin) {
                  return (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2 text-[11px] text-red-700 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-bold">Maya Dəyərindən Aşağı! ⚠️</p>
                        <p className="text-red-600/90 leading-tight">Məhsulun mayası: {discountModalItem.minPrice.toFixed(2)} ₼. Satış zərərlə yekunlaşacaq.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDiscountModalItem(null); setDiscountVal(""); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all"
              >
                Ləğv Et
              </button>
              <button
                onClick={() => applyItemDiscount(discountModalItem.productId, discountVal, discountType)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all"
              >
                Tətbiq Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal Overlay */}
      {showSuccessModal && lastCreatedSale && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-8 text-center space-y-6">
            
            {/* Success Icon */}
            <div className={`mx-auto size-16 rounded-full flex items-center justify-center border shadow-sm ${
              lastCreatedSale.customerName === "Qaytarış"
                ? "bg-amber-50 text-amber-600 border-amber-100"
                : "bg-green-50 text-green-600 border-green-100"
            }`}>
              <CheckCircle className="w-8 h-8" />
            </div>

            {/* Title / Header */}
            <div className="space-y-1">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {lastCreatedSale.customerName === "Qaytarış"
                  ? "Geri Qaytarış Tamamlandı! 🔄"
                  : "Satış Uğurla Tamamlandı! 🎉"}
              </h3>
              <p className="text-xs text-gray-400">
                {lastCreatedSale.id && lastCreatedSale.id.toString().startsWith("OFL")
                  ? (lastCreatedSale.id.toString().startsWith("OFL-RET") ? "Oflayn Geri Qaytarış qeyd edildi" : "Oflayn Satış qeyd edildi")
                  : (lastCreatedSale.customerName === "Qaytarış" ? `Qaytarış № ${lastCreatedSale.id} yaradıldı` : `Qaimə #${lastCreatedSale.id.toString().padStart(5, "0")} yaradıldı`)}
              </p>
            </div>

            {/* Məbləğ Info Box */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center space-y-0.5 font-semibold">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                {lastCreatedSale.customerName === "Qaytarış" ? "Geri Ödənilən Məbləğ" : "Ümumi Məbləğ"}
              </span>
              <span className="text-2xl font-black text-gray-950 font-mono">{lastCreatedSale.totalAmount.toFixed(2)} ₼</span>
              <span className="text-[10px] text-gray-500">
                {lastCreatedSale.customerName === "Qaytarış" ? `Tip: ${returnStatus === "returned_to_stock" ? "Anbara Qayıdan" : "Deffekt (Zay)"}` : `Ödəniş Üsulu: ${lastCreatedSale.paymentType}${lastCreatedSale.bankName ? ` (${lastCreatedSale.bankName})` : ""}`}
              </span>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  try {
                    const success = await printReceipt(lastCreatedSale, activeSettings);
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
                  } catch (e) {
                    toast({
                      title: "Xəta!",
                      description: "Qəbz çapında xəta baş verdi.",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full py-3 bg-gray-950 hover:bg-black text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition-all hover-elevate font-semibold"
              >
                <Receipt className="w-4 h-4" /> Termal Qəbzi Çap Et
              </button>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  onClick={() => {
                    if (lastCreatedSale.id && lastCreatedSale.id.toString().startsWith("OFL")) {
                      toast({
                        title: "Oflayn Rejim Məhdudiyyəti 🔒",
                        description: "Oflayn əməliyyatların ətraflı fakturasına yalnız sinxronizasiyadan sonra (onlayn rejimdə) baxıla bilər.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const sId = lastCreatedSale.id;
                    handleResetPOS();
                    if (lastCreatedSale.customerName === "Qaytarış") {
                      setLocation(`/qaytarislar/${sId}`);
                    } else {
                      setLocation(`/satislar/${sId}`);
                    }
                  }}
                  className="py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 animate-pulse"
                >
                  Qaiməyə Bax
                </button>
                <button
                  onClick={handleResetPOS}
                  className="py-2.5 bg-primary text-white rounded-xl cursor-pointer hover:bg-primary/90 shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5"
                >
                  Yeni Əməliyyat
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Sürətli Məhsul Yaratma Modalı */}
      {isQuickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative animate-in zoom-in-95 duration-200">
            {/* Top Border Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-2xl"></div>

            <div className="flex items-center justify-between mt-2">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Kataloqda Yeni Məhsul Yarat
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all cursor-pointer animate-in fade-in duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="space-y-4 text-xs font-semibold">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsulun Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Məs. Şokolad Alpin Gold"
                  value={quickCreateName}
                  onChange={(e) => setQuickCreateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold"
                />
              </div>

              {/* Price & Barcode Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Satış Qiyməti (₼) *</label>
                  <input
                    type="text"
                    required
                    placeholder="0.00"
                    value={quickCreatePrice}
                    onChange={(e) => setQuickCreatePrice(cleanNumberInput(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Barkod</label>
                  <input
                    type="text"
                    placeholder="Skan edin və ya boş buraxın"
                    value={quickCreateBarcode}
                    onChange={(e) => setQuickCreateBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold"
                  />
                </div>
              </div>

              {/* Category & Unit Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kateqoriya *</label>
                  <select
                    value={quickCreateCategory}
                    onChange={(e) => setQuickCreateCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold text-gray-700 cursor-pointer"
                  >
                    <option value="Ümumi">Ümumi</option>
                    <option value="Ərzaq">Ərzaq</option>
                    <option value="Geyim">Geyim</option>
                    <option value="Elektronika">Elektronika</option>
                    <option value="Kosmetika">Kosmetika</option>
                    <option value="Digər">Digər</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Ölçü Vahidi *</label>
                  <select
                    value={quickCreateUnit}
                    onChange={(e) => setQuickCreateUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white text-xs font-bold text-gray-700 cursor-pointer"
                  >
                    <option value="ədəd">ədəd</option>
                    <option value="kq">kq</option>
                    <option value="litr">litr</option>
                    <option value="metr">metr</option>
                    <option value="paket">paket</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-100 cursor-pointer transition-all"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickCreate}
                  className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/95 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-primary/10"
                >
                  {isSubmittingQuickCreate ? "Yaradılır..." : "Yarat və Səbətə At"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Müvəqqəti Sərbəst Satış Modalı */}
      {isCustomItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 relative animate-in zoom-in-95 duration-200">
            {/* Top Border Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-t-2xl"></div>

            <div className="flex items-center justify-between mt-2">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Müvəqqəti Sərbəst Satış
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomItemOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomItemSubmit} className="space-y-4 text-xs font-semibold">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Məhsulun/Xidmətin Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Məs. Qeyri-kataloq məhsulu"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white text-xs font-bold"
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Satış Qiyməti (₼) *</label>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(cleanNumberInput(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white text-xs font-mono font-bold"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCustomItemOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-100 cursor-pointer transition-all"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomItem}
                  className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-purple-600/10"
                >
                  {isSubmittingCustomItem ? "Əlavə edilir..." : "Səbətə Əlavə Et"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
