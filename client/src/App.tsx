import React, { useState, useEffect } from "react";
import { Link, Route, Switch, useLocation, Router } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Boxes,
  PlusCircle,
  FolderKanban,
  History,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  LogOut,
  Sparkles,
  Settings as SettingsIcon,
  Menu,
  Activity,
  Building,
  RotateCw,
  Tag,
  Truck,
  UserCheck,
  ChevronDown,
  HelpCircle,
} from "lucide-react";

// Reusable components
import { ToastProvider, ToastViewport, useToast } from "./components/Toast.tsx";
import { syncOfflineSalesToServer, syncOfflineReturnsToServer } from "./lib/offlineSync.ts";

// Pages (will implement them next)
import Dashboard from "./pages/Dashboard.tsx";
import Products from "./pages/Products.tsx";
import Stock from "./pages/Stock.tsx";
import StockIn from "./pages/StockIn.tsx";
import POS from "./pages/POS.tsx";
import SalesHistory from "./pages/SalesHistory.tsx";
import Invoice from "./pages/Invoice.tsx";
import ReturnInvoice from "./pages/ReturnInvoice.tsx";
import Customers from "./pages/Customers.tsx";
import Debts from "./pages/Debts.tsx";
import Expenses from "./pages/Expenses.tsx";
import SettingsPage from "./pages/Settings.tsx";
import Help from "./pages/Help.tsx";
import Login from "./pages/Login.tsx";
import Logs from "./pages/Logs.tsx";
import SuperDashboard from "./pages/SuperDashboard.tsx";
import Landing from "./pages/Landing.tsx";
import Labels from "./pages/Labels.tsx";
import Vendors from "./pages/Vendors.tsx";
import VendorReturns from "./pages/VendorReturns.tsx";
import Payroll from "./pages/Payroll.tsx";
import PnL from "./pages/PnL.tsx";
import LimitReachedModal from "./components/LimitReachedModal.tsx";

// Global fetch interceptor to automatically attach x-user-role, x-user-username, and x-tenant-host headers
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  init = init || {};
  init.headers = init.headers || {};
  
  // Inject original browser host domain for dynamic subdomain routing
  if (init.headers instanceof Headers) {
    init.headers.set("x-tenant-host", window.location.host);
  } else if (Array.isArray(init.headers)) {
    const hasHeaderHost = init.headers.some(([k]) => k.toLowerCase() === "x-tenant-host");
    if (!hasHeaderHost) {
      init.headers.push(["x-tenant-host", window.location.host]);
    }
  } else {
    (init.headers as Record<string, string>)["x-tenant-host"] = window.location.host;
  }

  const userStr = localStorage.getItem("qazanpos_user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (init.headers instanceof Headers) {
        init.headers.set("x-user-role", user.role);
        init.headers.set("x-user-username", user.username);
        if (user.token) {
          init.headers.set("Authorization", `Bearer ${user.token}`);
        }
      } else if (Array.isArray(init.headers)) {
        const hasHeaderRole = init.headers.some(([k]) => k.toLowerCase() === "x-user-role");
        if (!hasHeaderRole) {
          init.headers.push(["x-user-role", user.role]);
        }
        const hasHeaderUser = init.headers.some(([k]) => k.toLowerCase() === "x-user-username");
        if (!hasHeaderUser) {
          init.headers.push(["x-user-username", user.username]);
        }
        if (user.token) {
          const hasAuth = init.headers.some(([k]) => k.toLowerCase() === "authorization");
          if (!hasAuth) {
            init.headers.push(["Authorization", `Bearer ${user.token}`]);
          }
        }
      } else {
        (init.headers as Record<string, string>)["x-user-role"] = user.role;
        (init.headers as Record<string, string>)["x-user-username"] = user.username;
        if (user.token) {
          (init.headers as Record<string, string>)["Authorization"] = `Bearer ${user.token}`;
        }
      }
    } catch {
      // Ignore
    }
  }

  // Attach 2FA trust token if it exists in localStorage
  const trustToken = localStorage.getItem("qazanpos_2fa_trust_token");
  if (trustToken) {
    if (init.headers instanceof Headers) {
      init.headers.set("x-2fa-trust-token", trustToken);
    } else if (Array.isArray(init.headers)) {
      const hasHeaderTrust = init.headers.some(([k]) => k.toLowerCase() === "x-2fa-trust-token");
      if (!hasHeaderTrust) {
        init.headers.push(["x-2fa-trust-token", trustToken]);
      }
    } else {
      (init.headers as Record<string, string>)["x-2fa-trust-token"] = trustToken;
    }
  }
  const response = await originalFetch(input, init);
  if (response.status === 401) {
    const isAuthRequest = typeof input === "string" && (input.includes("/auth/login") || input.includes("/auth/2fa-verify") || input.includes("/auth/2fa-setup") || input.includes("/auth/2fa-activate"));
    if (!isAuthRequest) {
      localStorage.removeItem("qazanpos_user");
      window.location.reload();
    }
  }
  if (response.status === 402) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body.limitReached) {
        window.dispatchEvent(new CustomEvent("birsaas_limit_reached", { detail: body }));
      }
    } catch {
      // Ignore
    }
  }
  return response;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function getIconAnimationClass(label: string) {
  const labelLower = label.toLowerCase();
  if (labelLower.includes("ayar")) return "hover-spin-slow";
  if (labelLower.includes("loq") || labelLower.includes("yenil") || labelLower.includes("tarix") || labelLower.includes("satis")) return "hover-spin-loop";
  if (labelLower.includes("pos") || labelLower.includes("nisye") || labelLower.includes("xercl") || labelLower.includes("maas")) return "hover-spring";
  return "hover-bounce-up";
}

