import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Boxes,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Search,
  Sparkles,
  Check,
  Activity,
  Calendar,
  PieChart,
} from "lucide-react";

interface SummaryData {
  todayRevenue: number;
  todayCost: number;
  todayProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  todaySales: number;
  monthRevenue: number;
  monthProfit: number;
  monthExpenses: number;
  monthNetProfit: number;
  totalStockValue: number;
  lowStockCount: number;
  totalCreditDebt: number;
  overdueCreditsCount: number;
  myTotalDebt: number;
}

// ----------------------------------------------------
// PURE SVG INTERACTIVE CHARTS
// ----------------------------------------------------

function MonthlyTrendChart({ data }: { data: any[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-400 py-12 text-center">Trend məlumatı tapılmadı</div>;
  }

  const maxVal = Math.max(...data.map(t => Math.max(t.revenue, t.expenses))) * 1.15 || 1000;
  const width = 500;
  const height = 200;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const xStep = chartWidth / (data.length - 1 || 1);

  const revPoints = data.map((t, i) => ({
    x: paddingLeft + i * xStep,
    y: height - paddingBottom - (t.revenue / maxVal) * chartHeight,
    revenue: t.revenue,
    expenses: t.expenses,
    profit: t.profit,
    month: t.month
  }));

  const expPoints = data.map((t, i) => ({
    x: paddingLeft + i * xStep,
    y: height - paddingBottom - (t.expenses / maxVal) * chartHeight
  }));

  const createPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
  };

  const createAreaPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    const linePath = createPath(points);
    return `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto font-mono text-[9px] text-gray-400 select-none overflow-visible">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = height - paddingBottom - p * chartHeight;
          const val = (p * maxVal).toFixed(0);
          return (
            <g key={i} className="opacity-40">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
              <text x={10} y={y + 3} fill="#94a3b8" className="font-bold">{val} ₼</text>
            </g>
          );
        })}

        {/* Areas */}
        <path d={createAreaPath(revPoints)} fill="url(#revGrad)" />
        <path d={createAreaPath(expPoints)} fill="url(#expGrad)" />

        {/* Lines */}
        <path d={createPath(revPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(16,185,129,0.2)]" />
        <path d={createPath(expPoints)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(239,68,68,0.15)]" />

        {/* Points */}
        {revPoints.map((p, i) => (
          <g key={i} className="cursor-pointer">
            {/* Hover bar detector */}
            <rect
              x={p.x - xStep / 2}
              y={paddingTop}
              width={xStep}
              height={chartHeight}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />

            {/* Glowing dots */}
            <circle cx={p.x} cy={p.y} r={hoveredIndex === i ? 5 : 3.5} fill="#ffffff" stroke="#10b981" strokeWidth="2.5" className="transition-all duration-150" />
            <circle cx={expPoints[i].x} cy={expPoints[i].y} r={hoveredIndex === i ? 5 : 3.5} fill="#ffffff" stroke="#ef4444" strokeWidth="2.5" className="transition-all duration-150" />

            {/* X Axis month labels */}
            <text x={p.x} y={height - 10} textAnchor="middle" fill="#94a3b8" className="font-bold text-[8px] uppercase">
              {p.month.split(" ")[0]}
            </text>
          </g>
        ))}

        {/* Interactive Cursor line */}
        {hoveredIndex !== null && (
          <line
            x1={revPoints[hoveredIndex].x}
            y1={paddingTop}
            x2={revPoints[hoveredIndex].x}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="2,2"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Floating glassmorphic tooltip card */}
      {hoveredIndex !== null && (
        <div
          className="absolute bg-white/95 border border-gray-100 rounded-xl p-3 shadow-xl glass text-[10px] space-y-1.5 z-20 pointer-events-none animate-in fade-in-0 scale-in duration-100"
          style={{
            left: `${(revPoints[hoveredIndex].x / width) * 100}%`,
            top: `${(Math.min(revPoints[hoveredIndex].y, expPoints[hoveredIndex].y) / height) * 100 - 30}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-black text-gray-950 border-b border-gray-100 pb-1 uppercase tracking-wide">
            {revPoints[hoveredIndex].month}
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-bold">GƏLİR:</span>
            <span className="font-extrabold text-emerald-600 font-mono">{revPoints[hoveredIndex].revenue.toFixed(2)} ₼</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-bold">XƏRC:</span>
            <span className="font-extrabold text-red-500 font-mono">{revPoints[hoveredIndex].expenses.toFixed(2)} ₼</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100/50 pt-1">
            <span className="text-gray-400 font-bold">MƏNFƏƏT:</span>
            <span className={`font-black font-mono ${revPoints[hoveredIndex].profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {revPoints[hoveredIndex].profit.toFixed(2)} ₼
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyPeakChart({ data }: { data: any[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-400 py-12 text-center">Həftəlik satış məlumatı tapılmadı</div>;
  }

  const maxVal = Math.max(...data.map(d => d.revenue)) * 1.15 || 500;
  const width = 450;
  const height = 180;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const xStep = chartWidth / 6;

  // Find index of the peak day
  const peakIndex = data.reduce((maxIdx, d, idx, arr) => d.revenue > arr[maxIdx].revenue ? idx : maxIdx, 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto font-mono text-[9px] text-gray-400 select-none overflow-visible">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((p, i) => {
          const y = height - paddingBottom - p * chartHeight;
          const val = (p * maxVal).toFixed(0);
          return (
            <g key={i} className="opacity-40">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
              <text x={10} y={y + 3} fill="#94a3b8" className="font-bold">{val} ₼</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.revenue / maxVal) * chartHeight;
          const barW = 22;
          const x = paddingLeft + i * xStep - barW / 2 + xStep / 2;
          const y = height - paddingBottom - barH;
          const isPeak = i === peakIndex && d.revenue > 0;

          return (
            <g key={i} className="cursor-pointer"
               onMouseEnter={() => setHoveredIndex(i)}
               onMouseLeave={() => setHoveredIndex(null)}>
              {/* Invisible interactive background bar */}
              <rect x={paddingLeft + i * xStep} y={paddingTop} width={xStep} height={chartHeight} fill="transparent" />

              {/* Styled Rect */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 4)}
                rx="5"
                fill={isPeak ? "url(#peakGrad)" : "url(#barGrad)"}
                stroke={isPeak ? "#f59e0b" : "transparent"}
                strokeWidth="1"
                className="transition-all duration-200 hover:brightness-105"
                style={{ filter: isPeak ? "drop-shadow(0 2px 4px rgba(245,158,11,0.2))" : "" }}
              />

              {/* Day initials */}
              <text x={paddingLeft + i * xStep + xStep / 2} y={height - 10} textAnchor="middle" fill="#94a3b8" className="font-bold text-[8px] uppercase">
                {d.day.substring(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip for bars */}
      {hoveredIndex !== null && (
        <div
          className="absolute bg-white/95 border border-gray-100 rounded-xl p-3 shadow-xl glass text-[10px] space-y-1 z-20 pointer-events-none animate-in fade-in-0 scale-in duration-100"
          style={{
            left: `${((paddingLeft + hoveredIndex * xStep + xStep / 2) / width) * 100}%`,
            top: `${((height - paddingBottom - (data[hoveredIndex].revenue / maxVal) * chartHeight) / height) * 100 - 30}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-black text-gray-950 border-b border-gray-100 pb-1 uppercase tracking-wide flex items-center gap-1.5">
            <span>{data[hoveredIndex].day}</span>
            {hoveredIndex === peakIndex && data[hoveredIndex].revenue > 0 && (
              <span className="text-[7px] bg-amber-500 text-white font-extrabold px-1 rounded-sm uppercase tracking-wider animate-pulse">Pik 🔥</span>
            )}
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400 font-bold">GƏLİR:</span>
            <span className="font-extrabold text-gray-900 font-mono">{data[hoveredIndex].revenue.toFixed(2)} ₼</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400 font-bold">SATIŞ:</span>
            <span className="font-extrabold text-primary font-mono">{data[hoveredIndex].sales} çek</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TopCategoriesChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-400 py-12 text-center">Kateqoriya məlumatı yoxdur</div>;
  }

  const total = data.reduce((sum, c) => sum + c.revenue, 0) || 1;
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
      {/* SVG Donut */}
      <div className="relative size-40 shrink-0 mx-auto sm:mx-0">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90 select-none">
          {data.map((cat, i) => {
            const percent = cat.revenue / total;
            const radius = 60;
            const circ = 2 * Math.PI * radius;
            const strokeDash = percent * circ;
            const strokeOffset = -cumulativePercent * circ;
            cumulativePercent += percent;
            const strokeColor = colors[i % colors.length];

            return (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={strokeColor}
                strokeWidth="18"
                strokeDasharray={`${strokeDash} ${circ - strokeDash}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-500 hover:stroke-[22px] cursor-pointer"
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">CƏMİ REYTİNQ</span>
          <span className="text-lg font-black text-gray-950 font-mono mt-0.5 leading-none">
            {data.reduce((sum, c) => sum + c.salesCount, 0).toFixed(0)}
          </span>
          <span className="text-[8px] font-bold text-gray-400 block mt-0.5">ədəd satılıb</span>
        </div>
      </div>

      {/* Legends list */}
      <div className="flex-1 space-y-3 w-full text-xs font-semibold">
        {data.map((cat, i) => {
          const percent = ((cat.revenue / total) * 100).toFixed(1);
          const color = colors[i % colors.length];
          return (
            <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                <span className="text-gray-900 truncate pr-2">{cat.category}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-extrabold text-gray-950 font-mono block">{cat.revenue.toFixed(2)} ₼</span>
                <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">{percent}% pay</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CogsMarginWidget({ data }: { data: any }) {
  if (!data) return null;

  const revenue = data.totalRevenue || 1;
  const costPercent = ((data.totalCost / revenue) * 100).toFixed(1);
  const expensePercent = ((data.totalExpenses / revenue) * 100).toFixed(1);
  const profitPercent = ((data.netProfit / revenue) * 100).toFixed(1);

  // Gauge circle parameters
  const r = 50;
  const circ = 2 * Math.PI * r;
  const percent = Math.max(0, Math.min(100, data.netMargin));
  const strokeDash = (percent / 100) * circ;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
      {/* Gauge ring */}
      <div className="lg:col-span-2 flex flex-col items-center justify-center text-center p-4">
        <div className="relative size-36">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90 select-none">
            {/* Background ring */}
            <circle cx="60" cy="60" r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="10" />

            {/* Glowing active ring */}
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="transparent"
              stroke="#10b981"
              strokeWidth="10"
              strokeDasharray={`${strokeDash} ${circ - strokeDash}`}
              strokeLinecap="round"
              className="drop-shadow-[0_2px_4px_rgba(16,185,129,0.2)]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Xalis Marja</span>
            <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 leading-none">{data.netMargin.toFixed(1)}%</span>
            <span className="text-[8px] font-bold text-gray-400 block mt-1">xalis mənfəət oranı</span>
          </div>
        </div>
      </div>

      {/* Margins audit details */}
      <div className="lg:col-span-3 space-y-4 text-xs font-semibold">
        <div className="space-y-1 bg-gray-50/50 border border-gray-100 p-3 rounded-xl">
          <div className="flex justify-between text-gray-500 font-bold text-[10px] uppercase">
            <span>Satış Gəliri (Revenue)</span>
            <span>100%</span>
          </div>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-gray-950 font-extrabold">Ümumi Satış cəmi:</span>
            <span className="text-base font-black text-gray-950 font-mono">{data.totalRevenue.toFixed(2)} ₼</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-50/50 border border-gray-100 p-3 rounded-xl space-y-0.5 text-left">
            <span className="text-[8px] font-bold text-gray-400 block uppercase tracking-wider">Məhsul Mayası (COGS)</span>
            <span className="text-sm font-black text-gray-900 font-mono block">{data.totalCost.toFixed(2)} ₼</span>
            <span className="text-[9px] font-bold text-amber-600 block mt-1">{costPercent}% gəlir payı</span>
          </div>

          <div className="bg-gray-50/50 border border-gray-100 p-3 rounded-xl space-y-0.5 text-left">
            <span className="text-[8px] font-bold text-gray-400 block uppercase tracking-wider">Digər Xərclər</span>
            <span className="text-sm font-black text-gray-900 font-mono block">{data.totalExpenses.toFixed(2)} ₼</span>
            <span className="text-[9px] font-bold text-red-500 block mt-1">{expensePercent}% gəlir payı</span>
          </div>

          <div className="bg-emerald-50/20 border border-emerald-100 p-3 rounded-xl space-y-0.5 text-left">
            <span className="text-[8px] font-bold text-emerald-700/70 block uppercase tracking-wider font-black">Xalis Mənfəət</span>
            <span className="text-sm font-black text-emerald-600 font-mono block">{data.netProfit.toFixed(2)} ₼</span>
            <span className="text-[9px] font-bold text-emerald-700 block mt-1">{profitPercent}% qazanc payı</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// MAIN DASHBOARD COMPONENT
// ----------------------------------------------------

export default function Dashboard() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "analytics">("summary");

  // Queries
  const summaryParams = filterActive
    ? `?from=${fromDate}&to=${toDate}`
    : "";

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<SummaryData>({
    queryKey: ["/api/dashboard/summary", fromDate, toDate, filterActive],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/summary${summaryParams}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: recentSales, isLoading: isRecentLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-sales"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/recent-sales");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: lowStock, isLoading: isLowStockLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/low-stock"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/low-stock");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/analytics");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: activeTab === "analytics",
  });

  const handleFilter = () => {
    setFilterActive(true);
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setFilterActive(false);
  };

  const getPeriodLabel = () => {
    if (!filterActive) return "Bu gün";
    const fromStr = fromDate ? new Date(fromDate).toLocaleDateString("az-AZ") : "...";
    const toStr = toDate ? new Date(toDate).toLocaleDateString("az-AZ") : "...";
    return `${fromStr} — ${toStr}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in-0">
      {/* Header & Date Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">İdarəetmə Paneli</h2>
            
            {/* Elegant glass tab switcher */}
            <div className="bg-gray-100/80 p-0.5 rounded-xl border border-gray-200/50 flex items-center glass shadow-xs ml-2 select-none">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                  activeTab === "summary"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-400 hover:text-gray-900"
                }`}
              >
                Xülasə 📋
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-400 hover:text-gray-900"
                }`}
              >
                Analitika 📊
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Dövr: <span className="font-semibold text-gray-700">{getPeriodLabel()}</span>
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass w-full md:w-auto">
          <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Başlanğıc
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[120px] sm:flex-initial">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Son</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 bg-gray-50/50"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={!fromDate && !toDate}
            className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50 w-full sm:w-auto animate-pulse-subtle"
          >
            Filtrlə
          </button>
          {filterActive && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-200 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-50 cursor-pointer w-full sm:w-auto"
            >
              Sıfırla
            </button>
          )}
        </div>
      </div>

      {activeTab === "summary" ? (
        <>
          {/* 1. Main Period Stats (Revenue, Cost, Profit, Expenses) */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-20 duration-300">
            {/* Revenue */}
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satış Gəliri</span>
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight font-mono">
                  {isSummaryLoading ? "..." : `${Number(summary?.todayRevenue || 0).toFixed(2)} ₼`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">
                  {summary?.todaySales || 0} uğurlu satış
                </p>
              </div>
            </div>

            {/* Cost of Goods Sold (COGS) */}
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Məhsul Mayası</span>
                <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight font-mono">
                  {isSummaryLoading ? "..." : `${Number(summary?.todayCost || 0).toFixed(2)} ₼`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">anbar alış qiyməti ilə</p>
              </div>
            </div>

            {/* Sales Profit */}
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satış Mənfəəti</span>
                <div className="size-8 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-green-600 tracking-tight font-mono">
                  {isSummaryLoading ? "..." : `${Number(summary?.todayProfit || 0).toFixed(2)} ₼`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">gəlir − maya dəyəri</p>
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs glass-card hover-elevate">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Digər Xərclər</span>
                <div className="size-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-red-500 tracking-tight font-mono">
                  {isSummaryLoading ? "..." : `${Number(summary?.todayExpenses || 0).toFixed(2)} ₼`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">maaş, icarə və kommunal</p>
              </div>
            </div>
          </div>

          {/* 2. NET PROFIT OVERVIEW */}
          <div
            className={`border p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all duration-300 animate-in fade-in-30 ${
              Number(summary?.todayNetProfit || 0) >= 0
                ? "border-green-200 bg-green-50/20"
                : "border-red-200 bg-red-50/20"
            }`}
          >
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                XALİS MƏNFƏƏT (Satış mənfəəti − Digər xərclər)
              </p>
              <h2
                className={`text-4xl font-black tracking-tight font-mono ${
                  Number(summary?.todayNetProfit || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {isSummaryLoading ? "..." : `${Number(summary?.todayNetProfit || 0).toFixed(2)} ₼`}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Seçilmiş dövr ərzindəki real qazancınız
              </p>
            </div>

            {/* Current Month Summaries */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-5 bg-white/70 rounded-xl border border-gray-100/50 glass text-xs">
              <div>
                <span className="text-gray-400 font-medium block">Ay Gəliri</span>
                <span className="font-bold text-sm block mt-1 font-mono text-gray-900">
                  {isSummaryLoading ? "..." : `${Number(summary?.monthRevenue || 0).toFixed(2)} ₼`}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Ay Mənfəəti</span>
                <span className="font-bold text-sm block mt-1 font-mono text-green-600">
                  {isSummaryLoading ? "..." : `${Number(summary?.monthProfit || 0).toFixed(2)} ₼`}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Ay Xərcləri</span>
                <span className="font-bold text-sm block mt-1 font-mono text-red-500">
                  {isSummaryLoading ? "..." : `${Number(summary?.monthExpenses || 0).toFixed(2)} ₼`}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Ay Xalis Mənfəət</span>
                <span
                  className={`font-bold text-sm block mt-1 font-mono ${
                    Number(summary?.monthNetProfit || 0) >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {isSummaryLoading ? "..." : `${Number(summary?.monthNetProfit || 0).toFixed(2)} ₼`}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Secondary Analytics (Stock Value, Debts, Outstandings) */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Stock Value */}
            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs glass-card">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Anbar Dəyəri</span>
              <h4 className="text-xl font-bold text-gray-900 mt-2 font-mono">
                {isSummaryLoading ? "..." : `${Number(summary?.totalStockValue || 0).toFixed(2)} ₼`}
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">anbardakı malların mayası</span>
            </div>

            {/* Low Stock count */}
            <div
              className={`border p-5 rounded-2xl shadow-xs transition-all ${
                (summary?.lowStockCount || 0) > 0 ? "border-amber-200 bg-amber-50/20" : "bg-white border-gray-100"
              }`}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Az qalan mallar
              </span>
              <h4
                className={`text-xl font-bold mt-2 font-mono ${
                  (summary?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-gray-900"
                }`}
              >
                {isSummaryLoading ? "..." : summary?.lowStockCount} məhsul
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">miqdarı 5 ədəddən azdır</span>
            </div>

            {/* Debts due to us */}
            <div
              className={`border p-5 rounded-2xl shadow-xs transition-all ${
                (summary?.totalCreditDebt || 0) > 0 ? "border-red-200 bg-red-50/20" : "bg-white border-gray-100"
              }`}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Müştərilərin Borcu
              </span>
              <h4
                className={`text-xl font-bold mt-2 font-mono ${
                  Number(summary?.totalCreditDebt || 0) > 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {isSummaryLoading ? "..." : `${Number(summary?.totalCreditDebt || 0).toFixed(2)} ₼`}
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                {summary?.overdueCreditsCount || 0} müştərinin müddəti keçib
              </span>
            </div>

            {/* Debts we owe to suppliers */}
            <div
              className={`border p-5 rounded-2xl shadow-xs transition-all ${
                Number(summary?.myTotalDebt || 0) > 0 ? "border-amber-200 bg-amber-50/20" : "bg-white border-gray-100"
              }`}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Mənim Borcum
              </span>
              <h4
                className={`text-xl font-bold mt-2 font-mono ${
                  Number(summary?.myTotalDebt || 0) > 0 ? "text-amber-600" : "text-gray-900"
                }`}
              >
                {isSummaryLoading ? "..." : `${Number(summary?.myTotalDebt || 0).toFixed(2)} ₼`}
              </h4>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">tədarükçülərə anbar nisyəsi</span>
            </div>
          </div>

          {/* 4. Recent Sales and Low Stock Alert lists */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Sales List */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-sm">Son Satışlar</h3>
                <Link href="/satislar" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                  Hamısına bax <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3.5">
                {isRecentLoading ? (
                  <p className="text-xs text-gray-400">Yüklənir...</p>
                ) : !recentSales || recentSales.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Hələ heç bir satış qeydə alınmayıb.</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0 text-xs">
                      <div>
                        <span className="font-semibold block text-gray-900">{sale.customerName || "Nəğd Satış"}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {new Date(sale.saleDate).toLocaleDateString("az-AZ")} | {sale.paymentType}{sale.paymentType === "Kart" && sale.bankName ? ` (${sale.bankName})` : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block text-gray-950 font-mono">{Number(sale.totalAmount || 0).toFixed(2)} ₼</span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                            sale.paymentStatus === "paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {sale.paymentStatus === "paid" ? "Ödənilib" : "Nisyə"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Low Stock Items List */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs glass-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-sm">Tükənməkdə Olan Mallar</h3>
                <Link href="/anbar" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                  Anbara bax <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-2">
                {isLowStockLoading ? (
                  <p className="text-xs text-gray-400">Yüklənir...</p>
                ) : !lowStock || lowStock.length === 0 ? (
                  <p className="text-xs text-green-600 py-6 text-center font-medium">Bütün məhsulların anbar qalığı normaldır. 🎉</p>
                ) : (
                  lowStock.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0 text-xs">
                      <div>
                        <span className="font-semibold block text-gray-900">{item.productName}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">Məhsul ID: #{item.productId}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-600 block font-mono">
                          {item.currentQuantity} {item.unit}
                        </span>
                        <span className="text-[9px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                          Kritik Qalıq
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        // ----------------------------------------------------
        // EXECUTIVE INTERACTIVE ANALYTICS LAYOUT
        // ----------------------------------------------------
        <div className="space-y-8 animate-in fade-in-20 duration-300">
          {isAnalyticsLoading ? (
            <div className="min-h-96 flex items-center justify-center bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              <div className="text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-primary mx-auto animate-spin" />
                <span className="text-xs font-bold text-gray-400 block animate-pulse">İnteraktiv maliyyə hesabatları toplanır...</span>
              </div>
            </div>
          ) : !analytics ? (
            <div className="text-center text-xs text-gray-400 py-16 bg-white rounded-3xl border border-gray-100">
              Analitika verilənləri tapılmadı
            </div>
          ) : (
            <>
              {/* Row 1: Area Trends & Peak Hours Bar Chart */}
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
                {/* Monthly trends area graph */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-3 glass-card flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Gəlir və Xərc Trendi</span>
                    <h3 className="font-extrabold text-gray-900 text-sm mt-1">Aylıq Maliyyə Axını</h3>
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-0.5">Son 6 ay ərzində mağazanın ümumi gəlir və xərclərinin qarşılaşdırılması.</p>
                  </div>
                  
                  <div className="py-6 flex-1 flex items-center justify-center">
                    <MonthlyTrendChart data={analytics.monthlyTrend} />
                  </div>

                  {/* Chart legends */}
                  <div className="flex gap-4 items-center justify-end text-[9px] font-bold uppercase tracking-wider text-gray-500 select-none pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500"></span>
                      <span>Gəlir (Satış)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-red-500"></span>
                      <span>Xərc</span>
                    </div>
                  </div>
                </div>

                {/* Peak Weekday distribution bar chart */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-2 glass-card flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Həftəlik Satış Dağılımı</span>
                    <h3 className="font-extrabold text-gray-900 text-sm mt-1">Həftənin Pik Günləri (Peak Days)</h3>
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-0.5">Müştərilərin ən çox hansı günlərdə alış-veriş etdiyinin vizual analizi.</p>
                  </div>

                  <div className="py-6 flex-1 flex items-center justify-center">
                    <WeeklyPeakChart data={analytics.weeklyDistribution} />
                  </div>

                  <div className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 flex items-center justify-center gap-1 select-none">
                    <Sparkles className="w-3 h-3 animate-spin duration-3000 shrink-0" />
                    <span>Qızılı rəng həftəlik ən yüksək ciro (gəlir) olan günü göstərir.</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Top 5 Categories & COGS Margin Gauge */}
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
                {/* Top 5 Categories donut chart */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-2 glass-card flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Məhsul Reytinqi</span>
                    <h3 className="font-extrabold text-gray-900 text-sm mt-1">Top 5 Ən Çox Satılan Kateqoriya</h3>
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-0.5">Cəmi satılan məhsulların kateqoriya payları üzrə analitik bölgüsü.</p>
                  </div>

                  <div className="py-2">
                    <TopCategoriesChart data={analytics.topCategories} />
                  </div>
                </div>

                {/* COGS Profit Margin Gauge Audit */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-3 glass-card flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Mənfəət Marjası Analitikası</span>
                    <h3 className="font-extrabold text-gray-900 text-sm mt-1">Maya Dəyəri və Xərc Auditi (COGS Audit)</h3>
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-0.5">Qazanılan hər 1 ₼ gəlirin maya dəyərinə, xərclərə və xalis mənfəətə faiz bölgüsü.</p>
                  </div>

                  <div className="py-4">
                    <CogsMarginWidget data={analytics.cogsAudit} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
