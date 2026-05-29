import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ArrowRight, 
  Building, 
  ShieldCheck, 
  Zap, 
  Check, 
  Lock, 
  Smartphone, 
  KeyRound, 
  Monitor, 
  Laptop, 
  TrendingDown, 
  Boxes, 
  AlertTriangle,
  MessageCircle
} from "lucide-react";

export default function Landing() {
  const [activeScreenshot, setActiveScreenshot] = useState<"dashboard" | "debts" | "expenses">("dashboard");
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  const screens: Array<"dashboard" | "debts" | "expenses"> = ["dashboard", "debts", "expenses"];
  const activeIndex = screens.indexOf(activeScreenshot);

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

  // Automatic slideshow timer
  useEffect(() => {
    if (!isAutoPlay) return;
    const interval = setInterval(() => {
      setActiveScreenshot((prev) => {
        const currentIndex = screens.indexOf(prev);
        const nextIndex = (currentIndex + 1) % screens.length;
        return screens[nextIndex];
      });
    }, 4000); // rotates every 4 seconds
    return () => clearInterval(interval);
  }, [isAutoPlay]);

  const screenshotPaths = {
    dashboard: "/assets/dashboard.png",
    debts: "/assets/debts.png",
    expenses: "/assets/expenses.png"
  };

  const screenshotsInfo = {
    dashboard: {
      title: "Premium İnteraktiv Maliyyə Analitikası",
      desc: "Satış gəlirlərini, maya dəyərini (COGS), ümumi mənfəəti və xərcləri real vaxtda vizual qrafiklərlə izləyin."
    },
    debts: {
      title: "Müştəri Borcları və Nisyə İdarəetməsi",
      desc: "Vaxtı keçmiş və aktiv borcları avtomatik siyahıya alın, müddət bitdikdə sistem səviyyəsində xəbərdarlıqlar qəbul edin."
    },
    expenses: {
      title: "Əməliyyat Xərclərinin İzlənməsi",
      desc: "İcarə, maaş, kommunal və digər inzibati xərcləri kateqoriyalar üzrə sistemə daxil edərək xalis mənfəəti tam hesablayın."
    }
  };

  const plans = [
    {
      name: "Sınaq Planı",
      slug: "free",
      price: "0 ₼",
      desc: "Platformanı dərhal test etmək üçün tamamilə öhdəliksiz sınaq sessiyası.",
      features: [
        "Maksimum 10 Məhsul",
        "Maksimum 20 Satış Çeki",
        "1 Kassir Hesabı",
        "Daxili Barkod Generatoru",
        "Qaimə və Faktura Çapı",
      ],
      btnText: "İndi Sına 🚀",
      btnUrl: demoUrl,
      badge: "ÖDƏNİŞSİZ",
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
        "WhatsApp Dəstək",
      ],
      btnText: "WhatsApp-la Aktivləşdir 💬",
      btnUrl: "https://wa.me/14162680101?text=Salam,%20BirSaaS%20Mini%20plan%C4%B1n%C4%B1%20aktivl%C9%99%C5%9Fdirilm%C9%99sini%20ist%C9%99yir%C9%99m.",
      badge: "YENİ BAŞLAYAN",
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
        "İki-Mərhələli Təhlükəsizlik (2FA)",
        "Səssiz Çap (QZ Tray)",
        "Tam Anbar Maya dəyəri (COGS)",
        "Gəlir/Xərc Analitikası",
        "Prioritet Dəstək",
      ],
      btnText: "WhatsApp-la Aktivləşdir ⚡",
      btnUrl: "https://wa.me/14162680101?text=Salam,%20BirSaaS%20Pro%20plan%C4%B1n%C4%B1%20aktivl%C9%99%C5%9Fdirilm%C9%99sini%20ist%C9%99yir%C9%99m.",
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
      btnUrl: "https://wa.me/14162680101?text=Salam,%20BirSaaS%20Enterprise%20plan%C4%B1%20il%C9%99%20maraqlan%C4%B1ram.",
      badge: "KORPORATİV",
      badgeColor: "bg-amber-100 text-amber-700 border-amber-200 border",
      accentColor: "border-amber-200",
    },
  ];

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between relative overflow-x-hidden select-none bg-gray-50/70">
      
      {/* Premium custom animations styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      {/* Dynamic Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] size-[50vw] bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-[30%] right-[-10%] size-[40vw] bg-primary/5 rounded-full blur-3xl animate-pulse duration-5000"></div>
        <div className="absolute bottom-[-10%] left-[-5%] size-[45vw] bg-blue-500/5 rounded-full blur-3xl animate-pulse duration-4000"></div>
      </div>

      {/* 1. Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/25 border border-white/20">
            B
          </div>
          <div>
            <span className="font-extrabold text-gray-900 tracking-tight text-base block leading-none">BirSaaS</span>
            <span className="text-[9px] font-bold text-gray-400 mt-1.5 block tracking-wider uppercase">Çox-Biznesli Bulud POS Terminalı</span>
          </div>
        </div>

        {/* Header Right menu with Quick Access & Sinaq CTA */}
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Quick access links (visible on larger screens) */}
          <nav className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-wider text-gray-500">
            <a href="#ozellikler" className="hover:text-primary transition-colors cursor-pointer">
              Özəlliklər
            </a>
            <a href="#tehlukesizlik" className="hover:text-primary transition-colors cursor-pointer">
              Təhlükəsizlik
            </a>
            <a href="#tarifler" className="hover:text-primary transition-colors cursor-pointer">
              Tariflər
            </a>
          </nav>

          <a
            href={demoUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-xs"
          >
            <span>Sınaq Sessiyası 🚀</span>
          </a>
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center z-10 py-12 space-y-16">
        
        {/* Main Pitch */}
        <div className="text-center space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-wider uppercase px-4 py-2 rounded-full mx-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Müasir Ticarət & Anbar İdarəetmə Platforması</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            Mağazanız üçün <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">Vahid Bulud Nəzarəti</span>
          </h1>

          <p className="text-sm sm:text-base text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Satışlarınızı real vaxt rejimində izləyin, anbar qalıqlarına nəzarət edin və maliyyənizi 100% dəqiq idarə edin. Həm onlayn, həm də internet kəsildikdə tam işləkdir!
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={demoUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4.5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 cursor-pointer hover:bg-primary/95 transition-all hover-elevate text-sm tracking-wide uppercase"
            >
              <span>Sınaq Turuna Başla 🚀</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            
            <a
              href="https://wa.me/14162680101?text=Salam,%20BirSaaS%20sistemi%20il%C9%99%20maraqlan%C4%B1ram."
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 bg-white border border-gray-200 text-gray-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/20 rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>Canlı Məsləhət</span>
            </a>
          </div>
        </div>

        {/* 3. Realistic Floating CSS Laptop Showcase */}
        <div className="w-full max-w-4xl space-y-8 pt-4 mx-auto">
          
          {/* Realistic CSS Laptop Mockup (Floats and slides automatically!) */}
          <div className="relative mx-auto max-w-[760px] w-full animate-float animate-in fade-in zoom-in-95 duration-700">
            {/* SCREEN LID */}
            <div className="relative mx-auto w-[90%] bg-zinc-950 p-[10px] pb-[18px] rounded-t-3xl border border-zinc-800 shadow-2xl">
              {/* Webcam with subtle reflection lens & green active indicator LED */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                <div className="size-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <div className="size-0.5 rounded-full bg-indigo-950"></div>
                </div>
                <div className="size-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] opacity-95"></div>
              </div>

              {/* High-Resolution Screen display wrapper with 16:10 aspect ratio */}
              <div className="aspect-[16/10] w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-900/80 relative shadow-inner">
                {/* Smooth horizontal translation transition track */}
                <div 
                  className="w-full h-full flex transition-transform duration-700 ease-in-out" 
                  style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                  {screens.map((screenKey) => (
                    <div key={screenKey} className="w-full h-full shrink-0 relative">
                      <img
                        src={screenshotPaths[screenKey]}
                        alt={screenshotsInfo[screenKey].title}
                        className="w-full h-full object-cover select-none"
                      />
                      {/* Glossy screen glass gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-white/4 pointer-events-none"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Elegant branding in bottom center of display bezel */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-zinc-600 uppercase tracking-widest pointer-events-none opacity-30 select-none">
                BirSaaS POS
              </div>
            </div>

            {/* SCREEN HINGE */}
            <div className="relative mx-auto w-[76%] h-[7px] bg-zinc-900 rounded-b-md shadow-md z-10"></div>

            {/* LAPTOP BODY BASE */}
            <div className="relative mx-auto w-full h-[16px] bg-gradient-to-b from-[#e5e7eb] via-[#d1d5db] to-[#9ca3af] rounded-b-2xl shadow-xl border-t border-white/60 z-20">
              {/* Keyboard alignment visual separator */}
              <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-[85%] h-[2px] bg-[#1e2022]/10 rounded-full"></div>

              {/* Thumb open screen notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-[4px] bg-[#9ca3af] rounded-b-md shadow-inner"></div>

              {/* Trackpad cutout layout */}
              <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-[22%] h-[7px] border-x border-b border-[#9ca3af]/40 rounded-b-[2px] bg-gradient-to-b from-[#d1d5db]/20 to-[#9ca3af]/5"></div>
            </div>

            {/* 3D BASE FRONT LIP REFLECTION */}
            <div className="relative mx-auto w-[98%] h-[3px] bg-gradient-to-b from-[#a1a1aa]/60 to-[#4b5563]/40 rounded-b-full opacity-60 z-10"></div>

            {/* LAPTOP BASE SHADOW PROJECTION */}
            <div className="w-[96%] h-8 bg-black/15 blur-xl rounded-full mx-auto -mt-3"></div>
          </div>

          {/* Dynamic Screenshot description */}
          <div className="text-center max-w-xl mx-auto space-y-1.5 bg-white/40 p-4 rounded-2xl border border-white/60 glass-card">
            <h3 className="text-xs font-black text-gray-900 tracking-tight">
              {screenshotsInfo[activeScreenshot].title}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold leading-normal">
              {screenshotsInfo[activeScreenshot].desc}
            </p>
          </div>
        </div>

        {/* 4. Two-Factor Authentication (2FA) Feature Block */}
        <div id="tehlukesizlik" className="w-full max-w-4xl bg-white border border-gray-100 rounded-3xl p-8 shadow-xl glass-card grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          
          {/* Security Features List */}
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black tracking-wider uppercase px-3 py-1.5 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>İki-Mərhələli Təhlükəsizlik (2FA)</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-snug">
                Google Authenticator ilə <br />
                Maksimum Kassir Müdafiəsi 🔐
              </h2>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                Ticarət və maliyyə məlumatlarınızın kənar şəxslər tərəfindən ələ keçirilməsini tamamilə əngəlləyin. Google Authenticator və ya digər TOTP tətbiqləri ilə kassanızı zirehləyin.
              </p>
            </div>

            {/* Feature specs checklist */}
            <div className="space-y-3 pt-2 text-xs font-bold text-gray-600">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Sıfır Dependencies: Kənar NPM paketlərindən azad, tamamilə təhlükəsiz Node.js mühərriki.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Ağıllı Cihaz Tanıma: Güvənli cihazlarda "30 gün yadda saxla" ilə şifrəsiz, birbaşa və sürətli keçid.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>IP & Token İkili Doğrulama: Həm fərdi cihaz tokeni, həm də dynamic IP yoxlanış qorunması.</span>
              </div>
            </div>
          </div>

          {/* Visual Device Trust Showcase mockup */}
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100/50 flex flex-col justify-between space-y-6 relative overflow-hidden shadow-inner">
            {/* Visual simulation of phone code generation */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="size-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Google Authenticator</span>
                <span className="text-lg font-black text-gray-900 tracking-widest font-mono block mt-0.5">842 590</span>
              </div>
              <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>

            {/* Visual simulation of 30-days trust dialog */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3.5 text-left text-xs font-bold">
              <div className="flex items-center gap-2 text-emerald-600">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-extrabold uppercase">Cihaz Doğrulandı</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Bu cihaz növbəti 30 gün ərzində etibarlı hesab olunacaq.</p>
              
              <div className="flex items-center gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] text-emerald-800">IP: 192.168.1.100 (Baku, AZ)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Core Platform Features List */}
        <div id="ozellikler" className="w-full space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Əsas İnfrastruktur Üstünlükləri</h2>
            <p className="text-xs text-gray-400 font-semibold leading-relaxed">
              Müasir sahibkarların bütün anbar və POS ehtiyaclarını tək bir platformada həll edirik.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
            <div className="bg-white/40 border border-white/60 rounded-2xl p-6 text-left glass-card space-y-3 hover:-translate-y-1 transition-all duration-300">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Boxes className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-black text-gray-900 tracking-tight">Qalıq və Anbar Nəzarəti</h3>
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Hər bir malın anbar qalığı, kritik hədd xəbərdarlığı və son mədaxil wholesale qiymətlərinin mütəmadi izlənməsi.</p>
            </div>

            <div className="bg-white/40 border border-white/60 rounded-2xl p-6 text-left glass-card space-y-3 hover:-translate-y-1 transition-all duration-300">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-black text-gray-900 tracking-tight">Fövqəladə Oflayn Rejim</h3>
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">İnternet kəsildikdə belə kassanı dayandırmayın! Oflyanda satıb-qaytarın, sistem arxa fonda bazanı avtomatik sinxron etsin.</p>
            </div>

            <div className="bg-white/40 border border-white/60 rounded-2xl p-6 text-left glass-card space-y-3 hover:-translate-y-1 transition-all duration-300">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-black text-gray-900 tracking-tight">Borcların Avtomatlaşdırılması</h3>
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Müştərilərin və tədarükçülərin nisyə dövriyyəsini, ödəniş cədvəllərini və vaxtı keçmiş borcların anlıq bildirişini idarə edin.</p>
            </div>

            <div className="bg-white/40 border border-white/60 rounded-2xl p-6 text-left glass-card space-y-3 hover:-translate-y-1 transition-all duration-300">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <TrendingDown className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-black text-gray-900 tracking-tight">COGS Maya Dəyəri Auditi</h3>
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Satılan malların maya dəyərini (COGS) real vaxtda hesablayaraq biznesinizin xalis gəlir marjasını (%) və mənfəətini anında öyrənin.</p>
            </div>
          </div>
        </div>

        {/* 6. Pricing & Subscription Plans */}
        <div id="tarifler" className="w-full pt-8 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Tarif Planları və Limitsiz Müdafiə</h2>
            <p className="text-xs text-gray-400 font-semibold leading-relaxed">
              İstənilən tarif planı ilə başlayın. Pro planımız daxilində **İki-Mərhələli Autentikasiya (2FA)** tamamilə ödənişsiz təqdim olunur!
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
                  {p.slug === "free" ? (
                    <a
                      href={p.btnUrl}
                      className="w-full py-3.5 rounded-xl font-black text-center block text-[10px] uppercase tracking-wider cursor-pointer bg-gray-950 hover:bg-gray-800 text-white shadow-md shadow-gray-950/10 transition-all"
                    >
                      {p.btnText}
                    </a>
                  ) : (
                    <a
                      href={p.btnUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-full py-3.5 rounded-xl font-black text-center block text-[10px] uppercase tracking-wider cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5 ${
                        p.isPopular
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/10"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                      }`}
                    >
                      <span>{p.btnText}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Conversion Footer / Call to Action */}
        <div className="w-full max-w-4xl bg-gradient-to-r from-primary to-emerald-600 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl space-y-6 relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 left-0 size-full bg-white/5 pointer-events-none"></div>
          
          <div className="space-y-3 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Biznesinizi Bu Gün Avtomatlaşdırın! ⚡
            </h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl mx-auto font-medium">
              Saniyələr içində qoşulun, 2-Mərhələli təhlükəsizlik ilə kassalarınızı qoruyun və bulud sisteminin rahatlığından həzz alın.
            </p>
          </div>

          <div className="pt-2 relative z-10">
            <a
              href="https://wa.me/14162680101?text=Salam,%20BirSaaS%20abun%C9%99liyimi%20aktivl%C9%99%C5%9Fdirm%C9%99k%20ist%C9%99yir%C9%99m."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-5 bg-white text-primary hover:text-emerald-700 font-black rounded-2xl shadow-2xl cursor-pointer transition-all hover-elevate text-xs sm:text-sm uppercase tracking-wider"
            >
              <MessageCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>WhatsApp ilə Abunəliyi Başlat</span>
            </a>
          </div>
        </div>
      </main>

      {/* 8. Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between text-[9px] font-bold text-gray-400 tracking-wider z-10">
        <div className="flex items-center gap-1.5">
          <span className="size-4.5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-black text-[8px]">B</span>
          <span>BirSaaS Platformu © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <span>Versiya: <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-md font-extrabold">1.0 RC</span></span>
          <span className="text-gray-300">|</span>
          <span className="uppercase font-extrabold text-gray-500">Bulud POS & Anbar İnteqrasiyası</span>
        </div>
      </footer>
    </div>
  );
}