function AppLayout({ children, user, currentUser, onLogout }: { children: React.ReactNode; user: any; currentUser: any; onLogout: () => void }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const host = window.location.hostname;
  const parts = host.split(".");
  const isSuperTenant = parts.length > 1 && parts[0].toLowerCase() === "super";

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings", host],
    queryFn: async () => {
      const isSinaq = parts.length > 0 && (parts[0].toLowerCase() === "sinaq" || parts[0].toLowerCase() === "demo");
      if (isSuperTenant || isSinaq || parts.length <= 1 || parts[0] === "localhost" || parts[0] === "www" || parts[0] === "qazanpos-production" || parts[0].includes("127.0.0.1")) {
        return { storeName: "BirSaaS" };
      }
      const res = await fetch("/api/settings");
      if (!res.ok) return { storeName: "BirSaaS" };
      return res.json();
    },
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineSalesToServer((count) => {
        toast({
          title: "Əlaqə Bərpa Olundu",
          description: `${count} ədəd oflayn satış uğurla buluda sinxronizasiya edildi!`,
          variant: "success",
        });
      });
      syncOfflineReturnsToServer((count) => {
        toast({
          title: "Əlaqə Bərpa Olundu",
          description: `${count} ədəd oflayn geri qaytarış uğurla buluda sinxronizasiya edildi!`,
          variant: "success",
        });
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "İnternet Kəsildi!",
        description: "POS terminalı avtomatik olaraq Fövqəladə Oflayn rejiminə keçdi.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);


  // Regular background sync check every 30 seconds
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      syncOfflineSalesToServer((count) => {
        toast({
          title: "Arxaplan Sinxronizasiyası",
          description: `${count} ədəd oflayn satış uğurla buluda sinxronizasiya edildi!`,
          variant: "success",
        });
      });
      syncOfflineReturnsToServer((count) => {
        toast({
          title: "Arxaplan Sinxronizasiyası",
          description: `${count} ədəd oflayn geri qaytarış uğurla buluda sinxronizasiya edildi!`,
          variant: "success",
        });
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, toast]);

  const isAdmin = user?.role === "Admin";

  // Logical Navigation Groups for structured, unbloated menus
  const baseGroups = isSuperTenant
    ? [
        {
          label: "SaaS Panel",
          icon: LayoutDashboard,
          items: [
            { href: "/", label: "SaaS Panel", icon: LayoutDashboard },
          ]
        },
        {
          label: "Audit Loqları",
          icon: Activity,
          items: [
            { href: "/loqlar", label: "Audit Loqları", icon: Activity },
          ]
        }
      ]
    : [
        {
          label: "POS Satış ⚡",
          icon: Sparkles,
          items: [
            { href: "/pos", label: "POS Satış ⚡", icon: Sparkles, isHighlight: true },
          ]
        },
        {
          label: "Tarixçə",
          icon: History,
          items: [
            ...((isAdmin || currentUser?.staffCanViewSalesHistory !== 0) ? [
              { href: "/satislar", label: "Satış Tarixçəsi", icon: History }
            ] : [])
          ]
        },
        {
          label: "Anbar",
          icon: Boxes,
          items: [
            { href: "/anbar", label: "Məhsul Qalıqları", icon: Boxes },
            { href: "/anbar/daxil", label: "Yeni Mədaxil", icon: PlusCircle },
            ...((isAdmin || currentUser?.staffCanViewStock !== 0) ? [
              { href: "/anbar/qaytaris", label: "Tədarükçüyə Qaytarış", icon: RotateCw }
            ] : []),
            ...((isAdmin || currentUser?.staffCanManageCatalog !== 0) ? [
              { href: "/mehsullar", label: "Məhsul Kataloqu", icon: FolderKanban }
            ] : []),
            ...(isAdmin ? [
              { href: "/etiketler", label: "Etiket Generatoru", icon: Tag }
            ] : [])
          ]
        },
        {
          label: "Maliyyə & HR",
          icon: TrendingDown,
          items: [
            ...((isAdmin || currentUser?.staffCanViewDebts !== 0) ? [
              { href: "/nisye", label: "Nisyə & Borclar", icon: AlertTriangle }
            ] : []),
            ...(isAdmin ? [
              { href: "/tedarukculer", label: "Tədarükçülər", icon: Truck },
              { href: "/xercler", label: "Xərclər Modulu", icon: TrendingDown },
              { href: "/pnl", label: "Mənfəət/Zərər (P&L)", icon: TrendingUp },
              { href: "/hr", label: "HR & Əməkhaqqı", icon: UserCheck }
            ] : []),
            ...((isAdmin || currentUser?.staffCanViewCustomers !== 0) ? [
              { href: "/musteriler", label: "Müştəri Bazası", icon: Users }
            ] : [])
          ]
        },
        {
          label: "Sistem",
          icon: SettingsIcon,
          items: [
            ...(isAdmin ? [{ href: "/", label: "Statistika Paneli", icon: LayoutDashboard }] : []),
            ...(isAdmin ? [{ href: "/loqlar", label: "Sistem Loqları", icon: Activity }] : []),
            { href: "/ayarlar", label: "Sistem Ayarları", icon: SettingsIcon },
            { href: "/yardim", label: "Yardım & Təlimat 📘", icon: HelpCircle },
          ]
        }
      ];

  const navGroups = baseGroups.filter((group) => group.items.length > 0);

  return (
    <div className="relative min-h-screen w-full flex flex-col pb-12 select-none">
      {/* 0. Demo Session Alert Banner */}
      {sessionStorage.getItem("birsaas_demo_active") === "true" && (
        <div className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black tracking-wide py-2.5 px-4 text-center select-none flex items-center justify-center gap-2 animate-pulse no-print shadow-md shadow-emerald-500/10 z-100">
          <Sparkles className="w-3.5 h-3.5 animate-spin duration-3000" />
          <span>BİRSAAS DEMO SINAQ REJİMİ: Bütün etdiyiniz əməliyyatlar müvəqqətidir və çıxış edildikdə tamamilə silinəcəkdir.</span>
        </div>
      )}

      {/* 0b. Developer Lab Alert Banner */}
      {window.location.hostname.split(".")[0].toLowerCase() === "demo" && (
        <div className="w-full bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black tracking-wide py-2.5 px-4 text-center select-none flex items-center justify-center gap-2 animate-pulse no-print shadow-md shadow-purple-500/10 z-100">
          <span>BİRSAAS TƏRTİBATÇI LABORATORİYASI (DEVELOPER LAB) 🧪 : Real verilənlər bazası (PostgreSQL) ilə işləyirsiniz. Bütün testləriniz qeyd edilir!</span>
        </div>
      )}

      {/* Dynamic Liquid Background Blobs */}
      <div className="liquid-bg">
        <div className="liquid-blob-1"></div>
        <div className="liquid-blob-2"></div>
        <div className="liquid-blob-3"></div>
      </div>

      {/* 1. Centered Floating Liquid Glass Navbar */}
      <header className="w-[calc(100%-2rem)] sm:w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5 mt-4 sm:mt-6 rounded-2xl glass-navbar flex items-center justify-between shadow-xl sticky top-4 sm:top-6 z-50 no-print">
        {/* Brand Logo & Name */}
        <Link href={isSuperTenant ? "/" : (isAdmin ? "/" : "/pos")}>
          <div className="flex items-center gap-3 cursor-pointer group">
            {settings?.storeName && settings.storeName !== "BirSaaS" ? (
              <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
                {settings.storeName[0].toUpperCase()}
              </div>
            ) : (
              <img src="/assets/logo.jpg" alt="BirSaaS Logo" className="size-9 rounded-xl object-cover shadow-md transition-transform group-hover:scale-105" />
            )}
            <div>
              <h1 className="font-extrabold text-gray-900 tracking-tight text-sm leading-none transition-colors group-hover:text-primary">
                {isSuperTenant ? "BirSaaS Platform" : (settings?.storeName || "BirSaaS")}
              </h1>
              <span className="text-[10px] font-bold text-gray-400 mt-1 block tracking-wide uppercase">
                {isSuperTenant ? "PLATFORMA PANELİ" : (settings?.storeName ? "MAĞAZA PORTALI" : "ANBAR & SATIŞ")}
              </span>
            </div>
          </div>
        </Link>

        {/* Dynamic Horizontal Navigation Menu */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-3 py-1 pr-2">
          {navGroups.map((group) => {
            const hasActiveChild = group.items.some(
              (item) =>
                item.href === "/"
                  ? location === "/"
                  : item.href === "/anbar"
                  ? location === "/anbar"
                  : location.startsWith(item.href)
            );

            const isOpen = activeDropdown === group.label;

            // Render single-item groups as simple flat buttons to avoid unnecessary dropdown wrappers
            if (group.items.length === 1) {
              const item = group.items[0];
              const isActive =
                item.href === "/"
                  ? location === "/"
                  : item.href === "/anbar"
                  ? location === "/anbar"
                  : location.startsWith(item.href);

              const isItemDisabled = false;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (isItemDisabled) {
                      e.preventDefault();
                      toast({
                        title: "Oflayn Rejim Kilidi 🔒",
                        description: "Bu bölmə yalnız onlayn rejimdə aktivdir. Oflayn rejimdə yalnız POS Satış və Qalıqlar bölmələri keçərlidir.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-extrabold text-[11px] xl:text-xs cursor-pointer transition-all ${
                      isItemDisabled
                        ? "text-gray-300 opacity-50 cursor-not-allowed"
                        : (item as any).isHighlight
                        ? isActive
                          ? "bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover-elevate"
                          : "bg-blue-50 text-blue-600 font-extrabold border border-blue-100 hover:bg-blue-100/60 shadow-xs hover-elevate"
                        : isActive
                        ? "bg-primary/10 text-primary font-extrabold border border-primary/20 shadow-xs active-neon-glow"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/50"
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${getIconAnimationClass(item.label)}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setActiveDropdown(group.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {/* Trigger Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(isOpen ? null : group.label);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-extrabold text-[11px] xl:text-xs transition-all cursor-pointer select-none border border-transparent ${
                    hasActiveChild
                      ? "bg-primary/10 text-primary border-primary/20 active-neon-glow"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/50"
                  }`}
                >
                  <group.icon className={`w-3.5 h-3.5 shrink-0 ${getIconAnimationClass(group.label)}`} />
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Card overlay */}
                {isOpen && (
                  <div 
                    className="absolute left-0 top-full pt-1.5 w-60 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          item.href === "/"
                            ? location === "/"
                            : item.href === "/anbar"
                            ? location === "/anbar"
                            : location.startsWith(item.href);

                        const isItemDisabled = false;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={(e) => {
                              if (isItemDisabled) {
                                e.preventDefault();
                                toast({
                                  title: "Oflayn Rejim Kilidi 🔒",
                                  description: "Bu bölmə yalnız onlayn rejimdə aktivdir. Oflayn rejimdə yalnız POS Satış və Qalıqlar bölmələri keçərlidir.",
                                  variant: "destructive",
                                });
                              } else {
                                setActiveDropdown(null);
                              }
                            }}
                          >
                            <div
                              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs xl:text-[13px] font-bold cursor-pointer transition-all ${
                                isItemDisabled
                                  ? "text-gray-300 opacity-40 cursor-not-allowed"
                                  : isActive
                                  ? "bg-primary text-white font-extrabold shadow-sm"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                              }`}
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${getIconAnimationClass(item.label)} ${isItemDisabled ? "text-gray-300" : isActive ? "text-white" : "text-gray-400"}`} />
                              <span>{item.label}</span>
                              {isItemDisabled && <span className="text-[9px] ml-auto">🔒</span>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Status Indicator & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isOnline ? (
            <div className="hidden xs:flex items-center gap-1.5 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100/50 text-[10px] font-bold text-emerald-700 glass">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Onlayn</span>
            </div>
          ) : (
            <div className="hidden xs:flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80 text-[10px] font-bold text-amber-700 glass shadow-md shadow-amber-500/5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
              <span>Fövqəladə Oflayn</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-extrabold block text-gray-900 leading-none">
                {user?.username}
              </span>
              <span className="text-[8px] font-bold text-gray-400 mt-1 block">
                {user?.role === "Admin" ? "Administrator" : "Satıcı"}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="size-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hidden sm:flex items-center justify-center border border-red-100 select-none cursor-pointer transition-all"
              title="Sistemdən Çıxış"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="size-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 flex lg:hidden items-center justify-center border border-gray-200 select-none cursor-pointer transition-all"
              title="Menyu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-over Drawer Menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-100 flex lg:hidden bg-black/60 backdrop-blur-xs animate-in fade-in-0 no-print" 
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="bg-white w-72 h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                {settings?.storeName && settings.storeName !== "BirSaaS" ? (
                  <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg">
                    {settings.storeName[0].toUpperCase()}
                  </div>
                ) : (
                  <img src="/assets/logo.jpg" alt="BirSaaS Logo" className="size-9 rounded-xl object-cover" />
                )}
                <div>
                  <h1 className="font-extrabold text-gray-900 text-sm leading-none">
                    {isSuperTenant ? "BirSaaS Platform" : (settings?.storeName || "BirSaaS")}
                  </h1>
                  <span className="text-[10px] font-bold text-gray-400 mt-1 block uppercase">
                    {isSuperTenant ? "PLATFORMA PANELİ" : (settings?.storeName ? "MAĞAZA PORTALI" : "ANBAR & SATIŞ")}
                  </span>
                </div>
              </div>

              {/* Menu List */}
              <nav className="flex flex-col gap-2.5 pt-4 overflow-y-auto max-h-[60vh] pr-1 scrollbar-none">
                {navGroups.map((group) => {
                  const hasActiveChild = group.items.some(
                    (item) =>
                      item.href === "/"
                        ? location === "/"
                        : item.href === "/anbar"
                        ? location === "/anbar"
                        : location.startsWith(item.href)
                  );

                  const isGroupOpen = mobileOpenGroups[group.label] ?? hasActiveChild;

                  // Render single-item groups as flat items in mobile menu to avoid unnecessary drawers
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    const isActive =
                      item.href === "/"
                        ? location === "/"
                        : item.href === "/anbar"
                        ? location === "/anbar"
                        : location.startsWith(item.href);

                    const isItemDisabled = false;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => {
                          if (isItemDisabled) {
                            e.preventDefault();
                            toast({
                              title: "Oflayn Rejim Kilidi 🔒",
                              description: "Bu bölmə yalnız onlayn rejimdə aktivdir. Oflayn rejimdə yalnız POS Satış və Qalıqlar bölmələri keçərlidir.",
                              variant: "destructive",
                            });
                          } else {
                            setIsMobileMenuOpen(false);
                          }
                        }}
                      >
                        <div
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs cursor-pointer transition-all border border-transparent ${
                            isItemDisabled
                              ? "text-gray-300 opacity-40 cursor-not-allowed"
                              : (item as any).isHighlight
                              ? isActive
                                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/20"
                                : "bg-blue-50 text-blue-600 font-extrabold border border-blue-100"
                      : isActive
                              ? "bg-primary/10 text-primary font-extrabold"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/50"
                          }`}
                        >
                          <item.icon className={`w-4 h-4 shrink-0 ${getIconAnimationClass(item.label)}`} />
                          <span>{item.label}</span>
                          {isItemDisabled && <span className="text-[9px] text-gray-400 ml-auto">🔒</span>}
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <div key={group.label} className="border border-gray-100/60 rounded-2xl overflow-hidden bg-gray-50/30 animate-in fade-in zoom-in-95 duration-150">
                      {/* Accordion Header */}
                      <button
                        onClick={() => setMobileOpenGroups(prev => ({ ...prev, [group.label]: !isGroupOpen }))}
                        className={`w-full flex items-center justify-between px-4 py-3 font-extrabold text-xs cursor-pointer transition-all ${
                          hasActiveChild ? "bg-primary/5 text-primary" : "text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <group.icon className={`w-4 h-4 shrink-0 ${getIconAnimationClass(group.label)}`} />
                          <span>{group.label}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isGroupOpen ? "rotate-180" : ""}`} />
                      </button>

                      {/* Accordion Items */}
                      {isGroupOpen && (
                        <div className="p-1.5 bg-white border-t border-gray-100/50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive =
                              item.href === "/"
                                ? location === "/"
                                : item.href === "/anbar"
                                ? location === "/anbar"
                                : location.startsWith(item.href);

                            const isItemDisabled = false;

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={(e) => {
                                  if (isItemDisabled) {
                                    e.preventDefault();
                                    toast({
                                      title: "Oflayn Rejim Kilidi 🔒",
                                      description: "Bu bölmə yalnız onlayn rejimdə aktivdir. Oflayn rejimdə yalnız POS Satış və Qalıqlar bölmələri keçərlidir.",
                                      variant: "destructive",
                                    });
                                  } else {
                                    setIsMobileMenuOpen(false);
                                  }
                                }}
                              >
                                <div
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                                    isItemDisabled
                                      ? "text-gray-300 opacity-40 cursor-not-allowed"
                                      : isActive
                                      ? "bg-primary/10 text-primary font-extrabold"
                                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                  }`}
                                >
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${getIconAnimationClass(item.label)} ${isItemDisabled ? "text-gray-300" : ""}`} />
                                  <span>{item.label}</span>
                                  {isItemDisabled && <span className="text-[9px] text-gray-400 ml-auto">🔒</span>}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Footer Profile & Logout */}
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs">
                  {user?.username ? user.username.substring(0, 2).toUpperCase() : "SU"}
                </div>
                <div>
                  <span className="text-xs font-extrabold block text-gray-900 leading-none">
                    {user?.username}
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 mt-1 block">
                    {user?.role === "Admin" ? "Administrator" : "Satıcı"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-xs rounded-xl border border-red-100 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sistemdən Çıxış</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main content container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 mt-8 flex flex-col">
        <div className="flex-1 w-full animate-in fade-in-50 duration-300">
          {children}
        </div>
      </main>

      {/* 3. Premium Watermark & Version Footer */}
      <footer className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 mt-8 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between text-[10px] font-bold text-gray-400 tracking-wider no-print">
        <div className="flex items-center gap-2">
          <img src="/assets/logo.jpg" alt="BirSaaS Logo" className="size-4.5 rounded-md object-cover" />
          <span>BirSaaS Platformu © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <span>Sistem Versiyası: <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-md font-extrabold">1.0 RC</span></span>
          <span className="text-gray-300">|</span>
          <span className="bg-gray-100 px-2 py-0.5 rounded-md text-gray-500 font-extrabold uppercase">Bulud və Oflayn Sinxronizasiya</span>
        </div>
      </footer>
    </div>
  );
}

function TransitionSwitch({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [renderedChildren, setRenderedChildren] = useState(children);

  useEffect(() => {
    if (location !== displayLocation) {
      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          React.startTransition(() => {
            setDisplayLocation(location);
            setRenderedChildren(children);
          });
        });
      } else {
        setDisplayLocation(location);
        setRenderedChildren(children);
      }
    } else {
      setRenderedChildren(children);
    }
  }, [location, children, displayLocation]);

  const customHook = () => [displayLocation, setLocation] as [string, (to: string, options?: any) => void];

  return (
    <Router hook={customHook}>
      {renderedChildren}
    </Router>
  );
}

// 3. Overdue debt check component
function OverdueDebtCheck() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: overdueList } = useQuery<any[]>({
    queryKey: ["/api/credits/overdue"],
    queryFn: async () => {
      const res = await fetch("/api/credits/overdue");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  useEffect(() => {
    if (!overdueList || overdueList.length === 0) return;

    const lastCheck = localStorage.getItem("qazan_credit_notif_last_check");
    const now = new Date();

    if (lastCheck) {
      const lastCheckDate = new Date(lastCheck);
      const diffTime = Math.abs(now.getTime() - lastCheckDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 3) return; // Notification once every 3 days
    }

    setIsOpen(true);
    localStorage.setItem("qazan_credit_notif_last_check", now.toISOString());
  }, [overdueList]);

  if (!isOpen || !overdueList || overdueList.length === 0) return null;

  return (
    <div className="liquid-glass-overlay">
      <div className="liquid-glass-card max-w-md p-6">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <div className="size-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">Gecikmiş Nisyə Bildirişi</h3>
            <span className="text-xs text-red-500 font-bold">Müddəti keçmiş borclar var</span>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Aşağıdakı müştərilərin nisyə ödəmə müddəti keçmişdir:
        </p>

        <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-1">
          {overdueList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl text-sm"
            >
              <div>
                <p className="font-semibold text-gray-950">{item.customerName || "Adsız Müştəri"}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Tarix: {new Date(item.creditDueDate).toLocaleDateString("az-AZ")}
                </p>
                {item.customerPhone && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.customerPhone}</p>
                )}
              </div>
              <span className="font-bold text-red-700 font-mono text-base">{Number(item.totalAmount || 0).toFixed(2)} ₼</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-gray-200 text-gray-500 font-medium text-sm rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            Bağla
          </button>
          <Link href="/nisye">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 cursor-pointer flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> Nisyələrə bax
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MainRoutes({ user, onLogout }: { user: any; onLogout: () => void }) {
  const isAdmin = user?.role === "Admin";
  
  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user,
  });

  const host = window.location.hostname;
  const parts = host.split(".");
  const isSuperTenant = parts.length > 1 && parts[0].toLowerCase() === "super";

  return (
    <AppLayout user={user} currentUser={currentUser} onLogout={onLogout}>
      <TransitionSwitch>
        {isSuperTenant ? (
          <Switch>
            <Route path="/" component={SuperDashboard} />
            <Route path="/loqlar" component={Logs} />
            <Route>
              <div className="flex flex-col items-center justify-center py-20">
                <h1 className="text-6xl font-extrabold text-primary">403</h1>
                <p className="text-gray-500 mt-2 font-medium">Giriş qadağandır və ya səhifə mövcud deyil.</p>
                <Link href="/" className="mt-4 text-sm text-primary font-bold hover:underline">
                  Geri qayıt
                </Link>
              </div>
            </Route>
          </Switch>
        ) : (
          <Switch>
            {isAdmin && <Route path="/" component={Dashboard} />}
            <Route path="/pos" component={POS} />
            {(isAdmin || currentUser?.staffCanViewDebts !== 0) && <Route path="/nisye" component={Debts} />}
             <Route path="/musteriler" component={Customers} />
             {isAdmin && <Route path="/tedarukculer" component={Vendors} />}
             {isAdmin && <Route path="/hr" component={Payroll} />}
             <Route path="/anbar" component={Stock} />
             <Route path="/anbar/daxil" component={StockIn} />
             {(isAdmin || currentUser?.staffCanViewStock !== 0) && <Route path="/anbar/qaytaris" component={VendorReturns} />}
            {(isAdmin || currentUser?.staffCanManageCatalog !== 0) && <Route path="/mehsullar" component={Products} />}
            {isAdmin && <Route path="/etiketler" component={Labels} />}
            <Route path="/satislar" component={SalesHistory} />
            <Route path="/satislar/:id" component={Invoice} />
            <Route path="/qaytarislar/:id" component={ReturnInvoice} />             {isAdmin && <Route path="/xercler" component={Expenses} />}
             {isAdmin && <Route path="/pnl" component={PnL} />}
             {isAdmin && <Route path="/loqlar" component={Logs} />}
            <Route path="/ayarlar" component={SettingsPage} />
            <Route path="/yardim" component={Help} />
            <Route>
              <div className="flex flex-col items-center justify-center py-20">
                <h1 className="text-6xl font-extrabold text-primary">403</h1>
                <p className="text-gray-500 mt-2 font-medium">Giriş qadağandır və ya səhifə mövcud deyil.</p>
                <Link href={isAdmin ? "/" : "/pos"} className="mt-4 text-sm text-primary font-bold hover:underline">
                  Geri qayıt
                </Link>
              </div>
            </Route>
          </Switch>
        )}
      </TransitionSwitch>
    </AppLayout>
  );
}

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [activeLimitError, setActiveLimitError] = useState<{ limitType: "products" | "sales" | "users"; current: number; max: number; tier: string } | null>(null);

  useEffect(() => {
    const handleLimitReached = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveLimitError({
        limitType: detail.limitType,
        current: detail.current,
        max: detail.max,
        tier: detail.tier
      });
    };
    window.addEventListener("birsaas_limit_reached", handleLimitReached);
    return () => {
      window.removeEventListener("birsaas_limit_reached", handleLimitReached);
    };
  }, []);

  const host = window.location.hostname;
  const parts = host.split(".");
  const isSuperTenant = parts.length > 1 && parts[0].toLowerCase() === "super";

  // Moved hook to the top level unconditionally before early returns to preserve Hook rules
  const { data: tenantConfig, error: tenantError, isLoading: isCheckingTenant } = useQuery<any>({
    queryKey: ["/api/settings", host],
    queryFn: async () => {
      // If super, sinaq/demo sandboxes, localhost, or bare domains, they are always valid fallbacks
      const isSinaq = parts.length > 0 && (parts[0].toLowerCase() === "sinaq" || parts[0].toLowerCase() === "demo");
      if (isSuperTenant || isSinaq || parts.length <= 1 || parts[0] === "localhost" || parts[0] === "www" || parts[0] === "qazanpos-production" || parts[0].includes("127.0.0.1")) {
        return { valid: true };
      }
      
      const res = await fetch("/api/settings");
      if (!res.ok) {
        if (res.status === 404) {
          const errData = await res.json();
          if (errData.errorType === "TENANT_NOT_FOUND") {
            throw new Error("TENANT_NOT_FOUND");
          }
        }
        throw new Error("API_ERROR");
      }
      return res.json();
    },
    retry: false,
  });

  const isSinaqSubdomain = parts.length > 0 && parts[0].toLowerCase() === "sinaq";
  const isDemoActive = sessionStorage.getItem("birsaas_demo_active") === "true";
  const isSandboxScoped = isDemoActive || isSinaqSubdomain;

  useEffect(() => {
    const userStr = isSandboxScoped 
      ? sessionStorage.getItem("qazanpos_user") 
      : localStorage.getItem("qazanpos_user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {
        if (isSandboxScoped) {
          sessionStorage.removeItem("qazanpos_user");
        } else {
          localStorage.removeItem("qazanpos_user");
        }
      }
    }
    setIsCheckingSession(false);
  }, [isSandboxScoped]);

  // Load and apply local UI scaling setting (Fluid REM Scaling)
  useEffect(() => {
    const savedScale = localStorage.getItem("qazanpos_ui_scale") || "120%";
    const scaleVal = savedScale.replace("%", "");
    const basePx = (parseFloat(scaleVal) / 100) * 16;
    document.documentElement.style.fontSize = `${basePx}px`;
  }, []);

  const handleLoginSuccess = (userData: any) => {
    if (isSandboxScoped) {
      sessionStorage.setItem("qazanpos_user", JSON.stringify(userData));
    } else {
      localStorage.setItem("qazanpos_user", JSON.stringify(userData));
    }
    setUser(userData);
  };

  const handleLogout = () => {
    if (isSandboxScoped) {
      sessionStorage.clear();
    } else {
      localStorage.removeItem("qazanpos_user");
    }
    setUser(null);
    window.location.reload();
  };

  if (isCheckingSession || isCheckingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="text-center space-y-4">
          <RotateCw className="w-8 h-8 text-primary mx-auto animate-spin" />
          <span className="text-xs font-bold text-gray-400 block animate-pulse">BirSaaS yüklənir...</span>
        </div>
      </div>
    );
  }

  if (tenantError?.message === "TENANT_NOT_FOUND") {
    const slug = parts[0].toLowerCase();

    // Construct dynamic sinaq subdomain link based on current host
    const currentHost = window.location.host; // e.g. "localhost:5173" or "birsaas.shop"
    const hostParts = currentHost.split(".");
    let demoUrl = "";

    if (currentHost.includes("localhost") || currentHost.includes("127.0.0.1")) {
      demoUrl = `http://sinaq.localhost:${window.location.port || "5173"}/`;
    } else {
      if (hostParts.length > 1) {
        if (hostParts.length === 2) {
          demoUrl = `https://sinaq.${currentHost}/`;
        } else {
          hostParts[0] = "sinaq";
          demoUrl = `https://${hostParts.join(".")}/`;
        }
      } else {
        demoUrl = `https://sinaq.birsaas.shop/`; // fallback
      }
    }

    return (
      <div className="min-h-screen w-screen flex items-center justify-center relative overflow-hidden select-none pb-12 bg-gray-50">
        {/* Dynamic Liquid Background Blobs */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 size-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/4 size-[450px] bg-red-500/15 rounded-full blur-3xl animate-pulse duration-5000"></div>
        </div>

        <div className="w-full max-w-md px-6 z-10 text-center space-y-8 animate-in fade-in-0 duration-500">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center gap-3.5">
            <div className="size-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-primary/25 border border-white/20">
              B
            </div>
            <div>
              <h1 className="font-extrabold text-gray-900 tracking-tight text-2xl leading-none">
                BirSaaS Platform
              </h1>
              <span className="text-xs font-bold text-gray-400 mt-2 block tracking-wider uppercase">
                Çox-Biznesli POS & Anbar Platforması
              </span>
            </div>
          </div>

          {/* Premium Glassmorphic Apology Card */}
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl glass-card relative overflow-hidden space-y-6">
            <div className="size-16 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500 border border-red-100/50">
              <Building className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                Biznes Tapılmadı
              </h2>
              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                Sizin <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded-md font-extrabold">'{slug}'</span> adlı biznesiniz bizim sistemdə mövcud deyil.
              </p>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-bold bg-gray-50/50 p-4 rounded-xl border border-gray-100/30">
              Bulud əsaslı POS və Anbar sistemimizi dərhal və heç bir öhdəlik olmadan canlı sınaqdan keçirə bilərsiniz.
            </p>

            {/* Redirection Action Button */}
            <a
              href={demoUrl}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl cursor-pointer flex items-center justify-center gap-2 text-sm shadow-md shadow-emerald-500/10 transition-all hover-elevate animate-bounce-subtle"
            >
              <Sparkles className="w-4 h-4 text-white shrink-0" />
              Demoya baxın 🚀
            </a>
          </div>

          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Dəstək və Əlaqə: <a href="mailto:abbas@laptopmarket.az" className="text-primary hover:underline">abbas@laptopmarket.az</a>
          </p>
        </div>
      </div>
    );
  }

  const isWwwOrBare = parts.length <= 1 || parts[0].toLowerCase() === "www";

  return (
    <ToastProvider>
      {user ? (
        <>
          <MainRoutes user={user} onLogout={handleLogout} />
          {!isSuperTenant && <OverdueDebtCheck />}
        </>
      ) : isWwwOrBare ? (
        <Landing />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} tenantConfig={tenantConfig} />
      )}
      {activeLimitError && (
        <LimitReachedModal
          limitType={activeLimitError.limitType}
          current={activeLimitError.current}
          max={activeLimitError.max}
          tier={activeLimitError.tier}
          onClose={() => setActiveLimitError(null)}
        />
      )}
      <ToastViewport />
    </ToastProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
