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
import { printReceipt } from "../components/ReceiptPrint.tsx";
import { sanitizeQtyInput } from "../lib/utils.ts";

interface BasketItem {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  minPrice: number; // Snapshot of lastPurchasePrice
  serialNumbers?: string[];
  category?: string;
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
  const [basket, setBasket] = useState<BasketItem[]>([]);
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
  };

  // Queries
  const { data: stockLevels, isLoading: isStockLoading } = useQuery<any[]>({
    queryKey: ["/api/stock/levels"],
    queryFn: async () => {
      const res = await fetch("/api/stock/levels");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isOnline,
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
  
  const cleanNumberInput = (val: string): string => {
    const onlyDigitsAndDot = val.replace(/[^0-9.]/g, "");
    const parts = onlyDigitsAndDot.split(".");
    const singleDot = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
    return sanitizeQtyInput(singleDot);
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

  const addProductToBasket = (prod: any, serialNum?: string | null) => {
    const qty = 1;
    
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
            return {
              ...item,
              quantity: item.quantity + qty,
              serialNumbers: updatedSerials,
            };
          }
          return item;
        })
      );
    } else {
      setBasket((prev) => [
        ...prev,
        {
          productId: prod.productId,
          productName: prod.productName,
          unit: prod.unit,
          quantity: qty,
          salePrice: prod.lastSalePrice || prod.lastPurchasePrice || 0,
          minPrice: prod.lastPurchasePrice,
          serialNumbers: serialNum ? [serialNum] : [],
          category: prod.category,
        },
      ]);
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
        prev.map((item) =>
          item.productId === prod.productId
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setBasket((prev) => [
        ...prev,
        {
          productId: prod.productId,
          productName: prod.productName,
          unit: prod.unit,
          quantity: qty,
          salePrice: prod.lastSalePrice || prod.lastPurchasePrice || 0, // Defaults to last sale price, then purchase price
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
        totalPaid: isCredit ? 0 : totalAmount,
        remainingDebt: isCredit ? totalAmount : 0,
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
          {/* Product selector card */}
          <div className={`bg-white border p-6 rounded-2xl shadow-xs glass-card transition-all ${posMode === "return" ? "border-amber-300 ring-2 ring-amber-500/10" : "border-gray-100"}`}>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">
              {posMode === "return" ? "Geri Qaytarılacaq Məhsul Seçin" : "Səbətə Məhsul Əlavə Et"}
            </h3>

            {posMode === "return" && (
              <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold flex items-start gap-2.5 animate-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block mb-0.5 text-amber-900">Nisyə (Kredit) Satışların Qaytarılması:</span>
                  Nisyə satılmış malların geri qaytarılması üçün <strong className="text-amber-950 font-bold">"Satış Tarixçəsi"</strong> bölməsindən müvafiq qaiməni tapıb qaytarış edin. Sürətli qaytarış zamanı birbaşa nağd geri ödəniş hesablanır.
                </div>
              </div>
            )}

            {/* Quick Scan Input */}
            <div className="mb-4 space-y-1.5 animate-in slide-in-from-top-1">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Sürətli Skan / Barkod və ya IMEI (Serial №)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Barkod və ya IMEI skan edin..."
                  value={scanInput}
                  onChange={(e) => handleScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleScanInput(scanInput);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-xs font-bold"
                />
                <Barcode className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Manual Product Search Bar */}
            <div className="relative w-full mb-3">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Satılacaq məhsul axtar (ad, barkod və ya kateqoriya)..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 text-xs font-bold focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}
              />
            </div>

            {/* Premium Autocomplete Search Results Grid */}
            {productSearchQuery.trim() && (
              <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-lg max-h-60 overflow-y-auto space-y-2 mb-4 animate-in fade-in duration-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Axtarış Nəticələri ({searchedProducts.length})
                </span>
                {searchedProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">Axtarışa uyğun məhsul tapılmadı.</p>
                ) : (
                  searchedProducts.map((p) => {
                    const price = p.lastSalePrice || p.lastPurchasePrice || 0;
                    return (
                      <div
                        key={p.productId}
                        onClick={() => {
                          if (p.trackingType === "serialized") {
                            toast({
                              title: "Diqqət!",
                              description: "Serial nömrəli (IMEI) məhsulları lütfən yuxarıdakı 'Sürətli Skan' bölməsindən birbaşa skan edərək əlavə edin.",
                              variant: "destructive"
                            });
                          } else {
                            addProductToBasket(p);
                            setProductSearchQuery(""); // Reset search bar
                            toast({
                              title: "Əlavə edildi!",
                              description: `"${p.productName}" səbətə əlavə olundu.`,
                              variant: "success"
                            });
                          }
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-primary/5 rounded-xl cursor-pointer transition-colors border border-gray-50 hover:border-primary/10 text-xs font-semibold text-left"
                      >
                        <div className="text-left">
                          <span className="block font-bold text-gray-900">{p.productName}</span>
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            {(isAdmin || currentUser?.staffCanViewStockBalances !== 0) ? `Qalıq: ${p.currentQuantity} ${p.unit} | ` : ""}Barkod: {p.barcode || "Yoxdur"}
                          </span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-mono font-bold text-gray-900">{price.toFixed(2)} ₼</span>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wider">
                            + Əlavə Et
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 text-xs font-semibold">
              <div className="flex-1 w-full">
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedProductId(val);
                    if (val) {
                      const prod = sellableProducts.find((p) => p.productId === parseInt(val));
                      if (prod) {
                        if (prod.trackingType === "serialized") {
                          toast({
                            title: "Diqqət!",
                            description: "Serial nömrəli (IMEI) məhsulları lütfən yuxarıdakı 'Sürətli Skan' bölməsindən birbaşa skan edərək əlavə edin.",
                            variant: "destructive"
                          });
                        } else {
                          addProductToBasket(prod);
                          setSelectedProductId(""); // Reset select so it can be selected again
                          toast({
                            title: "Əlavə edildi!",
                            description: `"${prod.productName}" səbətə əlavə olundu.`,
                            variant: "success"
                          });
                        }
                      }
                    }
                  }}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}
                >
                  <option value="">
                    {searchedProducts.length === 0 ? "Axtarışa uyğun məhsul tapılmadı..." : "Məhsul seçin..."}
                  </option>
                  {searchedProducts.map((p) => {
                    const priceLabel = posMode === "sale"
                      ? (p.lastSalePrice 
                        ? `(Satış: ${p.lastSalePrice.toFixed(2)} ₼, Alış: ${p.lastPurchasePrice.toFixed(2)} ₼)`
                        : `(Alış: ${p.lastPurchasePrice.toFixed(2)} ₼)`)
                      : `(Geri Ödəniş: ${(p.lastSalePrice || p.lastPurchasePrice || 0).toFixed(2)} ₼)`;
                    return (
                      <option key={p.productId} value={p.productId}>
                        {p.productName} {(isAdmin || currentUser?.staffCanViewStockBalances !== 0) ? `— Qalıq: ${p.currentQuantity} ${p.unit} ` : ""}{priceLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="w-full sm:w-24">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Miqdar"
                  value={selectedQuantity}
                  onChange={(e) => {
                    const sanitized = sanitizeQtyInput(e.target.value);
                    setSelectedQuantity(sanitized);
                  }}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}
                />
              </div>
              <button
                onClick={handleAddToBasket}
                className={`w-full sm:w-auto px-5 py-3 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all ${
                  posMode === "return"
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/10"
                    : "bg-primary hover:bg-primary/90 shadow-primary/10"
                }`}
              >
                <Plus className="w-4 h-4" /> {posMode === "return" ? "Qaytarışa əlavə et" : "Əlavə et"}
              </button>
            </div>
          </div>

          {/* Selected Basket Items Table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-sm">Seçilmiş Məhsullar</h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <ShoppingCart className="w-4 h-4" />
                <span>{basket.length} növ məhsul</span>
              </div>
            </div>

            {basket.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                Səbət boşdur. Kataloqdan məhsul seçib əlavə edin.
              </div>
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
                      <th className="py-3 px-2 w-12 text-center"></th>
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
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Ölçü vahidi: {item.unit}
                            </span>
                            {item.serialNumbers && item.serialNumbers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 max-w-xs">
                                {item.serialNumbers.map((s: string) => (
                                  <span key={s} className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1">
                                    {s}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSerialFromBasket(item.productId, s)}
                                      className="text-red-500 hover:text-red-700 font-bold font-sans cursor-pointer text-[10px]"
                                      title="Serialı sil"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-2 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingQuantities[item.productId] !== undefined ? editingQuantities[item.productId] : item.quantity.toString()}
                              onChange={(e) => {
                                const sanitized = cleanNumberInput(e.target.value);
                                setEditingQuantities((prev) => ({ ...prev, [item.productId]: sanitized }));
                                if (!sanitized.endsWith(".")) {
                                  handleUpdateBasketItem(item.productId, "quantity", sanitized);
                                }
                              }}
                              onBlur={() => {
                                setEditingQuantities((prev) => {
                                  const copy = { ...prev };
                                  delete copy[item.productId];
                                  return copy;
                                });
                              }}
                              className={`w-16 px-2 py-1 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"} ${item.serialNumbers && item.serialNumbers.length > 0 ? "bg-gray-100 cursor-not-allowed opacity-80" : ""}`}
                              readOnly={item.serialNumbers && item.serialNumbers.length > 0}
                              title={item.serialNumbers && item.serialNumbers.length > 0 ? "Serial nömrəli məhsulun miqdarı skan edilmiş IMEIlərin sayı ilə təyin edilir" : ""}
                            />
                          </td>
                          <td className="py-4 px-2 text-right font-bold text-gray-500 font-mono">
                            {item.minPrice.toFixed(2)} ₼
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingPrices[item.productId] !== undefined ? editingPrices[item.productId] : item.salePrice.toString()}
                                onChange={(e) => {
                                  const sanitized = cleanNumberInput(e.target.value);
                                  setEditingPrices((prev) => ({ ...prev, [item.productId]: sanitized }));
                                  if (!sanitized.endsWith(".")) {
                                    handleUpdateBasketItem(item.productId, "salePrice", sanitized);
                                  }
                                }}
                                onBlur={() => {
                                  setEditingPrices((prev) => {
                                    const copy = { ...prev };
                                    delete copy[item.productId];
                                    return copy;
                                  });
                                }}
                                className={`w-20 px-2 py-1 border rounded-lg text-right focus:outline-none focus:ring-1 ${
                                  isLoss
                                    ? "border-red-400 focus:ring-red-500 bg-red-50/50"
                                    : (posMode === "return" ? "border-gray-200 focus:ring-amber-500" : "border-gray-200 focus:ring-primary")
                                }`}
                              />
                              {isLoss && (
                                <span className="text-[9px] font-bold text-red-500 mt-1">
                                  Min: {item.minPrice.toFixed(2)} ₼
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right font-bold text-gray-900 font-mono">
                            {(item.quantity * item.salePrice).toFixed(2)} ₼
                          </td>
                          {posMode === "sale" && isAdmin && (
                            <td className={`py-4 px-2 text-right font-bold font-mono ${itemProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {itemProfit >= 0 ? "+" : ""}
                              {itemProfit.toFixed(2)}
                            </td>
                          )}
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleRemoveFromBasket(item.productId)}
                              className="text-gray-400 hover:text-red-500 cursor-pointer transition-all"
                            >
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
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                >
                  <option value="">Müştəri seçin...</option>
                  {activeCustomers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
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

                {/* Save Customer Button */}
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

          {/* Checkout & Totals Card */}
          <div className={`bg-white border p-6 rounded-2xl shadow-xs glass-card transition-all ${posMode === "return" ? "border-amber-300 ring-2 ring-amber-500/10" : "border-gray-100"}`}>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4">
              {posMode === "return" ? "Geri Qaytarış və Yekun" : "Ödəniş və Yekun"}
            </h3>

            {/* Totals panel */}
            <div className="space-y-2 border-b border-gray-100 pb-4 mb-4 text-xs font-medium text-gray-500 font-semibold">
              <div className="flex justify-between">
                <span>{posMode === "return" ? "Geri Ödəniləcək Cəmi" : "Cəmi məbləğ"}</span>
                <span className={`font-bold font-mono text-sm ${posMode === "return" ? "text-amber-600" : "text-gray-900"}`}>
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>
              {posMode === "sale" && salesChannel === "birmarket.az" && (
                <>
                  <div className="flex justify-between text-purple-600 font-bold animate-in fade-in">
                    <span>birmarket.az Komissiyası</span>
                    <span className="font-mono">-{marketplaceFee.toFixed(2)} ₼</span>
                  </div>
                  <div className="flex justify-between text-gray-900 font-bold border-t border-dashed border-gray-100 pt-1.5 animate-in fade-in">
                    <span>Bizə Qalan Xalis</span>
                    <span className="font-mono">{(totalAmount - marketplaceFee).toFixed(2)} ₼</span>
                  </div>
                </>
              )}
              {posMode === "sale" && isAdmin && (
                <>
                  <div className="flex justify-between">
                    <span>Məhsul mayası</span>
                    <span className="font-mono">{totalCost.toFixed(2)} ₼</span>
                  </div>
                  {profit >= 0 ? (
                    <div className="flex justify-between items-center text-green-600 bg-green-50/50 p-2.5 rounded-xl border border-green-100/50 glass animate-in fade-in">
                      <span className="font-semibold">Təxmini Mənfəət</span>
                      <span className="font-black font-mono text-sm">+{profit.toFixed(2)} ₼</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-red-600 bg-red-50/55 p-2.5 rounded-xl border border-red-100/50 glass animate-in fade-in font-bold">
                      <span className="font-semibold">Təxmini Zərər (İtki) ⚠️</span>
                      <span className="font-black font-mono text-sm">-{Math.abs(profit).toFixed(2)} ₼</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sales Channel Selector */}
            {posMode === "sale" && (
              <div className="space-y-1.5 text-xs font-semibold">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Satış Kanalı 🌐</label>
                <select
                  value={salesChannel}
                  onChange={(e) => setSalesChannel(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  <option value="Mağaza">🏠 Mağaza (Pərakəndə)</option>
                  <option value="birmarket.az">🌐 birmarket.az (Marketplace)</option>
                </select>
              </div>
            )}

            {/* Payment Type */}
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
                  {posMode === "return" ? "Geri Ödəniş Üsulu" : "Ödəniş Üsulu"}
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => {
                    setPaymentType(e.target.value);
                    if (e.target.value !== "Kart") setBankName("");
                  }}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 cursor-pointer focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}
                >
                  <option value="Nəğd">Nəğd</option>
                  <option value="Kart">Kart</option>
                  <option value="Kart2Kart">Kart2Kart</option>
                  <option value="Köçürmə">Köçürmə</option>
                  {posMode === "sale" && <option value="Nisyə">Nisyə (Borc)</option>}
                </select>
              </div>

              {/* Bank Selection (Only if payment type is Kart and sale mode) */}
              {posMode === "sale" && paymentType === "Kart" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Bank Hesabı *</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer text-xs font-bold"
                    required
                  >
                    <option value="">Bank Seçin...</option>
                    {(activeBanksList.length > 0 ? activeBanksList : ["Digər"]).map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Return Status if in Return Mode */}
              {posMode === "return" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Qaytarış Tipi (Status)</label>
                  <select
                    value={returnStatus}
                    onChange={(e) => setReturnStatus(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50/50 cursor-pointer text-xs font-semibold"
                  >
                    <option value="returned_to_stock">🟢 Anbara Geri Qayıtsın (Yararlı)</option>
                    <option value="defective">🔴 Deffekt / Zədəli (Zərərə silinsin)</option>
                  </select>
                </div>
              )}

              {/* Due date if credit sale */}
              {posMode === "sale" && isCredit && (
                <div className="space-y-1.5 border border-amber-100 bg-amber-50/10 p-3.5 rounded-xl animate-in slide-in-from-top-1.5">
                  <label className="text-amber-700 uppercase tracking-wider block text-[10px]">
                    Borcun Ödənilmə Tarixi *
                  </label>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white cursor-pointer"
                  />
                  <p className="text-[10px] text-amber-600/80 leading-normal font-medium mt-1">
                    Satış nisyəyə verilir. Müştərinin cari borcuna əlavə olunacaq.
                  </p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
                  {posMode === "return" ? "Qaytarılma Səbəbi" : "Satış qeydi"}
                </label>
                <input
                  type="text"
                  placeholder={posMode === "return" ? "Qaytarılma səbəbini qeyd edin..." : "Əlavə məlumat (ixtiyari)"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50 focus:ring-1 ${posMode === "return" ? "focus:ring-amber-500" : "focus:ring-primary"}`}
                />
              </div>

              {/* VAT (ƏDV) Toggle */}
              {posMode === "sale" && activeSettings?.taxStatus === "edv" && (
                <div className="flex items-center gap-2 py-1 select-none animate-in fade-in duration-200">
                  <input
                    type="checkbox"
                    id="applyEdv"
                    checked={applyEdv}
                    onChange={(e) => setApplyEdv(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer"
                  />
                  <label htmlFor="applyEdv" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                    18% ƏDV Tətbiq Edilsin <span className="text-[10px] text-gray-400 font-normal">(Qiymətə ƏDV daxildir)</span>
                  </label>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={basket.length === 0 || createSaleMutation.isPending || createReturnMutation.isPending}
                className={`w-full py-3 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md transition-all ${
                  posMode === "return"
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10 shadow-lg shadow-amber-600/20 animate-pulse"
                    : (isCredit ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/10" : "bg-primary hover:bg-primary/90 shadow-primary/10")
                }`}
              >
                <CheckCircle className="w-4 h-4" />{" "}
                {posMode === "return" ? "Geri Qaytarışı Tamamla" : (isCredit ? "Nisyə Satış Qeyd Et" : "Satışı Tamamla (Qaimə)")}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
