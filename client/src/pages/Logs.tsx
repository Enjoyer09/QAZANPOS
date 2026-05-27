import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Calendar as CalendarIcon,
  RefreshCw,
  User,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle,
  TrendingDown,
  Settings,
  HelpCircle,
  Archive,
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface ActivityLog {
  id: number;
  username: string;
  action: string;
  description: string;
  timestamp: string;
  archived: number;
}

const actionIcons: Record<string, any> = {
  CREATE_PRODUCT: PlusCircle,
  UPDATE_PRODUCT: Edit,
  DELETE_PRODUCT: Trash2,
  CREATE_STOCK_ENTRY: PlusCircle,
  PAY_SUPPLIER_DEBT: CheckCircle,
  CREATE_CUSTOMER: PlusCircle,
  UPDATE_CUSTOMER: Edit,
  DELETE_CUSTOMER: Trash2,
  CREATE_SALE: CheckCircle,
  PAY_CUSTOMER_CREDIT: CheckCircle,
  ADD_CUSTOMER_PAYMENT: CheckCircle,
  CREATE_EXPENSE: TrendingDown,
  DELETE_EXPENSE: Trash2,
  UPDATE_SETTINGS: Settings,
};

const actionBadges: Record<string, string> = {
  CREATE_PRODUCT: "bg-green-50 text-green-700 border-green-100",
  UPDATE_PRODUCT: "bg-blue-50 text-blue-700 border-blue-100",
  DELETE_PRODUCT: "bg-red-50 text-red-700 border-red-100",
  CREATE_STOCK_ENTRY: "bg-teal-50 text-teal-700 border-teal-100",
  PAY_SUPPLIER_DEBT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  CREATE_CUSTOMER: "bg-indigo-50 text-indigo-700 border-indigo-100",
  UPDATE_CUSTOMER: "bg-sky-50 text-sky-700 border-sky-100",
  DELETE_CUSTOMER: "bg-rose-50 text-rose-700 border-rose-100",
  CREATE_SALE: "bg-green-50 text-green-700 border-green-100",
  PAY_CUSTOMER_CREDIT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ADD_CUSTOMER_PAYMENT: "bg-teal-50 text-teal-700 border-teal-100",
  CREATE_EXPENSE: "bg-amber-50 text-amber-700 border-amber-100",
  DELETE_EXPENSE: "bg-rose-50 text-rose-700 border-rose-100",
  UPDATE_SETTINGS: "bg-gray-50 text-gray-700 border-gray-100",
};

