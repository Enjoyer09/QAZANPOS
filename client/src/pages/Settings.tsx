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
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";
import { qzService } from "../lib/qz.ts";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Shop Info State
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [lowStockAlertCount, setLowStockAlertCount] = useState("5");
  const [defaultCreditDays, setDefaultCreditDays] = useState("30");

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

  // Fetch Settings
  const { data: settingsData, isLoading } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

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
    }
  }, [settingsData]);

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
    };

    updateSettingsMutation.mutate(payload);
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
                    href="https://wa.me/994551234567?text=Salam,%20BirSaaS%20tarif%20planımı%20yüksəltmək%20istəyirəm."
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

          {/* Card 1: Shop profile */}
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

          {/* Card 2: QZ Tray silent printing configuration */}
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

          {/* Card 3: Receipt Designer */}
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

          {/* Card 4: System limits */}
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

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Bütün Ayarları Saxla
            </button>
          </div>
        </form>

        {/* Right Preview Column: simulated 3D receipt roll */}
        <div className="space-y-6">
          {/* Real-time 3D receipt roll preview container */}
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

          {/* GDPR Database Backup Card */}
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
        </div>
      </div>

      {/* Change Password Modal Overlay */}
      {selectedUserToReset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xl max-w-sm w-full relative space-y-4">
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
    </div>
  );
}
