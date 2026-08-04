import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, DollarSign, Calculator, X, Lock, CheckCircle2, ChevronUp, AlertCircle } from "lucide-react";
import { useToast } from "./Toast.tsx";

interface ActiveShift {
  id: number;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  status: string;
}

interface Balances {
  kassa: number;
  bank: number;
  safe: number;
  debt: number;
}

export function ShiftQuickBar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);

  // Denomination counter state for cash register audit
  const [counts, setCounts] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
  });

  // Fetch active shift
  const { data: shiftData } = useQuery<{ activeShift: ActiveShift | null }>({
    queryKey: ["/api/shifts/active"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/active");
      if (!res.ok) return { activeShift: null };
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Fetch live balances
  const { data: balances } = useQuery<Balances>({
    queryKey: ["/api/dashboard/balances"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/balances");
      if (!res.ok) return { kassa: 0, bank: 0, safe: 0, debt: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const activeShift = shiftData?.activeShift;

  // Calculate shift duration
  const [duration, setDuration] = useState("");
  useEffect(() => {
    if (!activeShift?.openedAt) return;

    const updateDuration = () => {
      const start = new Date(activeShift.openedAt).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - start);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setDuration(`${hours}s ${minutes}d`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 30000);
    return () => clearInterval(interval);
  }, [activeShift?.openedAt]);

  const totalCalculatedCash = Object.entries(counts).reduce(
    (sum, [denom, qty]) => sum + Number(denom) * (qty || 0),
    0
  );

  const kassaSystemBalance = balances?.kassa || 0;
  const difference = totalCalculatedCash - kassaSystemBalance;

  const handleCloseShift = async () => {
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualCash: totalCalculatedCash,
        }),
      });

      if (res.ok) {
        toast({
          title: "Növbə Bağlanıldı",
          description: `Kassa sayımı: ${totalCalculatedCash.toFixed(2)} ₼. Növbə tamamlandı.`,
          variant: "success",
        });
        setShowCountModal(false);
        queryClient.invalidateQueries({ queryKey: ["/api/shifts/active"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/balances"] });
      } else {
        const err = await res.json();
        toast({
          title: "Xəta",
          description: err.message || "Növbəni bağlamaq mümkün olmadı",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Xəta",
        description: "Şəbəkə xətası baş verdi",
        variant: "destructive",
      });
    }
  };

  if (!activeShift) return null;

  return (
    <>
      {/* Floating Bottom Quick Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-gray-900/90 backdrop-blur-md text-white border border-gray-700/60 shadow-2xl rounded-2xl p-2 px-4 flex items-center gap-4 text-xs font-medium">
          {/* Active Shift Indicator */}
          <div className="flex items-center gap-2 border-r border-gray-700 pr-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-gray-200 uppercase tracking-wider text-[10px]">
              Növbə Açıq
            </span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-bold">{duration}</span>
          </div>

          {/* Kassa Live Balance */}
          <div className="flex items-center gap-1.5 border-l border-gray-700 pl-3">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400 text-[11px]">Kassa:</span>
            <span className="font-black text-amber-400 font-mono text-sm">
              {kassaSystemBalance.toFixed(2)} ₼
            </span>
          </div>

          {/* Count & Close Shift Action */}
          <button
            onClick={() => setShowCountModal(true)}
            className="ml-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-xs active:scale-95"
          >
            <Calculator className="w-3.5 h-3.5" />
            Sayım & Bağla
          </button>
        </div>
      </div>

      {/* Cash Counter & Shift Close Modal */}
      {showCountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Kassa Sayımı & Növbənin Bağlanması</h3>
                  <p className="text-xs text-gray-400 font-medium">Əskinaslar üzrə sayım aparın</p>
                </div>
              </div>
              <button
                onClick={() => setShowCountModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Denomination Counter Inputs */}
            <div className="grid grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
              {[200, 100, 50, 20, 10, 5, 1].map((denom) => (
                <div
                  key={denom}
                  className="flex items-center justify-between p-2.5 bg-gray-50/70 border border-gray-100 rounded-2xl"
                >
                  <span className="font-black text-gray-800 text-xs font-mono">{denom} ₼</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-bold">x</span>
                    <input
                      type="number"
                      min="0"
                      value={counts[denom] || ""}
                      onChange={(e) =>
                        setCounts({
                          ...counts,
                          [denom]: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      placeholder="0"
                      className="w-14 px-2 py-1 bg-white border border-gray-200 rounded-xl text-xs font-bold text-right font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Reconciliation Comparison Card */}
            <div className="p-4 bg-gray-900 text-white rounded-2xl space-y-2">
              <div className="flex justify-between text-xs font-medium text-gray-300">
                <span>Sayılmış Nağd:</span>
                <span className="font-mono font-bold text-emerald-400">{totalCalculatedCash.toFixed(2)} ₼</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-gray-300">
                <span>Sistem Kassa Balansı:</span>
                <span className="font-mono font-bold text-amber-400">{kassaSystemBalance.toFixed(2)} ₼</span>
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-200">Fərq (Əskik / Artıq):</span>
                <span
                  className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg ${
                    difference === 0
                      ? "bg-emerald-950 text-emerald-400"
                      : difference > 0
                      ? "bg-blue-950 text-blue-400"
                      : "bg-rose-950 text-rose-400"
                  }`}
                >
                  {difference > 0 ? `+${difference.toFixed(2)}` : difference.toFixed(2)} ₼
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setShowCountModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Ləğv Et
              </button>
              <button
                onClick={handleCloseShift}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                Növbəni Bağla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