export default function Logs() {
  const { toast } = useToast();
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { data: logs, isLoading, refetch, isFetching } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?date=${selectedDate}`);
      if (!res.ok) throw new Error("Loqları gətirmək mümkün olmadı");
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Yeniləndi",
      description: `${selectedDate} tarixinə aid fəaliyyət loqları yeniləndi.`,
      variant: "success",
    });
  };

  // Metrics calculations
  const totalLogs = logs?.length || 0;
  const salesCount = logs?.filter((l) => l.action.includes("SALE")).length || 0;
  const catalogCount = logs?.filter((l) => l.action.includes("PRODUCT")).length || 0;
  const paymentCount = logs?.filter((l) => l.action.includes("PAY") || l.action.includes("PAYMENT")).length || 0;
  const expenseCount = logs?.filter((l) => l.action.includes("EXPENSE")).length || 0;

  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Fəaliyyət Loqları</h2>
          <p className="text-xs text-gray-400 mt-1">
            Sistem daxilində anbaan kimin nə etdiyini (yaradılma, silinmə, ödənişlər) izləyin
          </p>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-xs glass">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold focus:outline-none bg-transparent cursor-pointer text-gray-700"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-500 rounded-xl cursor-pointer shadow-xs transition-all flex items-center justify-center disabled:opacity-50"
            title="Loqları Yenilə"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Daily Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ümumi Əməliyyat</span>
          <span className="text-xl font-black text-gray-900 font-mono mt-1 block">
            {isLoading ? "..." : totalLogs}
          </span>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Satışlar</span>
          <span className="text-xl font-black text-green-600 font-mono mt-1 block">
            {isLoading ? "..." : salesCount}
          </span>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Borc Ödənişləri</span>
          <span className="text-xl font-black text-teal-600 font-mono mt-1 block">
            {isLoading ? "..." : paymentCount}
          </span>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kataloq & Stok</span>
          <span className="text-xl font-black text-blue-600 font-mono mt-1 block">
            {isLoading ? "..." : catalogCount}
          </span>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-2xl col-span-2 md:col-span-1 shadow-xs glass-card">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Digər Xərclər</span>
          <span className="text-xl font-black text-amber-600 font-mono mt-1 block">
            {isLoading ? "..." : expenseCount}
          </span>
        </div>
      </div>

      {/* Logs Timeline Container */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs glass-card space-y-6">
        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
          <h3 className="font-extrabold text-gray-900 text-sm">
            {isToday ? "Bugünkü Əməliyyat Loqları" : `${selectedDate} tarixinə aid loqlar`}
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-gray-50 border border-gray-100 text-gray-500 rounded-lg">
            {isToday ? (
              <span className="flex items-center gap-1 text-green-600 font-extrabold">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Aktiv İzləmə (Canlı)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 font-extrabold">
                <Archive className="w-3 h-3 text-amber-600" />
                Arxiv Tarixçə
              </span>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-20 text-center text-xs text-gray-400 font-bold animate-pulse">
            Loqlar yüklənir, gözləyin...
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-400 font-bold space-y-2">
            <p>Bu tarixdə heç bir fəaliyyət qeydə alınmayıb.</p>
            <p className="text-[10px] font-medium text-gray-300">
              Sistemdə hər hansı bir məhsul, mədaxil, satış və ya xərc əməliyyatı etdikdə loqlar burada görünəcək.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-gray-100 ml-4 md:ml-6 pl-6 space-y-6 py-2">
            {logs.map((log) => {
              const Icon = actionIcons[log.action] || HelpCircle;
              const badgeClass = actionBadges[log.action] || "bg-gray-50 text-gray-500 border-gray-100";
              const time = new Date(log.timestamp).toLocaleTimeString("az-AZ", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div key={log.id} className="relative group animate-in slide-in-from-left-2 duration-300">
                  {/* Timeline Bullet Icon */}
                  <div className="absolute -left-[35px] top-1 bg-white p-1 rounded-full border border-gray-100 shadow-xs z-10 transition-transform group-hover:scale-110">
                    <div className={`size-6 rounded-lg flex items-center justify-center ${badgeClass} border`}>
                      <Icon className="w-3 h-3 shrink-0" />
                    </div>
                  </div>

                  {/* Log Card */}
                  <div className="p-4 rounded-2xl bg-gray-50/30 hover:bg-gray-50/70 border border-gray-100/50 hover:border-gray-200/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                    <div className="space-y-1.5">
                      {/* Description */}
                      <p className="text-gray-900 leading-normal font-medium">{log.description}</p>
                      
                      {/* Log details */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1 bg-white/70 border border-gray-100 rounded-md px-1.5 py-0.5 font-bold text-gray-600">
                          <User className="w-2.5 h-2.5 text-gray-400" />
                          {log.username}
                        </span>
                        <span>•</span>
                        <span className="font-bold">{log.action}</span>
                        {log.archived === 1 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-500 font-bold uppercase tracking-wider text-[8px] bg-amber-50 border border-amber-100 px-1 rounded-md">
                              Arxiv
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Log Time */}
                    <div className="text-right shrink-0">
                      <span className="font-black text-gray-950 font-mono bg-white/80 border border-gray-100 px-2.5 py-1 rounded-lg shadow-2xs">
                        {time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
