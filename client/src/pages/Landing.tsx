import React from "react";
import { Sparkles, ArrowRight, Building, ShieldCheck, Zap, Check } from "lucide-react";

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

  const plans = [
    {
      name: "Sınaq Planı",
      slug: "free",
      price: "0 ₼",
      desc: "Platformanı dərhal test etmək üçün tamamilə öhdəliksiz sınaq.",
      features: [
        "Maksimum 10 Məhsul",
        "Maksimum 20 Satış Çeki",
        "1 Kassir Hesabı",
        "Daxili Barkod Generatoru",
        "Qaimə və Faktura Çapı",
      ],
      btnText: "İndi Sına 🚀",
      badge: "SINAQ",
      badgeColor: "bg-gray-100 text-gray-700",
      accentColor: "border-gray-200",
    },
    {
      name: "Mini Plan",
      slug: "mini",
      price: "15 ₼",
      period: "/ ay",
      desc: "Kiçik butiklər, geyim və şirniyyat mağazaları üçün idealdır.",
      features: [
        "Maksimum 100 Məhsul",
        "Maksimum 500 Satış Çeki",
        "3 Kassir Hesabı",
        "Sürətli POS Terminalı",
        "Fövqəladə Oflayn Satış",
        "Whatsapp Dəstək",
      ],
      btnText: "Mini ilə Başla 📦",
      badge: "MƏSLƏHƏT",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-100 border",
      accentColor: "border-blue-100",
    },
    {
      name: "Pro Plan",
      slug: "pro",
      price: "35 ₼",
      period: "/ ay",
      desc: "Böyüyən, aktiv ticarət nöqtələri və restoranlar üçün ən yaxşı seçim.",
      features: [
        "Maksimum 1,000 Məhsul",
        "Maksimum 5,000 Satış Çeki",
        "10 Kassir Hesabı",
        "Səssiz Çap (QZ Tray)",
        "Tam Anbar Maya dəyəri (COGS)",
        "Ətraflı Gəlir/Xərc Analitikası",
        "Prioritet Dəstək",
      ],
      btnText: "Pro-ya Keç 🔥",
      badge: "ƏN MƏŞHUR",
      badgeColor: "bg-purple-100 text-purple-700 font-extrabold border-purple-200 border animate-pulse",
      accentColor: "border-purple-200 ring-2 ring-purple-500/10",
      isPopular: true,
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      price: "Fərdi",
      desc: "Böyük marketlər, anbar şəbəkələri və xüsusi həllər üçün.",
      features: [
        "Limitsiz Məhsul Kataloqu",
        "Limitsiz Satış Çekləri",
        "Limitsiz Kassir Hesabları",
        "Fərdi Server İnfrastrukturu",
        "Xüsusi Menecer Dəstəyi (24/7)",
        "API və Xarici İnteqrasiyalar",
      ],
      btnText: "Bizə Yazın 📞",
      badge: "KORPORATİV",
      badgeColor: "bg-amber-100 text-amber-700 border-amber-200 border",
      accentColor: "border-amber-200",
    },
  ];

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between relative overflow-hidden select-none bg-gray-50/50">
      {/* Liquid background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] size-[50vw] bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] size-[55vw] bg-primary/10 rounded-full blur-3xl animate-pulse duration-5000"></div>
      </div>

      {/* Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 cursor-pointer">
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center z-10 space-y-12 py-12">
        <div className="space-y-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-wider uppercase px-4 py-2 rounded-full animate-pulse mx-auto">
            <Zap className="w-3.5 h-3.5" />
            <span>Müasir POS və Anbar İdarəetmə Sistemi</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
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
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
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

        {/* Tarif Planları Bölməsi */}
        <div className="w-full pt-16 space-y-10">
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Tarif Planları və Qiymətlər</h2>
            <p className="text-xs text-gray-400 font-semibold leading-relaxed">
              Biznesinizin böyüklüyünə və tələblərinizə uyğun olan optimal planı seçin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
            {plans.map((p) => (
              <div
                key={p.slug}
                className={`bg-white border rounded-3xl p-6 text-left shadow-lg glass-card flex flex-col justify-between relative overflow-hidden transition-all ${
                  p.isPopular ? "border-purple-500/30 ring-4 ring-purple-500/5 hover:scale-[1.02]" : "border-gray-100 hover:scale-[1.01]"
                }`}
              >
                {/* Popular Corner Badge */}
                {p.badge && (
                  <span className={`absolute right-4 top-4 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">{p.name}</h3>
                    <p className="text-[10px] text-gray-400 font-medium mt-1 leading-relaxed min-h-8">{p.desc}</p>
                  </div>

                  <div className="flex items-baseline gap-1 py-2">
                    <span className="text-3xl font-black text-gray-950 tracking-tight">{p.price}</span>
                    {p.period && <span className="text-xs font-bold text-gray-400">{p.period}</span>}
                  </div>

                  <div className="border-t border-gray-100 my-2"></div>

                  <ul className="space-y-2.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[10px] font-bold text-gray-500 leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <a
                    href={demoUrl}
                    className={`w-full py-3.5 rounded-xl font-black text-center block text-[10px] uppercase tracking-wider cursor-pointer transition-all shadow-sm ${
                      p.isPopular
                        ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/10"
                        : "bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/10"
                    }`}
                  >
                    {p.btnText}
                  </a>
                </div>
              </div>
            ))}
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
