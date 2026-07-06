import React from "react";
import { ShieldAlert, X, MessageSquare, PhoneCall } from "lucide-react";

interface LimitReachedModalProps {
  limitType: "products" | "sales" | "users";
  current: number;
  max: number;
  tier: string;
  onClose: () => void;
}

export default function LimitReachedModal({
  limitType,
  current,
  max,
  tier,
  onClose
}: LimitReachedModalProps) {
  
  // Human readable translations
  const tierNames: Record<string, string> = {
    free: "Sınaq (Free Trial)",
    mini: "Mini Plan",
    pro: "Pro Plan",
    enterprise: "Enterprise"
  };

  const limitNames: Record<string, string> = {
    products: "Məhsul Kataloqu",
    sales: " POS Satış Həcmi",
    users: "Kassir/İstifadəçi"
  };

  const limitDescriptions: Record<string, string> = {
    products: "Mövcud tarif planınız üzrə əlavə edə biləcəyiniz maksimum məhsul limitinə çatdınız.",
    sales: "Mövcud abunəliyiniz üzrə aylıq icra edə biləcəyiniz maksimum satış qəbzi sayını keçdiniz.",
    users: "Mağazanıza eyni vaxtda əlavə edə biləcəyiniz maksimum işçi / kassir limitini aşdınız."
  };

  return (
    <div className="liquid-glass-overlay !z-[150]">
      {/* Glow highlight background */}
      <div className="absolute size-[400px] rounded-full bg-amber-500/10 blur-[100px] z-0 animate-pulse"></div>

      <div className="liquid-glass-card max-w-md p-8 border-t-4 border-t-amber-500 space-y-6 !z-10">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100/50 transition-all cursor-pointer"
          title="Bağla"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Pulsing Warning Badge */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 shadow-lg shadow-amber-500/10 relative">
            <ShieldAlert className="w-8 h-8 animate-bounce-subtle" />
            <span className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full"></span>
          </div>

          <div>
            <h3 className="font-black text-gray-900 text-lg tracking-tight">
              ⚠️ Limit Sərhədi Keçildi!
            </h3>
            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider block mt-2 mx-auto w-max">
              Mövcud Plan: {tierNames[tier] || tier}
            </span>
          </div>
        </div>

        {/* Metric Progression Card */}
        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-gray-600">
            <span>{limitNames[limitType]} Limiti:</span>
            <span className="font-mono text-gray-900 bg-white border border-gray-100 px-2 py-0.5 rounded-md">
              {current} / {max}
            </span>
          </div>

          {/* Glowing progress bar indicator */}
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-500" 
              style={{ width: "100%" }}
            ></div>
          </div>

          <p className="text-[11px] text-gray-400 font-semibold leading-relaxed text-center">
            {limitDescriptions[limitType]}
          </p>
        </div>

        {/* Call to action & Upgrade support */}
        <div className="space-y-3">
          <div className="bg-amber-50/30 border border-amber-100/50 rounded-2xl p-4 text-[10px] text-amber-800 font-bold text-center leading-relaxed">
            Davam etmək üçün proqramın tarifini **"Pro"** və ya **"Enterprise"** plana yüksəltməlisiniz.
          </div>

          <div className="flex gap-2.5">
            <a
              href="https://wa.me/994551234567?text=Salam,%20BirSaaS%20hesabımın%20tarif%20limitini%20yüksəltmək%20istəyirəm."
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2 text-xs transition-all hover-elevate"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Dəstək
            </a>
            <a
              href="tel:+994551234567"
              className="py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-extrabold rounded-xl cursor-pointer flex items-center justify-center transition-all"
              title="Zəng Et"
            >
              <PhoneCall className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
