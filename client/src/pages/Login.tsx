import React, { useState } from "react";
import { User, Lock, Sparkles, KeyRound, CheckCircle, ArrowRight, TrendingUp, Boxes, WifiOff } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface LoginProps {
  onLoginSuccess: (user: { id: number; username: string; role: string }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Subdomain detection for dedicated public sandbox demo
  const host = window.location.hostname;
  const parts = host.split(".");
  const isSinaqSubdomain = parts.length > 0 && (
    parts[0].toLowerCase() === "sinaq" || 
    parts[0].toLowerCase() === "demo"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({
        title: "Xəta!",
        description: "İstifadəçi adı və şifrə daxil edilməlidir.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Giriş alınmadı");
      }

      const userData = await res.json();
      toast({
        title: "Xoş gəldiniz!",
        description: `${userData.role === "Admin" ? "Administrator" : "Satıcı"} olaraq giriş edildi.`,
        variant: "success",
      });
      onLoginSuccess(userData);
    } catch (err: any) {
      toast({
        title: "Giriş uğursuz oldu!",
        description: err.message || "İstifadəçi adı və ya şifrə yanlışdır.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterDemo = () => {
    sessionStorage.setItem("birsaas_demo_active", "true");
    const mockUser = { id: 9999, username: "demo_admin", role: "Admin" };
    sessionStorage.setItem("qazanpos_user", JSON.stringify(mockUser));
    
    toast({
      title: "Demo Sessiyası Başladı! 🚀",
      description: "İzolyasiya olunmuş müvəqqəti sınaq mühitinə daxil olursunuz. Uğurlar!",
      variant: "success",
    });

    onLoginSuccess(mockUser);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center relative overflow-hidden select-none pb-12">
      {/* Liquid background blobs specifically for login screen context */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 size-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 size-[450px] bg-emerald-500/15 rounded-full blur-3xl animate-pulse duration-5000"></div>
      </div>

      <div className="w-full max-w-md px-6 z-10">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center gap-3.5 mb-8 text-center">
          <div className="size-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-primary/25 border border-white/20">
            B
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 tracking-tight text-2xl leading-none">
              BirSaaS
            </h1>
            <span className="text-xs font-bold text-gray-400 mt-2 block tracking-wider uppercase">
              Ticarət & Anbar İdarəetmə Sistemi
            </span>
          </div>
        </div>

        {/* Dynamic Layout Scoping */}
        {isSinaqSubdomain ? (
          /* Gorgeous Public Welcoming Sandbox Card */
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl glass-card relative overflow-hidden space-y-6 animate-in fade-in duration-300">
            <div className="absolute top-0 right-0 p-4 text-emerald-500/10">
              <Sparkles className="size-16 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
                Sınaq Dünyasına Xoş Gəlmisiniz! 🚀
              </h2>
              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                Qeydiyyatdan keçmədən bulud əsaslı POS və Anbar sistemimizi real vaxt rejimində sınaqdan keçirin.
              </p>
            </div>

            {/* Feature List Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100/30">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800">Sürətli POS Satış</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Barkod və ya sürətli axtarışla anında qəbz çapı.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100/30">
                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800">Maliyyə & KPI Audit</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Net gəlir, COGS və xalis mənfəətin 100% dəqiq izlənməsi.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100/30">
                <Boxes className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800">Geri Qaytarış & Deffekt</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Zədəli malların silinməsi və anbar qalığının bərpası.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100/30">
                <WifiOff className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800">Fövqəladə Oflayn Rejim</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">İnternet kəsildikdə belə tam işlək kassa və fon sinxronizasiyası.</p>
                </div>
              </div>
            </div>

            {/* Launch Demo Sandbox */}
            <button
              onClick={handleEnterDemo}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2.5 text-sm transition-all hover-elevate animate-bounce-subtle mt-4"
            >
              <span>Sınaq Turuna Başla</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Normal Secure Storefront Login Card (No Demo Buttons) */
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl glass-card relative overflow-hidden animate-in fade-in duration-300">
            <div className="absolute top-0 right-0 p-4 text-primary/10">
              <KeyRound className="size-12" />
            </div>

            <h2 className="text-lg font-black text-gray-900 tracking-tight mb-6">
              Sistemə Giriş
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs font-semibold">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
                  İstifadəçi adı
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400">
                    <User className="size-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Məs. admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-gray-950 font-bold"
                    disabled={isLoading}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">
                  Şifrə
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400">
                    <Lock className="size-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-gray-950 font-bold font-mono"
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md shadow-primary/10 transition-all hover-elevate mt-4"
              >
                {isLoading ? (
                  "Yoxlanılır..."
                ) : (
                  <>
                    <Sparkles className="size-4" /> Giriş Et
                  </>
                )}
              </button>
            </form>

            {/* Quick instructions / Help */}
            <div className="mt-6 pt-5 border-t border-gray-50 text-[10px] text-gray-400 text-center font-medium leading-relaxed">
              <p>Admin hesabı: <strong className="text-gray-600">admin</strong> / şifrə: <strong className="text-gray-600 font-mono">admin123</strong></p>
              <p className="mt-1">Satıcı hesabı: <strong className="text-gray-600">satici</strong> / şifrə: <strong className="text-gray-600 font-mono">satici123</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
