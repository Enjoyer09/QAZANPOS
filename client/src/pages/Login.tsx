import React, { useState } from "react";
import { User, Lock, Sparkles, KeyRound } from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface LoginProps {
  onLoginSuccess: (user: { id: number; username: string; role: string }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      title: "Sınaq Rejimi Aktivdir! 🚀",
      description: "İzolyasiya olunmuş müvəqqəti Demo mühitinə daxil olursunuz. Xoş sınaqlar!",
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

        {/* Login Glass Card */}
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl glass-card relative overflow-hidden">
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

          {/* Epic Neon Demo Sandbox Entry Button */}
          <div className="mt-4 pt-4 border-t border-gray-100/50">
            <button
              type="button"
              onClick={handleEnterDemo}
              className="w-full py-4 bg-white hover:bg-emerald-50/20 text-emerald-600 font-extrabold rounded-xl border-2 border-dashed border-emerald-400 hover:border-emerald-500 shadow-md shadow-emerald-500/5 flex items-center justify-center gap-2.5 text-sm cursor-pointer transition-all hover-elevate"
            >
              <Sparkles className="size-4 text-emerald-500 animate-pulse" />
              Sınaq Rejimi (Demo) 🔄
            </button>
          </div>

          {/* Quick instructions / Help */}
          <div className="mt-6 pt-5 border-t border-gray-50 text-[10px] text-gray-400 text-center font-medium leading-relaxed">
            <p>Admin hesabı: <strong className="text-gray-600">admin</strong> / şifrə: <strong className="text-gray-600 font-mono">admin123</strong></p>
            <p className="mt-1">Satıcı hesabı: <strong className="text-gray-600">satici</strong> / şifrə: <strong className="text-gray-600 font-mono">satici123</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
