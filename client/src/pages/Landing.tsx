import React from "react";
import { Sparkles, ArrowRight, Building, ShieldCheck, Zap } from "lucide-react";

export default function Landing() {
  // Construct dynamic sandbox redirect link based on current environment
  const currentHost = window.location.host;
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
    <div className="min-h-screen w-screen flex flex-col justify-between relative overflow-hidden select-none bg-gray-50/50">
      {/* Liquid background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] size-[50vw] bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] size-[55vw] bg-primary/10 rounded-full blur-3xl animate-pulse duration-5000"></div>
      </div>

      {/* Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/25 border border-white/20">
            B
          </div>
          <div>
            <span className="font-extrabold text-gray-900 tracking-tight text-base block leading-none">BirSaaS</span>
            <span className="text-[9px] font-bold text-gray-400 mt-1 block tracking-wider uppercase">Bulud Ticarət Platforması</span>
          </div>
        </div>
      </header>

      {/* Hero Content Section */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 flex flex-col items-center justify-center text-center z-10 space-y-8 py-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-wider uppercase px-4 py-2 rounded-full animate-pulse">
          <Zap className="w-3.5 h-3.5" />
          <span>Müasir POS və Anbar İdarəetmə Sistemi</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight sm:leading-none">
            Mağazanız üçün <span className="text-primary bg-primary/5 px-3 py-1 rounded-2xl border border-primary/10">Vahid Nəzarət</span> Paneli
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Satışlarınızı real vaxt rejimində izləyin, anbar qalıqlarına nəzarət edin və maliyyənizi 100% dəqiq idarə edin.
          </p>
        </div>

        {/* Dynamic CTA Sandbox Button */}
        <div className="pt-4">
          <a
            href={demoUrl}
            className="inline-flex items-center gap-2.5 px-8 py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 cursor-pointer hover:bg-primary/95 transition-all hover-elevate animate-bounce-subtle text-base"
          >
            <span>Demoya Keç 🚀</span>
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 w-full max-w-3xl">
          <div className="bg-white/40 border border-white/60 rounded-2xl p-5 text-left glass-card space-y-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black text-gray-900 tracking-tight">Sürətli POS Terminalı</h3>
            <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Bulud və Fövqəladə Oflayn dəstəkli, barkodlu anında satış pəncərəsi.</p>
          </div>

          <div className="bg-white/40 border border-white/60 rounded-2xl p-5 text-left glass-card space-y-2">
            <Building className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black text-gray-900 tracking-tight">Avtomatlaşdırılmış Anbar</h3>
            <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Normal və defective qaytarışların, maya dəyərinin avtomatik audit sistemi.</p>
          </div>

          <div className="bg-white/40 border border-white/60 rounded-2xl p-5 text-left glass-card space-y-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black text-gray-900 tracking-tight">Çox-Biznesli SaaS</h3>
            <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Dynamic subdomenlər və təcrid olunmuş mağaza yaddaş strukturu.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between text-[9px] font-bold text-gray-400 tracking-wider z-10">
        <div className="flex items-center gap-1.5">
          <span>BirSaaS © {new Date().getFullYear()}</span>
        </div>
        <div>
          <span>Versiya: <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-md font-extrabold">1.0 RC</span></span>
        </div>
      </footer>
    </div>
  );
}
