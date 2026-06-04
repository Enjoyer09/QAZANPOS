import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Phone,
  MapPin,
  FileText,
  Sliders,
  Download,
  CheckCircle,
  Database,
  Printer,
  Sparkles,
  Barcode,
  Users,
  Trash2,
  Lock,
  ShieldCheck,
  User,
  Send,
  Bell,
  Globe,
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { qzService } from "../lib/qz.ts";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getUpgradePlanUrl = () => {
    const currentHost = window.location.host; // e.g. "localhost:5173", "restoran1.qazanpos.az"
    const hostParts = currentHost.split(".");
    if (currentHost.includes("localhost") || currentHost.includes("127.0.0.1")) {
      return `http://localhost:${window.location.port || "5173"}/#tarifler`;
    }
    if (hostParts.length > 2) {
      const baseDomain = hostParts.slice(1).join(".");
      return `${window.location.protocol}//${baseDomain}/#tarifler`;
    }
    return `${window.location.protocol}//${currentHost}/#tarifler`;
  };

  const [settingsTab, setSettingsTab] = useState("general");
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [marketplaceCommissions, setMarketplaceCommissions] = useState<Record<string, number>>({});
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Shop Info State
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [lowStockAlertCount, setLowStockAlertCount] = useState("5");
  const [defaultCreditDays, setDefaultCreditDays] = useState("30");

  // Azerbaijan Tax State
  const [voen, setVoen] = useState("");
  const [taxStatus, setTaxStatus] = useState("sadelestirilmis");
  const [edvRate, setEdvRate] = useState("18");
  const [simplifiedRate, setSimplifiedRate] = useState("2");
  const [showTaxOnReceipt, setShowTaxOnReceipt] = useState(1);
  const [showTaxOnInvoice, setShowTaxOnInvoice] = useState(1);

  // Telegram Notifications State
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(0);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  // Backup Settings State
  const [backupTime, setBackupTime] = useState("23:00");
  const [telegramBackupEnabled, setTelegramBackupEnabled] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Thermal Receipt Design State
  const [receiptWidth, setReceiptWidth] = useState("80mm");
  const [showBarcode, setShowBarcode] = useState(1);
  const [showCustomerInfo, setShowCustomerInfo] = useState(1);
  const [receiptHeader, setReceiptHeader] = useState("MƏTBƏX DÜNYASI");
  const [receiptFooter, setReceiptFooter] = useState("Çekimizi saxlamanızı xahiş edirik!");
  const [showStorePhone, setShowStorePhone] = useState(1);
  const [showStoreAddress, setShowStoreAddress] = useState(1);
  const [showReceiptHeader, setShowReceiptHeader] = useState(1);
  const [showReceiptFooter, setShowReceiptFooter] = useState(1);
  const [showPaymentDetails, setShowPaymentDetails] = useState(1);

  // Staff Permissions State
  const [staffCanViewSalesHistory, setStaffCanViewSalesHistory] = useState(1);
  const [staffCanViewStock, setStaffCanViewStock] = useState(1);
  const [staffCanViewCustomers, setStaffCanViewCustomers] = useState(1);
  const [staffCanViewVendors, setStaffCanViewVendors] = useState(1);
  const [staffCanViewExpenses, setStaffCanViewExpenses] = useState(1);
  const [staffCanViewStockBalances, setStaffCanViewStockBalances] = useState(1);
  const [staffCanViewDebts, setStaffCanViewDebts] = useState(1);
  const [selectedPermissionsUserId, setSelectedPermissionsUserId] = useState<number | "">("");


  // QZ Tray local state
  const [qzConnected, setQzConnected] = useState<"LOADING" | "CONNECTED" | "OFFLINE">("LOADING");
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");

  const activeUser = (() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  })();

  const isAdmin = activeUser?.role === "Admin";

  const getPlanDetails = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "mini":
        return {
          name: "Mini Plan",
          color: "from-blue-500 to-indigo-600 shadow-blue-500/20 text-white",
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
          products: "100 ədəd",
          sales: "500 ədəd",
          users: "3 nəfər",
          price: "15 ₼ / ay"
        };
      case "pro":
        return {
          name: "Pro Plan",
          color: "from-purple-600 to-indigo-700 shadow-purple-500/20 text-white",
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
          products: "1,000 ədəd",
          sales: "5,000 ədəd",
          users: "10 nəfər",
          price: "35 ₼ / ay"
        };
      case "enterprise":
        return {
          name: "Enterprise Plan",
          color: "from-amber-500 to-red-600 shadow-amber-500/20 text-white",
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
          products: "Limitsiz",
          sales: "Limitsiz",
          users: "Limitsiz",
          price: "Fərdi qiymət"
        };
      case "free":
      default:
        return {
          name: "Sınaq (Pulsuz)",
          color: "from-gray-500 to-slate-600 shadow-gray-500/20 text-white",
          badgeColor: "bg-gray-50 text-gray-700 border-gray-200",
          products: "10 ədəd",
          sales: "20 ədəd",
          users: "1 nəfər",
          price: "0 ₼"
        };
    }
  };

  // User Management State
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("Staff");
  const [selectedUserToReset, setSelectedUserToReset] = useState<any | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [staffNewPassword, setStaffNewPassword] = useState("");
  const [staffConfirmPassword, setStaffConfirmPassword] = useState("");

  // Fetch users list
  const { data: usersList, refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("İstifadəçiləri gətirmək mümkün olmadı");
      return res.json();
    },
    enabled: isAdmin,
  });

  // 2FA Setup State & Logic
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorQRCode, setTwoFactorQRCode] = useState("");
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState("");

  const currentUserFromDb = usersList?.find((u) => u.username === activeUser?.username);
  const is2FAActive = currentUserFromDb?.twoFactorEnabled === 1;

  const handleStart2FASetup = async () => {
    try {
      const res = await fetch("/api/auth/2fa-setup", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTwoFactorSecret(data.secret);
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.otpauthURI)}`;
      setTwoFactorQRCode(qrUrl);
      setShow2FASetupModal(true);
    } catch (e) {
      toast({
        title: "Xəta!",
        description: "2FA qurulumuna başlamaq mümkün olmadı.",
        variant: "destructive",
      });
    }
  };

  const handleActivate2FA = async () => {
    if (!twoFactorCodeInput.trim() || twoFactorCodeInput.length !== 6) {
      toast({
        title: "Xəta!",
        description: "6 rəqəmli OTP kodu daxil edin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: twoFactorSecret, token: twoFactorCodeInput }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "OTP kod yanlışdır");
      }

      toast({
        title: "Təhlükəsizlik aktivdir!",
        description: "İki-mərhələli təhlükəsizlik (2FA) quraşdırıldı.",
        variant: "success",
      });

      setShow2FASetupModal(false);
      setTwoFactorCodeInput("");
      refetchUsers();
    } catch (err: any) {
      toast({
        title: "Aktivləşdirmə alınmadı!",
        description: err.message || "Daxil etdiyiniz OTP kod yanlışdır.",
        variant: "destructive",
      });
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm("İki-mərhələli təhlükəsizliyi (2FA) söndürmək istədiyinizə əminsiniz?")) {
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa-disable", { method: "POST" });
      if (!res.ok) throw new Error();
      
      localStorage.removeItem("qazanpos_2fa_trust_token");

      toast({
        title: "2FA söndürüldü",
        description: "Hesabınız üçün iki-mərhələli təhlükəsizlik söndürüldü.",
        variant: "success",
      });
      
      refetchUsers();
    } catch (e) {
      toast({
        title: "Xəta!",
        description: "2FA deaktiv edilərkən xəta baş verdi.",
        variant: "destructive",
      });
    }
  };

  // Fetch Settings
  const { data: settingsData, isLoading } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Fetch Products for Categories list
  const { data: productsList = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Extract unique product categories
  const categories = Array.from(
    new Set(
      productsList
        .map((p: any) => p.category?.trim())
        .filter((cat): cat is string => !!cat && cat !== "")
    )
  ).sort();

  // Populate state on load
  useEffect(() => {
    if (settingsData) {
      setStoreName(settingsData.storeName || "");
      setPhone(settingsData.phone || "");
      setAddress(settingsData.address || "");
      setInvoiceFooter(settingsData.invoiceFooter || "");
      setLowStockAlertCount("" + (settingsData.lowStockAlertCount || 5));
      setDefaultCreditDays("" + (settingsData.defaultCreditDays || 30));
      
      setReceiptWidth(settingsData.receiptWidth || "80mm");
      setShowBarcode(settingsData.showBarcode ?? 1);
      setShowCustomerInfo(settingsData.showCustomerInfo ?? 1);
      setReceiptHeader(settingsData.receiptHeader || "MƏTBƏX DÜNYASI");
      setReceiptFooter(settingsData.receiptFooter || "Çekimizi saxlamanızı xahiş edirik!");
      setShowStorePhone(settingsData.showStorePhone ?? 1);
      setShowStoreAddress(settingsData.showStoreAddress ?? 1);
      setShowReceiptHeader(settingsData.showReceiptHeader ?? 1);
      setShowReceiptFooter(settingsData.showReceiptFooter ?? 1);
      setShowPaymentDetails(settingsData.showPaymentDetails ?? 1);
      
      setTelegramBotToken(settingsData.telegramBotToken || "");
      setTelegramChatId(settingsData.telegramChatId || "");
      setTelegramNotificationsEnabled(settingsData.telegramNotificationsEnabled ?? 0);
      setBackupTime(settingsData.backupTime || "23:00");
      setTelegramBackupEnabled(settingsData.telegramBackupEnabled ?? 0);

      // Load Azerbaijan Tax settings
      setVoen(settingsData.voen || "");
      setTaxStatus(settingsData.taxStatus || "sadelestirilmis");
      setEdvRate("" + (settingsData.edvRate ?? 18));
      setSimplifiedRate("" + (settingsData.simplifiedRate ?? 2));
      setShowTaxOnReceipt(settingsData.showTaxOnReceipt ?? 1);
      setShowTaxOnInvoice(settingsData.showTaxOnInvoice ?? 1);

      // Load Marketplace Commissions settings
      try {
        const comms = settingsData.marketplaceCommissions 
          ? JSON.parse(settingsData.marketplaceCommissions) 
          : {};
        setMarketplaceCommissions(comms);
      } catch (e) {
        setMarketplaceCommissions({});
      }

    }
  }, [settingsData]);

  // Set default selected user for permissions configuration
  useEffect(() => {
    if (usersList && usersList.length > 0 && selectedPermissionsUserId === "") {
      const firstStaff = usersList.find((u) => u.role === "Staff") || usersList[0];
      if (firstStaff) {
        setSelectedPermissionsUserId(firstStaff.id);
      }
    }
  }, [usersList]);

  // Update permission states when selected user changes
  useEffect(() => {
    if (selectedPermissionsUserId && usersList) {
      const targetUser = usersList.find((u) => u.id === selectedPermissionsUserId);
      if (targetUser) {
        setStaffCanViewSalesHistory(targetUser.staffCanViewSalesHistory ?? 1);
        setStaffCanViewStock(targetUser.staffCanViewStock ?? 1);
        setStaffCanViewCustomers(targetUser.staffCanViewCustomers ?? 1);
        setStaffCanViewVendors(targetUser.staffCanViewVendors ?? 1);
        setStaffCanViewExpenses(targetUser.staffCanViewExpenses ?? 1);
        setStaffCanViewStockBalances(targetUser.staffCanViewStockBalances ?? 1);
        setStaffCanViewDebts(targetUser.staffCanViewDebts ?? 1);
      }
    }
  }, [selectedPermissionsUserId, usersList]);

  // Handle QZ Tray WebSocket handshake
  useEffect(() => {
    const initQz = async () => {
      try {
        const connected = await qzService.connect();
        if (connected) {
          setQzConnected("CONNECTED");
          // Discovered local printers list
          const list = await qzService.getPrinters();
          setAvailablePrinters(list || []);
          
          // Load pre-selected printer name
          const savedPrinter = localStorage.getItem("qazan_pos_selected_printer");
          if (savedPrinter && list.includes(savedPrinter)) {
            setSelectedPrinter(savedPrinter);
          } else if (list.length > 0) {
            setSelectedPrinter(list[0]);
            localStorage.setItem("qazan_pos_selected_printer", list[0]);
          }
        } else {
          setQzConnected("OFFLINE");
        }
      } catch (err) {
        setQzConnected("OFFLINE");
      }
    };
    initQz();
  }, []);

  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name);
    localStorage.setItem("qazan_pos_selected_printer", name);
    toast({
      title: "Printer seçildi",
      description: `Səssiz çap üçün printer: ${name}`,
      variant: "success",
    });
  };

  // Update mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Yadda saxlanıldı!",
        description: "Bütün sistem və çek ayarları uğurla yeniləndi.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta!",
        description: "Ayarları yadda saxlayarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // User Management Mutations
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "İstifadəçi yaradıla bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchUsers();
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("Staff");
      toast({
        title: "İstifadəçi yaradıldı",
        description: "Yeni kassa hesabı uğurla aktivləşdirildi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "İstifadəçi yaradılarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: any) => {
      const res = await fetch(`/api/users/${id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Şifrə dəyişdirilə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      setSelectedUserToReset(null);
      setResetPasswordValue("");
      setStaffNewPassword("");
      setStaffConfirmPassword("");
      toast({
        title: "Şifrə dəyişdirildi",
        description: "Yeni şifrə uğurla yadda saxlanıldı.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Şifrə dəyişdirilərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "İstifadəçi silinə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchUsers();
      toast({
        title: "İstifadəçi silindi",
        description: "İstifadəçi hesabı sistemdən tam silindi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "İstifadəçi silinərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: any }) => {
      const res = await fetch(`/api/users/${id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Səlahiyyətləri yeniləmək mümkün olmadı");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({
        title: "Səlahiyyətlər yeniləndi",
        description: "İstifadəçinin fərdi səlahiyyətləri uğurla yadda saxlanıldı.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Səlahiyyətlər yenilənərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  const handleTestTelegram = async () => {
    if (!telegramBotToken || !telegramChatId) {
      toast({
        title: "Xəta!",
        description: "Lütfən, öncə Telegram Bot Token və Chat ID məlumatlarını doldurun.",
        variant: "destructive"
      });
      return;
    }

    setIsTestingTelegram(true);
    try {
      const res = await fetch("/api/settings/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: telegramBotToken,
          chatId: telegramChatId
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Uğurlu Bağlantı! 🤖",
          description: "Telegram botunuza test mesajı göndərildi. Ayarlar avtomatik yadda saxlanıldı və aktivləşdirildi.",
          variant: "success"
        });

        // Automatically save the verified settings to the database and enable notifications
        const payload = {
          storeName: storeName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          invoiceFooter: invoiceFooter.trim() || null,
          lowStockAlertCount: parseInt(lowStockAlertCount) || 5,
          defaultCreditDays: parseInt(defaultCreditDays) || 30,
          receiptWidth,
          showBarcode,
          showCustomerInfo,
          receiptHeader: receiptHeader.trim() || null,
          receiptFooter: receiptFooter.trim() || null,
          showStorePhone,
          showStoreAddress,
          showReceiptHeader,
          showReceiptFooter,
          showPaymentDetails,
          telegramBotToken: telegramBotToken.trim(),
          telegramChatId: telegramChatId.trim(),
          telegramNotificationsEnabled: 1, // Automatically enable
        };
        updateSettingsMutation.mutate(payload);
        setTelegramNotificationsEnabled(1);
      } else {
        toast({
          title: "Telegram Xətası!",
          description: data.message || "Bot bağlantısı qurula bilmədi.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Texniki Xəta!",
        description: "Serverlə bağlantı kəsildi.",
        variant: "destructive"
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      toast({
        title: "Xəta!",
        description: "Mağaza adı daxil edilməlidir.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      storeName: storeName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      invoiceFooter: invoiceFooter.trim() || null,
      lowStockAlertCount: parseInt(lowStockAlertCount) || 5,
      defaultCreditDays: parseInt(defaultCreditDays) || 30,
      
      receiptWidth,
      showBarcode,
      showCustomerInfo,
      receiptHeader: receiptHeader.trim() || null,
      receiptFooter: receiptFooter.trim() || null,
      showStorePhone,
      showStoreAddress,
      showReceiptHeader,
      showReceiptFooter,
      showPaymentDetails,
      telegramBotToken: telegramBotToken.trim() || null,
      telegramChatId: telegramChatId.trim() || null,
      telegramNotificationsEnabled,
      backupTime,
      telegramBackupEnabled,

      // Azerbaijan Tax fields
      voen: voen.trim() || null,
      taxStatus,
      edvRate: parseFloat(edvRate) || 18.0,
      simplifiedRate: parseFloat(simplifiedRate) || 2.0,
      showTaxOnReceipt: parseInt(showTaxOnReceipt as any) ?? 1,
      showTaxOnInvoice: parseInt(showTaxOnInvoice as any) ?? 1,

      // Marketplace commissions
      marketplaceCommissions: JSON.stringify(marketplaceCommissions),
    };

    updateSettingsMutation.mutate(payload);
  };

  const handleSaveStaffPermissions = () => {
    if (!selectedPermissionsUserId) {
      toast({
        title: "Xəta!",
        description: "Zəhmət olmasa səlahiyyətlərini dəyişmək istədiyiniz istifadəçini seçin.",
        variant: "destructive",
      });
      return;
    }

    updatePermissionsMutation.mutate({
      id: Number(selectedPermissionsUserId),
      permissions: {
        staffCanViewSalesHistory: parseInt(staffCanViewSalesHistory as any) ?? 1,
        staffCanViewStock: parseInt(staffCanViewStock as any) ?? 1,
        staffCanViewCustomers: parseInt(staffCanViewCustomers as any) ?? 1,
        staffCanViewVendors: parseInt(staffCanViewVendors as any) ?? 1,
        staffCanViewExpenses: parseInt(staffCanViewExpenses as any) ?? 1,
        staffCanViewStockBalances: parseInt(staffCanViewStockBalances as any) ?? 1,
        staffCanViewDebts: parseInt(staffCanViewDebts as any) ?? 1,
      }
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("DİQQƏT: Bərpa (Restore) prosesi zamanı mövcud bütün məlumatlarınız silinəcək və bu backup faylındakı məlumatlar ilə əvəzlənəcək. Bu əməliyyat geri qaytarıla bilməz! Davam etmək istəyirsiniz?")) {
      e.target.value = ""; // reset file input
      return;
    }

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);

          const response = await fetch("/api/settings/backup/import", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: text,
          });

          const result = await response.json();
          if (response.ok) {
            toast({
              title: "Məlumatlar bərpa olundu!",
              description: result.message || "Bütün məlumatlar uğurla backup-dan bərpa edildi.",
              variant: "success",
            });
            queryClient.invalidateQueries();
            setTimeout(() => window.location.reload(), 1500);
          } else {
            toast({
              title: "Bərpa xətası!",
              description: result.message || "Fayl idxal edilərkən xəta baş verdi.",
              variant: "destructive",
            });
          }
        } catch (parseErr) {
          toast({
            title: "Format xətası!",
            description: "Seçilmiş fayl düzgün JSON formatında deyil.",
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
          e.target.value = ""; // reset file input
        }
      };
      reader.readAsText(file);
    } catch (err) {
      toast({
        title: "Xəta!",
        description: "Fayl oxunarkən xəta baş verdi.",
        variant: "destructive",
      });
      setIsImporting(false);
      e.target.value = ""; // reset file input
    }
  };

  const handleExport = (table: string, title: string) => {
    toast({
      title: "Yüklənir...",
      description: `${title} backup yüklənir.`,
      variant: "success",
    });
    window.location.href = `/api/backup/export/${table}`;
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-xs text-gray-400 font-semibold animate-pulse">
        Ayarlar yüklənir, lütfən gözləyin...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-300 max-w-xl mx-auto py-4">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">İstifadəçi Ayarları</h2>
          <p className="text-xs text-gray-400 mt-1">
            Giriş hesabınızın təhlükəsizlik və şifrə ayarları
          </p>
        </div>

        {/* Profile Details & Password Form Card */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xl glass-card space-y-6">
          {/* User Profile Avatar block */}
          <div className="flex flex-col items-center sm:flex-row gap-4 pb-6 border-b border-gray-100/50">
            <div className="size-16 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary/20 border border-white/20">
              {activeUser?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-extrabold text-gray-900 text-base">{activeUser?.username}</h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Rol: Satıcı (Staff)
              </p>
            </div>
          </div>

          {/* Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!staffNewPassword.trim()) {
                toast({ title: "Xəta!", description: "Yeni şifrə daxil edilməlidir.", variant: "destructive" });
                return;
              }
              if (staffNewPassword !== staffConfirmPassword) {
                toast({ title: "Xəta!", description: "Şifrələr eyni deyil.", variant: "destructive" });
                return;
              }
              if (staffNewPassword.length < 4) {
                toast({ title: "Xəta!", description: "Şifrə ən azı 4 simvoldan ibarət olmalıdır.", variant: "destructive" });
                return;
              }
              changePasswordMutation.mutate({
                id: activeUser.id,
                password: staffNewPassword,
              });
            }} 
            className="space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-primary" />
              <h4 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider">Şifrəni Yenilə</h4>
            </div>

            <div className="space-y-3.5 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Yeni Şifrə</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Yeni şifrənizi daxil edin"
                    value={staffNewPassword}
                    onChange={(e) => setStaffNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Yeni Şifrənin Təkrarı</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Yeni şifrənizi yenidən daxil edin"
                    value={staffConfirmPassword}
                    onChange={(e) => setStaffConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <CheckCircle className="w-4 h-4" /> Şifrəni Dəyiş
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const backupTables = [
    { key: "products", label: "Məhsullar Kataloqu", countLabel: "Məhsul siyahısı, ölçü vahidləri" },
    { key: "customers", label: "Müştəri Siyahısı", countLabel: "Müştəri adları, telefon, ünvan" },
    { key: "stock_entries", label: "Anbar Mədaxili", countLabel: "Alış qiymətləri, təchizatçılar" },
    { key: "sales", label: "Satış Tarixçəsi", countLabel: "Satış məbləğləri, mənfəətlər" },
    { key: "expenses", label: "Xərclər Jurnalı", countLabel: "Kateqoriyalar, arenda, maaş" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sistem Ayarları</h2>
        <p className="text-xs text-gray-400 mt-1">
          Mağaza profili, QZ Tray səssiz çek çapı, fərdiləşdirilmiş çek dizayneri və backup
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-px">
        <button
          type="button"
          onClick={() => setSettingsTab("general")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            settingsTab === "general"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Store className="w-4 h-4" />
          Mağaza və Limitlər
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("printer")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            settingsTab === "printer"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Printer className="w-4 h-4" />
          Çap və Çek Dizaynı
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("tax")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            settingsTab === "tax"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Vergi Ayarları
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("channels")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            settingsTab === "channels"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Globe className="w-4 h-4" />
          Marketplace Komissiyaları 🌐
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("security")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            settingsTab === "security"
              ? "border-primary text-primary"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Users className="w-4 h-4" />
          İstifadəçilər və Təhlükəsizlik
        </button>
        <button
          type="button"
          onClick={() => {
            setShowResetConfirmModal(true);
            setResetPassword("");
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            showResetConfirmModal
              ? "border-red-500 text-red-500 font-extrabold"
              : "border-transparent text-gray-400 hover:text-red-400"
          }`}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
          Sistemi Sıfırla 🔴
        </button>
      </div>

      {settingsTab !== "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Forms column */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* Plan Status Card */}
          {settingsData && (
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100/50 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm">Cari Tarif Planınız</h3>
                    <span className="text-[10px] font-bold text-gray-400 mt-0.5 block">Abunəlik və limit detalları</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-black border uppercase tracking-wider ${getPlanDetails(settingsData.billingTier).badgeColor}`}>
                    {getPlanDetails(settingsData.billingTier).name}
                  </span>
                  <span className="text-xs font-black text-gray-900 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                    {getPlanDetails(settingsData.billingTier).price}
                  </span>
                </div>
              </div>
              
              {/* Limit specs */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider mb-1">Məhsul Limiti</span>
                  <span className="text-xs font-black text-gray-800 block mt-0.5">{getPlanDetails(settingsData.billingTier).products}</span>
                </div>
                <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider mb-1">Satış Limiti</span>
                  <span className="text-xs font-black text-gray-800 block mt-0.5">{getPlanDetails(settingsData.billingTier).sales}</span>
                </div>
                <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider mb-1">İstifadəçi Limiti</span>
                  <span className="text-xs font-black text-gray-800 block mt-0.5">{getPlanDetails(settingsData.billingTier).users}</span>
                </div>
              </div>
              
              {settingsData.billingTier !== "enterprise" && (
                <div className="mt-4 flex justify-end">
                  <a
                    href={getUpgradePlanUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-[10px] rounded-lg shadow-sm tracking-wide uppercase cursor-pointer transition-all hover-elevate"
                  >
                    Planı Yüksəlt ⚡
                  </a>
                </div>
              )}
            </div>
          )}

          {settingsTab === "general" && (
            /* Card 1: Shop profile */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Store className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">Biznes Məlumatları (Rəsmi Qaimədə)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="space-y-1 md:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Mağaza Adı *</label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    placeholder="Məs. Mətbəx Dünyası"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Əlaqə Telefonu</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    placeholder="Məs. 055-123-4567"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Fiziki Ünvan</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    placeholder="Məs. Sədərək TM, Sıra 5"
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
                  Rəsmi Qaimə Sonu Bildiriş (Invoice Footer)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <textarea
                    value={invoiceFooter}
                    onChange={(e) => setInvoiceFooter(e.target.value)}
                    rows={2}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 resize-none"
                    placeholder="Qaimənin sonunda çap ediləcək qeyd..."
                  />
                </div>
              </div>
            </div>
          </div>
          )}

          {settingsTab === "tax" && (
            /* Card 3: Azerbaijan Tax Settings */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-gray-900 text-sm">Azərbaycan Vergi Sistemi İnteqrasiyası</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Vergi Ödəyicisinin VÖEN-i</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={voen}
                    onChange={(e) => setVoen(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                    placeholder="Məs. 120XXXXXXXX (9-10 rəqəmli)"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Vergi Rejimi / Statusu</label>
                  <select
                    value={taxStatus}
                    onChange={(e) => setTaxStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 cursor-pointer"
                  >
                    <option value="sadelestirilmis">Sadələşdirilmiş vergi ödəyicisi</option>
                    <option value="edv">ƏDV (Əlavə Dəyər Vergisi) ödəyicisi</option>
                    <option value="gelir">Gəlir / Mənfəət vergisi ödəyicisi</option>
                    <option value="azad">Vergidən azad (Azad status)</option>
                  </select>
                </div>

                {taxStatus === "edv" && (
                  <div className="space-y-1 animate-in fade-in-50 duration-200">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">ƏDV Dərəcəsi (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={edvRate}
                      onChange={(e) => setEdvRate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                      placeholder="Standart 18%"
                    />
                  </div>
                )}

                {taxStatus === "sadelestirilmis" && (
                  <div className="space-y-1 animate-in fade-in-50 duration-200">
                    <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Sadələşdirilmiş Vergi Faizi (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={simplifiedRate}
                      onChange={(e) => setSimplifiedRate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                      placeholder="Standart 2%"
                    />
                  </div>
                )}

                <div className="md:col-span-2 border-t border-gray-100/70 pt-4 mt-2">
                  <h4 className="font-extrabold text-gray-900 text-xs mb-3 uppercase tracking-wider">Görünüş və Çap Tənzimləmələri</h4>
                  
                  <div className="space-y-3 font-semibold text-xs text-gray-700">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTaxOnReceipt === 1}
                        onChange={(e) => setShowTaxOnReceipt(e.target.checked ? 1 : 0)}
                        className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                      />
                      <span>POS Termal Çekində VÖEN və Vergi rejimini göstər</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTaxOnInvoice === 1}
                        onChange={(e) => setShowTaxOnInvoice(e.target.checked ? 1 : 0)}
                        className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                      />
                      <span>Rəsmi Satış Qaiməsində (Invoice PDF/A4) vergi məlumatlarını göstər</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsTab === "channels" && (
            /* Card 5: Marketplace Channels and Commissions */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
                <Globe className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-gray-900 text-sm">Satış Kanalları & Marketplace Komissiyaları</h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                  birmarket.az və digər onlayn satış kanalları üzərindən satılan malların kateqoriyalarına görə xidmət (komissiya) faizlərini dərəcələrlə qeyd edin. POS ekranında bu satış kanalı seçildikdə, sistem komissiya xərclərini avtomatik hesablayıb maliyyə uçotuna yazacaq.
                </p>

                {categories.length === 0 ? (
                  <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center text-xs font-bold text-gray-400">
                    Sistemdə hələ heç bir kateqoriyalı məhsul tapılmadı. Zəhmət olmasa ilk öncə Məhsullar bölməsindən kateqoriyalı məhsul yaradın.
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs font-semibold">
                      <thead className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Kateqoriya Adı</th>
                          <th className="py-3 px-4 text-right w-44">birmarket.az Komissiyası (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {categories.map((cat) => (
                          <tr key={cat} className="hover:bg-gray-50/50 transition-all">
                            <td className="py-4 px-4 text-gray-800 font-bold">{cat}</td>
                            <td className="py-2 px-4 text-right">
                              <div className="relative inline-flex items-center w-32 ml-auto">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="0.0"
                                  value={marketplaceCommissions[cat] !== undefined ? marketplaceCommissions[cat] : ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const parsed = parseFloat(val);
                                    setMarketplaceCommissions((prev) => ({
                                      ...prev,
                                      [cat]: isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed)),
                                    }));
                                  }}
                                  className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-right font-bold focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                                />
                                <span className="absolute right-3 text-gray-400 font-bold font-sans">%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {settingsTab === "printer" && (
            /* Card 2: QZ Tray silent printing configuration */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Printer className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">QZ Tray Səssiz Çap Qoşulması (WebSocket)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold items-center">
              {/* QZ Status indicator */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Handshake Status</label>
                {qzConnected === "LOADING" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl font-bold w-full justify-center">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Yoxlanılır...
                  </span>
                )}
                {qzConnected === "CONNECTED" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl font-bold w-full justify-center">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    QZ Aktivdir (Səssiz)
                  </span>
                )}
                {qzConnected === "OFFLINE" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl font-bold w-full justify-center">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    QZ Qoşulmayıb (Browser Çapı)
                  </span>
                )}
              </div>

              {/* Printer selector dropdown */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Səssiz Çap Printeri</label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  disabled={qzConnected !== "CONNECTED" || availablePrinters.length === 0}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 disabled:opacity-50 cursor-pointer"
                >
                  {availablePrinters.length === 0 ? (
                    <option value="">Printer tapılmadı (Local QZ işlək deyil)</option>
                  ) : (
                    availablePrinters.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* QZ Status hint */}
              <p className="text-[10px] text-gray-400 font-medium md:col-span-3 mt-1 leading-normal">
                {qzConnected === "CONNECTED"
                  ? "✓ Səssiz çap aktivdir. POS-da və qaimədə çap düyməsinə kliklədikdə standart brauzer çap pəncərəsi açılmadan birbaşa termal printerinizə göndəriləcək."
                  : "⚠ QZ Tray local olaraq işə salınmayıb. Çap əməliyyatları standart brauzer çap pəncərəsi (Ctrl + P) üzərindən açılacak. Səssiz çap üçün arxa fonda QZ Tray proqramını başladın."}
              </p>

              {/* QZ Silent Printing Self-Signed Certificate Guide for tenants */}
              <div className="md:col-span-3 border-t border-gray-100/70 pt-6 mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
                  <div className="space-y-1 text-left">
                    <span className="font-extrabold text-emerald-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-emerald-600" /> Səssiz Çap Sertifikatı
                    </span>
                    <p className="text-[10px] text-gray-500 font-medium">
                      QZ Tray Site Manager-ə tanıtmaq üçün rəqəmsal sertifikatı yükləyin.
                    </p>
                  </div>

                  <a
                    href="/api/auth/qz-certificate"
                    download="digital-certificate.txt"
                    className="px-6 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-2 shadow-xs transition-all hover-elevate w-full sm:w-auto text-center font-extrabold"
                  >
                    <Printer className="w-4 h-4 inline-block" /> Sertifikatı Yüklə
                  </a>
                </div>
              </div>
            </div>
          </div>
          )}

          {settingsTab === "printer" && (
            /* Card: Telegram Notification Bot (Instant Owner Notifications) */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">🤖 Telegram Bildiriş Botu (Instant Notifications)</h3>
            </div>

            <div className="space-y-4 text-xs font-semibold text-left">
              <p className="text-gray-400 font-medium leading-normal mb-4">
                Mağazanızda baş verən kritik hadisələrdən (böyük POS satışları, mal mədaxilləri və əməkhaqqı ödənişləri) anında Telegram vasitəsilə xəbərdar olun.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telegram Bot Token</label>
                  <input
                    type="text"
                    placeholder="Məsələn: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telegram Chat ID</label>
                  <input
                    type="text"
                    placeholder="Məsələn: 987654321 və ya -100123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 rounded-2xl p-5 border border-primary/10 mt-4 font-bold">
                <div className="space-y-1">
                  <span className="font-extrabold text-primary text-xs uppercase tracking-wider block">
                    Telegram Bildirişləri
                  </span>
                  <p className="text-[10px] text-gray-400 font-medium leading-normal">
                    Kritik mağaza əməliyyatlarının anlıq ötürülməsini aktivləşdirin.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram}
                    className="px-5 py-2.5 bg-gray-900 text-white hover:bg-gray-800 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all text-center w-full sm:w-auto font-black"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTestingTelegram ? "Test Edilir..." : "Bağlantını Test Et 🤖"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTelegramNotificationsEnabled(prev => prev === 1 ? 0 : 1)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer border transition-all w-full sm:w-auto font-black ${
                      telegramNotificationsEnabled === 1
                        ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {telegramNotificationsEnabled === 1 ? "Aktivdir 👍" : "Deaktivdir ❌"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {settingsTab === "general" && (
            /* Card: Backup and Restore */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">🗄️ Ehtiyat Nüsxə və Bərpa (Backup & Restore)</h3>
            </div>

            <div className="space-y-4 text-xs font-semibold text-left">
              <p className="text-gray-400 font-medium leading-normal mb-4">
                Mağazanızın bütün məlumatlarını (anbar, satışlar, işçilər, müştərilər və s.) ehtiyat nüsxə kimi yükləyin və ya geri bərpa edin. Həmçinin hər gün avtomatik olaraq müəyyən edilmiş saatda sistem tərəfindən backup yaradılmasını tənzimləyə bilərsiniz.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Avtomatik Yedəklənmə Saatı</label>
                  <input
                    type="time"
                    value={backupTime}
                    onChange={(e) => setBackupTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Telegram Backup</label>
                  <div className="flex items-center gap-3 h-[46px]">
                    <button
                      type="button"
                      onClick={() => setTelegramBackupEnabled(prev => prev === 1 ? 0 : 1)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer border transition-all w-full text-center font-black ${
                        telegramBackupEnabled === 1
                          ? "bg-primary text-white border-primary hover:bg-primary/95"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {telegramBackupEnabled === 1 ? "Telegrama Göndərilsin 👍" : "Telegrama Göndərilməsin ❌"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100/50 my-4 pt-4 space-y-4">
                <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wider block">Manual Əməliyyatlar</span>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      toast({
                        title: "Yüklənir...",
                        description: "Ehtiyat nüsxə faylı hazırlanır.",
                        variant: "success",
                      });
                      window.location.href = "/api/settings/backup/export";
                    }}
                    className="flex-1 px-5 py-3 bg-gray-900 text-white hover:bg-gray-800 font-extrabold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ehtiyat Nüsxə Yüklə (JSON)</span>
                  </button>

                  <label className="flex-1 relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      disabled={isImporting}
                      className="hidden"
                    />
                    <div className="px-5 py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-extrabold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center select-none">
                      <Database className="w-4 h-4 text-primary" />
                      <span>{isImporting ? "Bərpa Edilir..." : "Backup-dan Bərpa Et (Restore)"}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
          )}

          {settingsTab === "printer" && (
            /* Card 3: Receipt Designer */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">Fərdiləşdirilmiş Çek Dizayneri</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Çek kağızının eni</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReceiptWidth("80mm")}
                    className={`flex-1 py-2.5 border rounded-xl font-bold transition-all cursor-pointer ${
                      receiptWidth === "80mm" ? "bg-primary text-white border-primary" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    80mm (Standart Böyük)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptWidth("58mm")}
                    className={`flex-1 py-2.5 border rounded-xl font-bold transition-all cursor-pointer ${
                      receiptWidth === "58mm" ? "bg-primary text-white border-primary" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    58mm (Kompakt Kiçik)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Çek Başlığı (Logo Üstü)</label>
                <input
                  type="text"
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                  placeholder="Məs. MƏTBƏX DÜNYASI"
                />
              </div>

              <div className="space-y-2 border border-gray-100 bg-gray-50/20 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase block tracking-wider">Detallar və Elementlər</span>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Müştəri detalları çap olunsun</span>
                  <input
                    type="checkbox"
                    checked={showCustomerInfo === 1}
                    onChange={(e) => setShowCustomerInfo(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Çek sonuna barkod (QR) əlavə edilsin</span>
                  <input
                    type="checkbox"
                    checked={showBarcode === 1}
                    onChange={(e) => setShowBarcode(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Mağaza telefonu göstərilsin</span>
                  <input
                    type="checkbox"
                    checked={showStorePhone === 1}
                    onChange={(e) => setShowStorePhone(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Mağaza ünvanı göstərilsin</span>
                  <input
                    type="checkbox"
                    checked={showStoreAddress === 1}
                    onChange={(e) => setShowStoreAddress(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Böyük Çek başlığı (Logo) çap olunsun</span>
                  <input
                    type="checkbox"
                    checked={showReceiptHeader === 1}
                    onChange={(e) => setShowReceiptHeader(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Çek sonluğu mesajı çap olunsun</span>
                  <input
                    type="checkbox"
                    checked={showReceiptFooter === 1}
                    onChange={(e) => setShowReceiptFooter(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-700">Ödəniş üsulu və qeydlər göstərilsin</span>
                  <input
                    type="checkbox"
                    checked={showPaymentDetails === 1}
                    onChange={(e) => setShowPaymentDetails(e.target.checked ? 1 : 0)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Çek Sonluğu Mesajı</label>
                <textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 resize-none"
                  placeholder="Çekin ən altında görünəcək xoş arzu..."
                />
              </div>
            </div>
          </div>
          )}

          {settingsTab === "general" && (
            /* Card 4: System limits */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100/50 pb-3">
              <Sliders className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">Sistem Limitləri və Qaydaları</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kritik Anbar Limiti</label>
                <input
                  type="number"
                  min="1"
                  value={lowStockAlertCount}
                  onChange={(e) => setLowStockAlertCount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Standart Nisyə Müddəti (Gün)</label>
                <input
                  type="number"
                  min="1"
                  value={defaultCreditDays}
                  onChange={(e) => setDefaultCreditDays(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
              </div>
            </div>
          </div>
          )}

          {(settingsTab === "general" || settingsTab === "printer" || settingsTab === "tax" || settingsTab === "channels") && (
            /* Save Button */
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Bütün Ayarları Saxla
              </button>
            </div>
          )}
        </form>

        {/* Right Preview Column: simulated 3D receipt roll */}
        <div className="space-y-6">
          {settingsTab === "printer" && (
            /* Real-time 3D receipt roll preview container */
            <div className="space-y-3">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Real-Time Çek Önizləmə</span>
            
            {/* Thermal Roll simulated container */}
            <div className="relative mx-auto bg-white border border-gray-200 rounded-b-xl shadow-2xl p-6 text-gray-800 font-mono text-[10px] max-w-sm transition-all select-none overflow-hidden"
                 style={{ 
                   width: receiptWidth === "80mm" ? "100%" : "82%",
                   borderTop: "8px dashed #e2e8f0" 
                 }}>
              
              {/* Receipt Body */}
              <div className="space-y-4">
                {/* Header title */}
                {(showReceiptHeader === 1 || showStorePhone === 1 || showStoreAddress === 1) && (
                  <div className="text-center">
                    {showReceiptHeader === 1 && (
                      <h4 className="font-extrabold text-xs uppercase tracking-tight text-gray-950">
                        {receiptHeader || "MƏTBƏX DÜNYASI"}
                      </h4>
                    )}
                    <p className="mt-1 leading-normal text-[8px] text-gray-500">
                      {showStorePhone === 1 && `Əlaqə: ${phone || "055-123-4567"}`}
                      {showStorePhone === 1 && showStoreAddress === 1 && <br />}
                      {showStoreAddress === 1 && (address || "Bakı, Azərbaycan")}
                    </p>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-300 my-2"></div>

                {/* Simulated Metadata */}
                <div className="space-y-0.5 text-[8px] text-gray-500">
                  <div className="flex justify-between">
                    <span>Qaimə №:</span>
                    <span className="font-bold text-gray-900">00042</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarix:</span>
                    <span>{new Date().toLocaleDateString("az-AZ")}</span>
                  </div>
                  {showCustomerInfo === 1 && (
                    <div className="flex justify-between">
                      <span>Müştəri:</span>
                      <span className="font-bold text-gray-950">Emin Məmmədov</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-gray-300 my-2"></div>

                {/* Items */}
                <div className="space-y-1">
                  <div className="flex justify-between text-gray-900 font-bold">
                    <span>Məhsul</span>
                    <span>Toplam</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2x Qazan 24sm (Korkmaz)</span>
                    <span>60.00 ₼</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Tava 28sm (Tefal)</span>
                    <span>20.00 ₼</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2"></div>

                {/* Totals */}
                <div className="space-y-1">
                  <div className="flex justify-between font-black text-gray-950 text-xs">
                    <span>CƏMİ:</span>
                    <span>80.00 ₼</span>
                  </div>
                  {showPaymentDetails === 1 && (
                    <div className="flex justify-between text-[8px] text-gray-500 font-semibold">
                      <span>Ödəniş Üsulu:</span>
                      <span>Nəğd</span>
                    </div>
                  )}
                </div>

                {showBarcode === 1 && (
                  <div className="flex flex-col items-center justify-center pt-3 space-y-1.5 opacity-85">
                    {/* SVG Simulated Barcode */}
                    <div className="flex items-center gap-0.5 h-6">
                      {[1,3,1,1,2,1,4,1,2,3,1,2,1,1,3,1,4,1,2,1,3].map((w, i) => (
                        <div key={i} className="bg-gray-800 h-full" style={{ width: `${w}px` }}></div>
                      ))}
                    </div>
                    <span className="text-[7px] text-gray-400 font-bold font-mono tracking-widest">QZ-00042</span>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-300 my-2"></div>

                {/* Footer Message */}
                {showReceiptFooter === 1 && (
                  <div className="text-center text-[8px] text-gray-500 font-bold italic leading-relaxed">
                    {receiptFooter || "Çekimizi saxlamanızı xahiş edirik!"}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {settingsTab === "general" && (
            /* GDPR Database Backup Card */
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100/50 pb-3">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">Məlumatların Yedəklənməsi</h3>
            </div>
            
            <div className="space-y-3">
              {backupTables.map((tbl) => (
                <div
                  key={tbl.key}
                  className="flex items-center justify-between p-3.5 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-gray-900 truncate leading-none mb-1">{tbl.label}</p>
                    <span className="text-[9px] font-medium text-gray-400 truncate block">{tbl.countLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport(tbl.key, tbl.label)}
                    className="p-2 bg-white text-gray-600 rounded-lg border border-gray-200 hover:text-primary hover:border-primary/50 cursor-pointer shadow-xs transition-all flex items-center justify-center"
                    title="Yüklə (CSV)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}

        </div>
      </div>
      )}

      {settingsTab === "security" && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* User Management Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card space-y-5">
            <div className="flex items-center gap-2 mb-2 border-b border-gray-100/50 pb-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">İstifadəçilərin İdarə Edilməsi</h3>
            </div>

            {/* Existing Users list */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {usersList?.map((u) => {
                const isCurrentSelf = activeUser && u.username === activeUser.username;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all"
                  >
                    <div>
                      <p className="font-bold text-gray-900 flex items-center gap-1.5">
                        {u.username}
                        {isCurrentSelf && (
                          <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-extrabold uppercase">
                            SİZ
                          </span>
                        )}
                      </p>
                      <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">
                        Rol: {u.role === "Admin" ? "Administrator" : "Satıcı"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedUserToReset(u)}
                        className="px-2 py-1 bg-white text-gray-500 rounded-lg border border-gray-200 hover:text-primary hover:border-primary/50 cursor-pointer shadow-xs transition-all flex items-center justify-center font-bold text-[10px]"
                        title="Şifrəni Dəyiş"
                      >
                        Şifrə
                      </button>
                      {!isCurrentSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`'${u.username}' istifadəçisini silməyə əminsiniz?`)) {
                              deleteUserMutation.mutate(u.id);
                            }
                          }}
                          className="p-1.5 bg-white text-red-500 rounded-lg border border-red-100 hover:bg-red-50 cursor-pointer shadow-xs transition-all flex items-center justify-center"
                          title="İstifadəçini Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create new user form */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Yeni İstifadəçi Əlavə Et</span>
              <div className="space-y-2 text-xs font-semibold">
                <input
                  type="text"
                  placeholder="İstifadəçi adı (məs. satici2)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50"
                />
                <input
                  type="password"
                  placeholder="Şifrə"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
                />
                <div className="flex gap-2">
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold cursor-pointer"
                  >
                    <option value="Staff">Satıcı (Staff)</option>
                    <option value="Admin">Administrator (Admin)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newUsername.trim() || !newUserPassword.trim()) {
                        toast({ title: "Xəta!", description: "İstifadəçi adı və şifrə boş ola bilməz", variant: "destructive" });
                        return;
                      }
                      createUserMutation.mutate({
                        username: newUsername,
                        password: newUserPassword,
                        role: newUserRole,
                      });
                    }}
                    className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all text-[11px]"
                  >
                    Əlavə Et
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* İki-Mərhələli Təhlükəsizlik (2FA) Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card space-y-4">
            <div className="flex items-center gap-2 mb-2 border-b border-gray-100/50 pb-3">
              <Lock className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-gray-900 text-sm">İki-Mərhələli Təhlükəsizlik (2FA)</h3>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
                Hesabınızın təhlükəsizliyini artırmaq üçün Google Authenticator və ya digər TOTP tətbiqləri vasitəsilə 2FA müdafiəsini aktivləşdirin.
              </p>

              {is2FAActive ? (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-black text-emerald-800">2FA AKTİVDİR (QORUNUR)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDisable2FA}
                    className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 font-bold text-xs rounded-xl cursor-pointer transition-all hover-elevate flex items-center justify-center gap-2"
                  >
                    2FA Müdafiəsini Söndür
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-400"></span>
                    <span className="text-xs font-black text-gray-500">2FA DEAKTİVDİR</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    className="w-full py-3 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all hover-elevate flex items-center justify-center gap-2"
                  >
                    2FA-nı Aktiv Et ⚡
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Satıcı Səlahiyyətləri Modulu */}
          <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card space-y-5">
            <div className="flex items-center justify-between mb-2 border-b border-gray-100/50 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">Satıcı Səlahiyyətlərinin İdarə Edilməsi</h3>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Satıcıların (Staff) sistemdə hansı modulları görüb-görməyəcəyini tənzimləyin</p>
                </div>
              </div>
              <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md font-extrabold uppercase tracking-wider">
                Admin Nəzarəti 🔒
              </span>
            </div>

            <div className="flex flex-col gap-1.5 text-xs font-semibold max-w-xs pb-2">
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">İstifadəçi Seçin</label>
              <select
                value={selectedPermissionsUserId}
                onChange={(e) => setSelectedPermissionsUserId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold cursor-pointer text-gray-800"
              >
                <option value="" disabled>İstifadəçi seçilməyib</option>
                {usersList?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role === "Admin" ? "Admin" : "Satıcı"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Satış Tarixçəsi</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların satış siyahısını, çekləri və kassa dövriyyəsini görməsinə icazə ver</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewSalesHistory === 1}
                  onChange={(e) => setStaffCanViewSalesHistory(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Anbar Qalıqları & Məhsullar</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların əsas anbar səhifəsinə və mədaxil tarixinə girişinə icazə ver (POS terminalda məhsul axtarışı açıq qalacaq)</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewStock === 1}
                  onChange={(e) => setStaffCanViewStock(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Məhsul Qalıqlarını Görmək (POS)</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların POS ekranında və axtarış zamanı məhsulların qalıq miqdarını görməsinə icazə ver</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewStockBalances === 1}
                  onChange={(e) => setStaffCanViewStockBalances(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Müştəri Reyestri</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların müştəri bazasını idarə etməsinə icazə ver (POS-da satış üçün müştəri seçimi yenə də mümkün olacaq)</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewCustomers === 1}
                  onChange={(e) => setStaffCanViewCustomers(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Tədarükçü Reyestri</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların topdan tədarükçüləri və topdan borc uçotunu görməsinə və idarə etməsinə icazə ver</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewVendors === 1}
                  onChange={(e) => setStaffCanViewVendors(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Nisyə & Borc İdarəetməsi</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların müştəri nisyə borclarını, gecikmiş ödənişləri və borc tarixçəsini görməsinə icazə ver</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewDebts === 1}
                  onChange={(e) => setStaffCanViewDebts(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl text-xs hover:bg-gray-50 transition-all gap-4 md:col-span-2">
                <div className="space-y-1">
                  <p className="font-bold text-gray-800">Xərclər Modulu</p>
                  <p className="text-[10px] text-gray-400 font-medium">Satıcıların arenda, maaş, bonus və digər xərcləri qeyd etməsinə və görməsinə icazə ver</p>
                </div>
                <input
                  type="checkbox"
                  checked={staffCanViewExpenses === 1}
                  onChange={(e) => setStaffCanViewExpenses(e.target.checked ? 1 : 0)}
                  className="size-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer mt-1"
                />
              </div>
            </div>

            <div className="border-t border-gray-100/50 pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveStaffPermissions}
                disabled={updatePermissionsMutation.isPending}
                className="px-6 py-2.5 bg-primary text-white font-extrabold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all text-xs flex items-center gap-2"
              >
                {updatePermissionsMutation.isPending ? "Yadda saxlanılır..." : "Səlahiyyətləri Yadda Saxla 💾"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirmModal && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-8 text-center space-y-6">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 to-amber-500 rounded-t-3xl"></div>
            
            <div className="size-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 animate-bounce">
              <Trash2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Sistemi Tamamilə Sıfırla 🔴</h3>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                Bu əməliyyat rəsmi mağaza idarəçisi (Admin) tərəfindən bütün sistem verilənlərini təmizləmək üçün istifadə olunur.
              </p>
            </div>

            <div className="bg-red-50/70 border border-red-100/80 rounded-2xl p-5 text-left text-xs text-red-800 space-y-2">
              <h4 className="font-black flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-red-800">
                ⚠️ TƏHLÜKƏLİ ƏMƏLİYYAT!
              </h4>
              <p className="font-bold leading-relaxed">
                Davam etsəniz, aşağıdakı bütün məlumatlar silinəcək:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-bold text-[11px] text-red-600">
                <li>Bütün satış tarixçəsi (qaimələr və müştəri borcları)</li>
                <li>Məhsullar kataloqu və anbar qalıqları (məhsul siyahısı)</li>
                <li>Tədarükçülər və anbar mədaxilləri (borclar, ödənişlər)</li>
                <li>Xərclər jurnalı, arenda və əməkhaqqı logs</li>
                <li>Sistem fəaliyyət tarixçəsi (activity logs)</li>
              </ul>
              <p className="font-extrabold text-[11px] mt-2 border-t border-red-200/50 pt-2 text-red-800 leading-normal">
                TAMAMİLƏ VƏ DAİMİ olaraq silinəcək. Bu əməliyyatın geri dönüşü YOXDUR!
              </p>
            </div>

            <div className="space-y-2.5 text-left">
              <label className="text-gray-700 font-bold block text-xs">
                Təsdiqləmək üçün Admin Şifrənizi daxil edin *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Admin hesabınızın şifrəsi..."
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-red-200 focus:border-red-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-red-50/20 font-mono text-sm text-gray-900 font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setResetPassword("");
                }}
                className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-wide transition-all cursor-pointer text-center font-extrabold"
              >
                Geri Qayıt
              </button>
              <button
                type="button"
                disabled={isResetting || !resetPassword.trim()}
                onClick={async () => {
                  if (!window.confirm("Bütün verilənləri daimi olaraq silmək istədiyinizə 100% əminsiniz? Sona qədər davam edirsiniz?")) {
                    return;
                  }
                  setIsResetting(true);
                  try {
                    const res = await fetch("/api/settings/reset", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: resetPassword })
                    });
                    
                    const data = await res.json();
                    if (res.ok) {
                      toast({
                        title: "Sistem Sıfırlandı! 💥",
                        description: "Bütün məlumatlar silindi. Sistem 2 saniyə sonra yenidən başlayacaq...",
                        variant: "success",
                      });
                      setTimeout(() => {
                        window.location.reload();
                      }, 2000);
                    } else {
                      toast({
                        title: "Sıfırlama xətası!",
                        description: data.message || "Admin şifrəsi yanlışdır.",
                        variant: "destructive",
                      });
                    }
                  } catch (e) {
                    toast({
                      title: "Texniki xəta!",
                      description: "Sıfırlama sorğusunu icra edərkən xəta yarandı.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer text-center shadow-lg shadow-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed font-extrabold"
              >
                {isResetting ? "Sıfırlanır..." : "Bütün Sistemi Sıfırla 💥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal Overlay */}
      {selectedUserToReset && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6 space-y-4">
            <h3 className="font-extrabold text-gray-900 text-sm border-b border-gray-50 pb-2">
              '{selectedUserToReset.username}' üçün Şifrəni Yenilə
            </h3>
            
            <div className="space-y-1.5 text-xs font-semibold">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Yeni Şifrə</label>
              <input
                type="password"
                placeholder="Yeni şifrə daxil edin"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono"
              />
            </div>

            <div className="flex gap-2.5 justify-end text-xs font-bold pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedUserToReset(null);
                  setResetPasswordValue("");
                }}
                className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!resetPasswordValue.trim()) {
                    toast({ title: "Xəta!", description: "Şifrə boş ola bilməz", variant: "destructive" });
                    return;
                  }
                  changePasswordMutation.mutate({
                    id: selectedUserToReset.id,
                    password: resetPasswordValue,
                  });
                }}
                className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all"
              >
                Şifrəni Dəyiş
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal Overlay */}
      {show2FASetupModal && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6 text-center space-y-5">
            
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-gray-900 text-sm">
                2FA Qurulum Kılavuzu
              </h3>
              <p className="text-[10px] text-gray-500 font-semibold">
                Mobil telefonunuzda Google Authenticator ilə bu QR kodu skan edin.
              </p>
            </div>

            {/* QR Code Container */}
            {twoFactorQRCode && (
              <div className="bg-gray-50 p-4 rounded-2xl inline-block border border-gray-100 mx-auto shadow-inner">
                <img
                  src={twoFactorQRCode}
                  alt="2FA QR Code"
                  className="size-40 mx-auto"
                />
              </div>
            )}

            {/* Secret key text copy alternative */}
            <div className="space-y-1 text-xs">
              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block font-bold">QR Skan etmək olmursa, gizli açar:</span>
              <code className="bg-gray-100 text-primary px-3 py-1.5 rounded-lg font-mono font-bold tracking-widest text-[11px] select-all block">
                {twoFactorSecret}
              </code>
            </div>

            {/* Verification code input */}
            <div className="space-y-1.5 text-xs text-left font-semibold">
              <label className="text-gray-400 uppercase tracking-wider block text-[9px] text-center font-bold">Tətbiqdəki 6 Rəqəmli OTP Kodu daxil edin</label>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={twoFactorCodeInput}
                onChange={(e) => setTwoFactorCodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-center font-mono font-black text-lg tracking-widest text-gray-900 animate-pulse"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 text-xs font-bold pt-1">
              <button
                type="button"
                onClick={() => {
                  setShow2FASetupModal(false);
                  setTwoFactorCodeInput("");
                }}
                className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all font-bold"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={handleActivate2FA}
                className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all font-black uppercase tracking-wider"
              >
                Aktivləşdir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
