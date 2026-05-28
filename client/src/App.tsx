import React, { useState, useEffect } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Boxes,
  PlusCircle,
  FolderKanban,
  History,
  TrendingDown,
  AlertTriangle,
  Receipt,
  LogOut,
  Sparkles,
  Settings as SettingsIcon,
  Menu,
  Activity,
} from "lucide-react";

// Reusable components
import { ToastProvider, ToastViewport } from "./components/Toast.tsx";

// Pages (will implement them next)
import Dashboard from "./pages/Dashboard.tsx";
import Products from "./pages/Products.tsx";
import Stock from "./pages/Stock.tsx";
import StockIn from "./pages/StockIn.tsx";
import POS from "./pages/POS.tsx";
import SalesHistory from "./pages/SalesHistory.tsx";
import Invoice from "./pages/Invoice.tsx";
import Customers from "./pages/Customers.tsx";
import Debts from "./pages/Debts.tsx";
import Expenses from "./pages/Expenses.tsx";
import SettingsPage from "./pages/Settings.tsx";
import Login from "./pages/Login.tsx";
import Logs from "./pages/Logs.tsx";
import SuperDashboard from "./pages/SuperDashboard.tsx";

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
      } else if (Array.isArray(init.headers)) {
        const hasHeaderRole = init.headers.some(([k]) => k.toLowerCase() === "x-user-role");
        if (!hasHeaderRole) {
          init.headers.push(["x-user-role", user.role]);
        }
        const hasHeaderUser = init.headers.some(([k]) => k.toLowerCase() === "x-user-username");
        if (!hasHeaderUser) {
          init.headers.push(["x-user-username", user.username]);
        }
      } else {
        (init.headers as Record<string, string>)["x-user-role"] = user.role;
        (init.headers as Record<string, string>)["x-user-username"] = user.username;
      }
    } catch (e) {
      // Ignore
    }
  }
  return originalFetch(input, init);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppLayout({ children, user, onLogout }: { children: React.ReactNode; user: any; onLogout: () => void }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === "Admin";

  // Dynamic Subdomain Resolution
  const host = window.location.hostname;
  const parts = host.split(".");
  const isSuperTenant = parts.length > 1 && parts[0].toLowerCase() === "super";

  // Navigation links - optimized and compact
  const menuItems = isSuperTenant
    ? [
        { href: "/", label: "SaaS Panel", icon: LayoutDashboard },
        { href: "/loqlar", label: "Audit Loqları", icon: Activity },
      ]
    : [
        ...(isAdmin ? [{ href: "/", label: "Panel", icon: LayoutDashboard }] : []),
        { href: "/pos", label: "POS ⚡", icon: Sparkles, isHighlight: true },
        { href: "/nisye", label: "Borclar", icon: AlertTriangle },
        { href: "/musteriler", label: "Müştərilər", icon: Users },
        { href: "/anbar", label: "Qalıqlar", icon: Boxes },
        ...(isAdmin ? [{ href: "/anbar/daxil", label: "Mədaxil", icon: PlusCircle }] : []),
        ...(isAdmin ? [{ href: "/mehsullar", label: "Kataloq", icon: FolderKanban }] : []),
        { href: "/satislar", label: "Tarixçə", icon: History },
        ...(isAdmin ? [{ href: "/xercler", label: "Xərclər", icon: TrendingDown }] : []),
        ...(isAdmin ? [{ href: "/loqlar", label: "Loqlar", icon: Activity }] : []),
        { href: "/ayarlar", label: "Ayarlar", icon: SettingsIcon },
      ];

  return (
    <div className="relative min-h-screen w-screen flex flex-col overflow-x-hidden pb-12 select-none">
      {/* Dynamic Liquid Background Blobs */}
      <div className="liquid-bg">
        <div className="liquid-blob-1"></div>
        <div className="liquid-blob-2"></div>
        <div className="liquid-blob-3"></div>
      </div>

      {/* 1. Centered Floating Liquid Glass Navbar */}
      <header className="w-[calc(100%-2rem)] sm:w-full max-w-7xl mx-auto px-4 sm:px-6 py-3.5 mt-4 sm:mt-6 rounded-2xl glass-navbar flex items-center justify-between shadow-xl sticky top-4 sm:top-6 z-50 no-print">
        {/* Brand Logo & Name */}
        <Link href={isSuperTenant ? "/" : (isAdmin ? "/" : "/pos")}>
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              Q
            </div>
            <div>
              <h1 className="font-extrabold text-gray-900 tracking-tight text-sm leading-none transition-colors group-hover:text-primary">
                {isSuperTenant ? "Qazan SaaS" : "Qazan POS"}
              </h1>
              <span className="text-[10px] font-bold text-gray-400 mt-1 block tracking-wide">
                {isSuperTenant ? "PLATFORMA PANELİ" : "ANBAR & SATIŞ"}
              </span>
            </div>
          </div>
        </Link>

        {/* Dynamic Horizontal Navigation Menu */}
        <nav className="hidden lg:flex items-center gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location === "/"
                : item.href === "/anbar"
                ? location === "/anbar"
                : location.startsWith(item.href);

            if (item.isHighlight) {
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer shadow-md transition-all hover-elevate ${
                      isActive
                        ? "bg-primary text-white shadow-primary/20 border border-primary/20"
                        : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                    isActive
                      ? "bg-gray-900/10 text-gray-900 font-extrabold"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Status Indicator & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden xs:flex items-center gap-1.5 bg-green-50/50 px-2.5 py-1.5 rounded-lg border border-green-100/50 text-[10px] font-bold text-green-700 glass">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>Lokal</span>
          </div>

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
              {/* Brand Logo */}
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg">
                  Q
                </div>
                <div>
                  <h1 className="font-extrabold text-gray-900 text-sm leading-none">Qazan POS</h1>
                  <span className="text-[10px] font-bold text-gray-400 mt-1 block">ANBAR & SATIŞ</span>
                </div>
              </div>

              {/* Menu List */}
              <nav className="flex flex-col gap-1.5 pt-4">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? location === "/"
                      : item.href === "/anbar"
                      ? location === "/anbar"
                      : location.startsWith(item.href);

                  return (
                    <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary font-extrabold"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Footer Profile & Logout */}
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs">
                  {user?.username?.substring(0, 2).toUpperCase()}
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex flex-col">
        <div className="flex-1 w-full animate-in fade-in-50 duration-300">
          {children}
        </div>
      </main>
    </div>
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
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0">
      <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-2xl max-w-md w-full relative">
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
              <span className="font-bold text-red-700 font-mono text-base">{item.totalAmount.toFixed(2)} ₼</span>
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
  
  const host = window.location.hostname;
  const parts = host.split(".");
  const isSuperTenant = parts.length > 1 && parts[0].toLowerCase() === "super";

  return (
    <AppLayout user={user} onLogout={onLogout}>
      <Switch>
        {isSuperTenant ? (
          <>
            <Route path="/" component={SuperDashboard} />
            <Route path="/loqlar" component={Logs} />
          </>
        ) : (
          <>
            {isAdmin && <Route path="/" component={Dashboard} />}
            <Route path="/pos" component={POS} />
            <Route path="/nisye" component={Debts} />
            <Route path="/musteriler" component={Customers} />
            <Route path="/anbar" component={Stock} />
            {isAdmin && <Route path="/anbar/daxil" component={StockIn} />}
            {isAdmin && <Route path="/mehsullar" component={Products} />}
            <Route path="/satislar" component={SalesHistory} />
            <Route path="/satislar/:id" component={Invoice} />
            {isAdmin && <Route path="/xercler" component={Expenses} />}
            {isAdmin && <Route path="/loqlar" component={Logs} />}
            <Route path="/ayarlar" component={SettingsPage} />
          </>
        )}
        <Route>
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="text-6xl font-extrabold text-primary">403</h1>
            <p className="text-gray-500 mt-2 font-medium">Giriş qadağandır və ya səhifə mövcud deyil.</p>
            <Link href={isSuperTenant ? "/" : (isAdmin ? "/" : "/pos")} className="mt-4 text-sm text-primary font-bold hover:underline">
              Geri qayıt
            </Link>
          </div>
        </Route>
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem("qazanpos_user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        localStorage.removeItem("qazanpos_user");
      }
    }
    setIsCheckingSession(false);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    localStorage.setItem("qazanpos_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("qazanpos_user");
    setUser(null);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-xs font-bold text-gray-400">Yüklənir...</span>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {user ? (
          <>
            <MainRoutes user={user} onLogout={handleLogout} />
            <OverdueDebtCheck />
          </>
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  );
}
