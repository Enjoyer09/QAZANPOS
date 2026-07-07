import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Boxes,
  DollarSign,
  PieChart,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  Wallet,
  Percent,
  Target,
  Save,
  X,
  Printer,
  Send,
  Mail,
  CheckCircle,
} from "lucide-react";

interface PnLData {
  period: { from: string; to: string };
  budget: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    variance: {
      revenue: number;
      grossProfit: number;
      netProfit: number;
      expenses: number;
      cogs: number;
    };
  };
  summary: {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    grossMargin: number;
    totalExpenses: number;
    expenseByCategory: Record<string, number>;
    expenseByPaymentType: Record<string, number>;
    netProfit: number;
    netMargin: number;
    salesCount: number;
    avgTicket: number;
    avgProfitPerSale: number;
  };
  previousPeriod: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    change: {
      revenue: number;
      grossProfit: number;
      netProfit: number;
      expenses: number;
    };
  };
  monthlyTrend: {
    month: string;
    monthKey: string;
    revenue: number;
    cogs: number;
    expenses: number;
    profit: number;
  }[];
}

// ─── Waterfall-style Trend Chart ───────────────────────────────────────────

function PnLTrendChart({ data }: { data: PnLData["monthlyTrend"] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-16 text-center font-medium">
        Seçilmiş dövr üçün məlumat tapılmadı
      </div>
    );
  }

  const maxVal = Math.max(...data.map(m => Math.max(m.revenue, Math.abs(m.profit), m.cogs + m.expenses))) * 1.2 || 1000;
  const width = 600;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 35, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barW = Math.min(28, chartW / data.length - 6);

  return (
    <div className="relative select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto font-mono text-[9px] text-gray-400 overflow-visible">
        <defs>
          <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="profitLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = height - pad.bottom - p * chartH;
          const val = (p * maxVal).toFixed(0);
          return (
            <g key={i} className="opacity-40">
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e2e8f0" strokeDasharray="2,3" />
              <text x={8} y={y + 3} fill="#94a3b8" className="font-bold">{val} ₼</text>
            </g>
          );
        })}

        {/* Zero line */}
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" strokeWidth="1" />

        {data.map((m, i) => {
          const x = pad.left + (i / (data.length - 1 || 1)) * chartW - barW / 2;

          const revH = (m.revenue / maxVal) * chartH;
          const expH = (m.expenses / maxVal) * chartH;
          const profitH = (m.profit / maxVal) * chartH;

          const revY = height - pad.bottom - revH;
          const expY = height - pad.bottom;
          const profitY = height - pad.bottom - (m.profit >= 0 ? profitH : 0);
          const profitBarH = Math.abs(profitH);

          return (
            <g key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Hover detector */}
              <rect x={pad.left + (i / (data.length - 1 || 1)) * chartW - chartW / data.length / 2} y={pad.top}
                width={chartW / data.length} height={chartH} fill="transparent" />

              {/* Revenue bar */}
              <rect x={x} y={revY} width={barW} height={Math.max(revH, 2)} rx="3" fill="url(#revBarGrad)"
                className="transition-all duration-200 hover:brightness-110"
                style={{ filter: hoveredIdx === i ? "drop-shadow(0 2px 4px rgba(16,185,129,0.3))" : "" }} />

              {/* Expenses bar (stacked below) */}
              <rect x={x} y={expY - expH} width={barW} height={Math.max(expH, 2)} rx="3" fill="url(#expBarGrad)"
                className="transition-all duration-200 hover:brightness-110" />

              {/* Profit dot/line indicator */}
              {m.profit !== 0 && (
                <circle cx={x + barW / 2} cy={profitY} r={hoveredIdx === i ? 4 : 2.5}
                  fill={m.profit >= 0 ? "#6366f1" : "#ef4444"}
                  stroke="#fff" strokeWidth="1.5"
                  className="transition-all duration-150" />
              )}

              {/* Month label */}
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fill="#94a3b8"
                className="font-bold text-[8px]">
                {m.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="absolute bg-white/95 border border-gray-100 rounded-xl p-3.5 shadow-xl glass text-[10px] space-y-1.5 z-20 pointer-events-none animate-in fade-in-0 scale-in duration-100"
          style={{
            left: `${(pad.left + (hoveredIdx / (data.length - 1 || 1)) * chartW) / width * 100}%`,
            top: "0%",
            transform: "translateX(-50%) translateY(-105%)",
          }}>
          <div className="font-black text-gray-950 border-b border-gray-100 pb-1.5 flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-indigo-500"></span>
            <span className="text-xs">{data[hoveredIdx].month} {data[hoveredIdx].monthKey}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-gray-400 font-bold">Gəlir:</span>
            <span className="font-extrabold text-emerald-600 font-mono text-right">{data[hoveredIdx].revenue.toFixed(2)} ₼</span>
            <span className="text-gray-400 font-bold">COGS:</span>
            <span className="font-extrabold text-amber-600 font-mono text-right">{data[hoveredIdx].cogs.toFixed(2)} ₼</span>
            <span className="text-gray-400 font-bold">Xərc:</span>
            <span className="font-extrabold text-red-500 font-mono text-right">{data[hoveredIdx].expenses.toFixed(2)} ₼</span>
            <span className="text-gray-400 font-bold border-t border-gray-50 pt-0.5">Mənfəət:</span>
            <span className={`font-black font-mono text-right border-t border-gray-50 pt-0.5 ${data[hoveredIdx].profit >= 0 ? "text-indigo-600" : "text-red-600"}`}>
              {data[hoveredIdx].profit.toFixed(2)} ₼
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[9px] font-bold text-gray-400 mt-2 select-none">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-400"></span>Gəlir</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-400"></span>Xərc</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-indigo-500"></span>Mənfəət</span>
      </div>
    </div>
  );
}

// ─── Expense Category Pie ───────────────────────────────────────────────────

function ExpenseCategoryChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return <div className="text-xs text-gray-400 py-8 text-center">Xərc məlumatı yoxdur</div>;

  const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([cat, amount], i) => {
        const pct = ((amount / total) * 100).toFixed(1);
        const barWidth = Math.max(2, (amount / total) * 100);
        return (
          <div key={cat} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></span>
                <span className="text-gray-900 font-semibold truncate">{cat}</span>
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="font-bold text-gray-950 font-mono text-[11px]">{amount.toFixed(2)} ₼</span>
                <span className="text-[9px] text-gray-400 font-bold ml-1.5">({pct}%)</span>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: colors[i % colors.length] }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Change Indicator Badge ─────────────────────────────────────────────────

function ChangeBadge({ value, label }: { value: number; label?: string }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  const color = isPos ? "text-green-600 bg-green-50 border-green-200" : isNeg ? "text-red-600 bg-red-50 border-red-200" : "text-gray-400 bg-gray-50 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border ${color}`}>
      {isPos ? <ArrowUpRight className="w-2.5 h-2.5" /> : isNeg ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
      {value >= 0 ? "+" : ""}{value.toFixed(1)}%
      {label && <span className="ml-0.5 font-bold opacity-70">{label}</span>}
    </span>
  );
}

// ─── Budget Variance Badge ─────────────────────────────────────────────────

function BudgetBadge({ actual, budget, goodIfOver }: { actual: number; budget: number; goodIfOver?: boolean }) {
  if (budget === 0 && actual === 0) return <span className="text-[9px] text-gray-300 font-bold">—</span>;
  if (budget === 0) return <span className="text-[9px] text-gray-400 font-bold">Hədəf yoxdur</span>;
  const diff = actual - budget;
  const pct = (diff / budget) * 100;
  // For revenue/profit: over-budget is good (green). For expenses: under-budget is good.
  // goodIfOver=true → over is green, under is red
  // goodIfOver=false → over is red, under is green (default for expenses)
  const isFavourable = goodIfOver ? diff > 0 : diff < 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border ${
        isFavourable ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
      }`}>
        {diff >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
        {diff >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
      <span className="text-[9px] text-gray-400 font-bold">
        {diff > 0 ? "artıq" : diff < 0 ? "əskik" : "bərabər"} ({Math.abs(diff).toFixed(0)} ₼)
      </span>
    </div>
  );
}

// ─── Budget Progress Bar ────────────────────────────────────────────────────

function BudgetProgressBar({ actual, budget }: { actual: number; budget: number }) {
  if (budget === 0) return null;
  const pct = Math.min(100, Math.max(0, (actual / budget) * 100));
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
        style={{ width: `${pct}%` }}
      ></div>
    </div>
  );
}

// ─── Finance Stat Card ──────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
  change,
  budgetActual,
  budgetTarget,
  budgetGoodIfOver,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  change?: number;
  budgetActual?: number;
  budgetTarget?: number;
  budgetGoodIfOver?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    red: "bg-red-50 text-red-600 border-red-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const iconBg = colorMap[color] || colorMap.gray;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card hover-elevate transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`size-8 rounded-xl ${iconBg} flex items-center justify-center border`}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-black text-gray-900 tracking-tight font-mono">{value}</h3>
        {subtitle && <p className="text-[10px] text-gray-400 font-medium">{subtitle}</p>}
        {budgetActual !== undefined && budgetTarget !== undefined && budgetTarget > 0 && (
          <div className="mt-2">
            <BudgetBadge actual={budgetActual} budget={budgetTarget} goodIfOver={budgetGoodIfOver} />
            <BudgetProgressBar actual={budgetActual} budget={budgetTarget} />
          </div>
        )}
        {change !== undefined && (
          <div className="mt-2">
            <ChangeBadge value={change} label="əvvəlki dövr" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detailed P&L Table ────────────────────────────────────────────────────

function PnLTable({ data, prev, budget }: { data: PnLData["summary"]; prev: PnLData["previousPeriod"]; budget: PnLData["budget"] }) {
  const hasBudget = budget.revenue > 0 || budget.cogs > 0 || budget.expenses > 0;

  const rows: {
    label: string;
    value: number;
    prev: number;
    budgetVal?: number;
    budgetVar?: number;
    color: string;
    isTotal: boolean;
    isBold?: boolean;
  }[] = [
    {
      label: "Satış Gəliri (Revenue)", value: data.totalRevenue, prev: prev.revenue,
      budgetVal: budget.revenue, budgetVar: budget.variance.revenue,
      color: "text-emerald-600", isTotal: true,
    },
    {
      label: "Məhsul Mayası (COGS)", value: -data.totalCOGS, prev: -prev.cogs,
      budgetVal: budget.cogs ? -budget.cogs : undefined, budgetVar: budget.variance.cogs,
      color: "text-amber-600", isTotal: true,
    },
    {
      label: "Ümumi Mənfəət (Gross Profit)", value: data.grossProfit, prev: prev.grossProfit,
      budgetVal: budget.grossProfit, budgetVar: budget.variance.grossProfit,
      color: "text-indigo-600", isTotal: true, isBold: true,
    },
    {
      label: "Əməliyyat Xərcləri", value: -data.totalExpenses, prev: -prev.expenses,
      budgetVal: budget.expenses ? -budget.expenses : undefined, budgetVar: budget.variance.expenses,
      color: "text-red-500", isTotal: false,
    },
    ...Object.entries(data.expenseByCategory).map(([cat, amt]) => ({
      label: `  └ ${cat}`,
      value: -amt,
      prev: 0,
      budgetVal: undefined as number | undefined,
      budgetVar: undefined as number | undefined,
      color: "text-gray-500" as const,
      isTotal: false as const,
    })),
    {
      label: "Xalis Mənfəət (Net Profit)", value: data.netProfit, prev: prev.netProfit,
      budgetVal: budget.netProfit, budgetVar: budget.variance.netProfit,
      color: data.netProfit >= 0 ? "text-green-600" : "text-red-600", isTotal: true, isBold: true,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            <th className="p-3 pl-0">Maddə</th>
            <th className="p-3 text-right">Cari Dövr</th>
            {hasBudget && <th className="p-3 text-right">Büdcə</th>}
            <th className="p-3 text-right">Əvvəlki Dövr</th>
            <th className="p-3 text-right">Dəyişmə</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => {
            const changePct = row.prev !== 0 && prev.revenue !== 0
              ? ((row.value - row.prev) / Math.abs(row.prev)) * 100
              : 0;
            const showChange = row.prev !== 0 && !row.label.startsWith("  └");
            return (
              <tr key={i} className={`${row.isBold ? "font-black" : "font-semibold"} text-gray-700 hover:bg-gray-50/30 transition-colors`}>
                <td className={`p-3 pl-0 ${row.isBold ? "text-gray-950" : ""}`}>{row.label}</td>
                <td className={`p-3 text-right font-mono ${row.color}`}>
                  {(row.value || 0).toFixed(2)} ₼
                </td>
                {hasBudget && (
                  <td className="p-3 text-right font-mono">
                    {row.budgetVal !== undefined ? (
                      <span className={`${Math.abs(row.budgetVar || 0) < 5 ? "text-gray-600" : (row.budgetVar || 0) >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {(row.budgetVal || 0).toFixed(2)} ₼
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )}
                <td className="p-3 text-right font-mono text-gray-400">
                  {(row.prev || 0).toFixed(2)} ₼
                </td>
                <td className="p-3 text-right pr-0">
                  {showChange && <ChangeBadge value={changePct} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Budget Settings Panel ──────────────────────────────────────────────────

function BudgetPanel({
  periodKey,
  onSave,
}: {
  periodKey: string;
  onSave: (b: { revenue: number; cogs: number; expenses: number }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [revBudget, setRevBudget] = useState("");
  const [cogsBudget, setCogsBudget] = useState("");
  const [expBudget, setExpBudget] = useState("");

  // Load existing budget from localStorage when period changes
  useEffect(() => {
    const stored = localStorage.getItem(`pnl_budget_${periodKey}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRevBudget(parsed.revenue?.toString() || "");
        setCogsBudget(parsed.cogs?.toString() || "");
        setExpBudget(parsed.expenses?.toString() || "");
      } catch {
        // ignore
      }
    } else {
      setRevBudget("");
      setCogsBudget("");
      setExpBudget("");
    }
  }, [periodKey]);

  const handleSave = () => {
    const budget = {
      revenue: parseFloat(revBudget) || 0,
      cogs: parseFloat(cogsBudget) || 0,
      expenses: parseFloat(expBudget) || 0,
    };
    localStorage.setItem(`pnl_budget_${periodKey}`, JSON.stringify(budget));
    onSave(budget);
    setIsOpen(false);
  };

  const handleClear = () => {
    localStorage.removeItem(`pnl_budget_${periodKey}`);
    setRevBudget("");
    setCogsBudget("");
    setExpBudget("");
    onSave({ revenue: 0, cogs: 0, expenses: 0 });
    setIsOpen(false);
  };

  return (
    <>
      {!isOpen ? (
        <button onClick={() => setIsOpen(true)}
          className="px-3 py-2 bg-white border border-dashed border-indigo-200 text-indigo-600 font-bold text-[10px] rounded-xl hover:bg-indigo-50 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs">
          <Target className="w-3.5 h-3.5" /> Büdcə Təyin Et
        </button>
      ) : (
        <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-xs glass-card space-y-3 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-500" />
              <span className="font-extrabold text-gray-900 text-sm">Büdcə Hədəfləri</span>
            </div>
            <button onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-900 cursor-pointer rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">{periodKey} dövrü üçün büdcə hədəflərini daxil edin</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase block">Gəlir (₼)</label>
              <input type="number" step="0.01" placeholder="0.00" value={revBudget}
                onChange={e => setRevBudget(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase block">Maya (₼)</label>
              <input type="number" step="0.01" placeholder="0.00" value={cogsBudget}
                onChange={e => setCogsBudget(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase block">Xərc (₼)</label>
              <input type="number" step="0.01" placeholder="0.00" value={expBudget}
                onChange={e => setExpBudget(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={handleClear}
              className="px-3 py-1.5 border border-gray-200 text-gray-500 font-bold text-[10px] rounded-xl hover:bg-gray-50 cursor-pointer transition-all">
              Təmizlə
            </button>
            <button onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-600 text-white font-bold text-[10px] rounded-xl hover:bg-indigo-700 cursor-pointer transition-all shadow-xs flex items-center gap-1">
              <Save className="w-3 h-3" /> Yadda Saxla
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── MAIN PnL PAGE ─────────────────────────────────────────────────────────

export default function PnL() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);

  // Budget state: loaded from localStorage and passed to API
  const periodKey = `${fromDate}_${toDate}`;
  const loadBudget = useCallback((period: string) => {
    const stored = localStorage.getItem(`pnl_budget_${period}`);
    if (stored) {
      try { return JSON.parse(stored) as { revenue: number; cogs: number; expenses: number }; } catch { /* fallthrough */ }
    }
    return { revenue: 0, cogs: 0, expenses: 0 };
  }, []);
  const [budgetValues, setBudgetValues] = useState<{ revenue: number; cogs: number; expenses: number }>(() => loadBudget(periodKey));

  // Re-read budget from localStorage when period changes
  useEffect(() => {
    setBudgetValues(loadBudget(periodKey));
  }, [periodKey, loadBudget]);

  const budgetParams = budgetValues.revenue > 0 || budgetValues.cogs > 0 || budgetValues.expenses > 0
    ? `&revenueBudget=${budgetValues.revenue}&cogsBudget=${budgetValues.cogs}&expenseBudget=${budgetValues.expenses}`
    : "";

  const params = `?from=${fromDate}&to=${toDate}${budgetParams}`;

  const { data, isLoading, isError, error, refetch } = useQuery<PnLData>({
    queryKey: ["/api/dashboard/pnl", fromDate, toDate, budgetValues],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/pnl${params}`);
      if (!res.ok) throw new Error("Məlumatları gətirmək mümkün olmadı");
      return res.json();
    },
  });

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = async () => {
    if (!emailAddress || emailSending) return;
    setEmailSending(true);
    setEmailSent(false);
    try {
      const res = await fetch(`/api/dashboard/pnl/send-email?from=${fromDate}&to=${toDate}${budgetParams}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailAddress }),
      });
      if (!res.ok) throw new Error();
      setEmailSent(true);
    } catch {
      setEmailSent(false);
    } finally {
      setEmailSending(false);
    }
  };

  const handleBudgetSave = useCallback((b: { revenue: number; cogs: number; expenses: number }) => {
    setBudgetValues(b);
  }, []);

  const formatCurrency = (val: number) => `${(val || 0).toFixed(2)} ₼`;
  const formatPercent = (val: number) => `${(val || 0).toFixed(1)}%`;

  // ── Print-only P&L Report ──
  const printReport = data && (
    <div className="print-report">
      <div className="print-report-header">
        <h1>Mənfəət/Zərər Hesabatı</h1>
        <h2>P&L (Profit & Loss) Report</h2>
        <div className="print-report-period">
          <span>Dövr: {new Date(data.period.from).toLocaleDateString("az-AZ")} — {new Date(data.period.to).toLocaleDateString("az-AZ")}</span>
          <span>Yaradılma tarixi: {new Date().toLocaleDateString("az-AZ")}</span>
        </div>
      </div>

      <table className="print-summary-table">
        <thead>
          <tr>
            <th>Göstərici</th>
            <th>Cari Dövr</th>
            <th>Büdcə</th>
            <th>Fərq</th>
            <th>Əvvəlki Dövr</th>
            <th>Dəyişmə</th>
          </tr>
        </thead>
        <tbody>
          <tr className="row-revenue">
            <td><strong>Satış Gəliri</strong></td>
            <td>{formatCurrency(data.summary.totalRevenue)}</td>
            <td>{formatCurrency(data.budget.revenue)}</td>
            <td>{data.budget.variance.revenue.toFixed(1)}%</td>
            <td>{formatCurrency(data.previousPeriod.revenue)}</td>
            <td>{data.previousPeriod.change.revenue.toFixed(1)}%</td>
          </tr>
          <tr className="row-cogs">
            <td><strong>Məhsul Mayası (COGS)</strong></td>
            <td>{formatCurrency(data.summary.totalCOGS)}</td>
            <td>{formatCurrency(data.budget.cogs)}</td>
            <td>{data.budget.variance.cogs.toFixed(1)}%</td>
            <td>{formatCurrency(data.previousPeriod.cogs)}</td>
            <td>—</td>
          </tr>
          <tr className="row-gross-profit">
            <td><strong>Ümumi Mənfəət</strong></td>
            <td>{formatCurrency(data.summary.grossProfit)}</td>
            <td>{formatCurrency(data.budget.grossProfit)}</td>
            <td>{data.budget.variance.grossProfit.toFixed(1)}%</td>
            <td>{formatCurrency(data.previousPeriod.grossProfit)}</td>
            <td>{data.previousPeriod.change.grossProfit.toFixed(1)}%</td>
          </tr>
          <tr className="row-expenses">
            <td><strong>Əməliyyat Xərcləri</strong></td>
            <td>{formatCurrency(data.summary.totalExpenses)}</td>
            <td>{formatCurrency(data.budget.expenses)}</td>
            <td>{data.budget.variance.expenses.toFixed(1)}%</td>
            <td>{formatCurrency(data.previousPeriod.expenses)}</td>
            <td>{data.previousPeriod.change.expenses.toFixed(1)}%</td>
          </tr>
          {Object.entries(data.summary.expenseByCategory).map(([cat, amt]) => (
            <tr key={cat} className="row-sub">
              <td>  └ {cat}</td>
              <td>{formatCurrency(amt)}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          ))}
          <tr className="row-net-profit">
            <td><strong>Xalis Mənfəət</strong></td>
            <td>{formatCurrency(data.summary.netProfit)}</td>
            <td>{formatCurrency(data.budget.netProfit)}</td>
            <td>{data.budget.variance.netProfit.toFixed(1)}%</td>
            <td>{formatCurrency(data.previousPeriod.netProfit)}</td>
            <td>{data.previousPeriod.change.netProfit.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>

      <div className="print-metrics">
        <div className="print-metric">
          <span className="print-metric-label">Ümumi Marja</span>
          <span className="print-metric-value">{formatPercent(data.summary.grossMargin)}</span>
        </div>
        <div className="print-metric">
          <span className="print-metric-label">Xalis Marja</span>
          <span className="print-metric-value">{formatPercent(data.summary.netMargin)}</span>
        </div>
        <div className="print-metric">
          <span className="print-metric-label">Satış Sayı</span>
          <span className="print-metric-value">{data.summary.salesCount}</span>
        </div>
        <div className="print-metric">
          <span className="print-metric-label">Orta Çek</span>
          <span className="print-metric-value">{formatCurrency(data.summary.avgTicket)}</span>
        </div>
      </div>

      {data.monthlyTrend.length > 0 && (
        <table className="print-trend-table">
          <thead>
            <tr>
              <th>Ay</th>
              <th>Gəlir</th>
              <th>COGS</th>
              <th>Xərc</th>
              <th>Mənfəət</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyTrend.map((m) => (
              <tr key={m.monthKey}>
                <td><strong>{m.month}</strong></td>
                <td>{formatCurrency(m.revenue)}</td>
                <td>{formatCurrency(m.cogs)}</td>
                <td>{formatCurrency(m.expenses)}</td>
                <td className={m.profit >= 0 ? "positive" : "negative"}>{formatCurrency(m.profit)}</td>
              </tr>
            ))}
            <tr className="row-total">
              <td><strong>Cəmi</strong></td>
              <td>{formatCurrency(data.summary.totalRevenue)}</td>
              <td>{formatCurrency(data.summary.totalCOGS)}</td>
              <td>{formatCurrency(data.summary.totalExpenses)}</td>
              <td className={data.summary.netProfit >= 0 ? "positive" : "negative"}>{formatCurrency(data.summary.netProfit)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="print-footer">
        <p>QAZANPOS — P&L Hesabatı</p>
        <p>Bu hesabat avtomatik yaradılmışdır.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Print-only P&L Report */}
      {printReport}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm 10mm; size: A4 portrait; }
          .no-print { display: none !important; }
          .print-report { display: block !important; font-family: -apple-system, sans-serif; color: #1e293b; }
          .print-report h1 { font-size: 18pt; font-weight: 900; margin: 0; color: #0f172a; }
          .print-report h2 { font-size: 10pt; font-weight: 600; margin: 2pt 0 0 0; color: #64748b; }
          .print-report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 10pt; margin-bottom: 14pt; }
          .print-report-period { display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; margin-top: 6pt; }
          .print-summary-table { width: 100%; border-collapse: collapse; margin-bottom: 14pt; font-size: 9pt; }
          .print-summary-table th { background: #f1f5f9; text-align: left; padding: 6pt 8pt; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          .print-summary-table td { padding: 5pt 8pt; border-bottom: 1px solid #f1f5f9; }
          .print-summary-table .row-gross-profit td, .print-summary-table .row-net-profit td { border-top: 2px solid #cbd5e1; font-weight: 800; }
          .print-summary-table .row-revenue td { font-weight: 700; }
          .print-summary-table .row-cogs td { color: #6b7280; }
          .print-summary-table .row-expenses td { color: #dc2626; }
          .print-summary-table .row-sub td { color: #9ca3af; font-size: 8pt; padding-left: 16pt; }
          .print-metrics { display: flex; gap: 10pt; margin-bottom: 14pt; }
          .print-metric { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6pt; padding: 8pt 10pt; text-align: center; }
          .print-metric-label { display: block; font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 2pt; }
          .print-metric-value { display: block; font-size: 12pt; font-weight: 800; color: #0f172a; }
          .print-trend-table { width: 100%; border-collapse: collapse; margin-bottom: 14pt; font-size: 8.5pt; }
          .print-trend-table th { background: #f1f5f9; text-align: left; padding: 5pt 8pt; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          .print-trend-table td { padding: 4pt 8pt; border-bottom: 1px solid #f1f5f9; }
          .print-trend-table .positive { color: #059669; font-weight: 700; }
          .print-trend-table .negative { color: #dc2626; font-weight: 700; }
          .print-trend-table .row-total td { border-top: 2px solid #94a3b8; font-weight: 800; }
          .print-footer { border-top: 1px solid #e2e8f0; padding-top: 8pt; margin-top: 14pt; text-align: center; font-size: 7pt; color: #94a3b8; }
        }
        .print-report { display: none; }
      `}</style>
      <div className="no-print space-y-6">

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Mənfəət/Zərər Hesabatı</h2>
          </div>
          <p className="text-xs text-gray-400 font-medium">P&L (Profit & Loss) — seçilmiş dövr ərzində gəlir, maya, xərc və xalis mənfəət analizi</p>
        </div>

        {/* Date Range + Budget */}
        <div className="flex flex-wrap items-end gap-2.5 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs glass">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Başlanğıc</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/50 w-36" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Son</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/50 w-36" />
          </div>
          <button onClick={() => refetch()}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 cursor-pointer transition-all shadow-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Hesabatı Yenilə
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer transition-all shadow-xs flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> PDF Export
          </button>
          <button onClick={() => { setEmailModalOpen(true); setEmailSent(false); setEmailAddress(""); }}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer transition-all shadow-xs flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> E-poçt Göndər
          </button>
        </div>

      {/* Budget Panel */}
      <div className="flex items-center justify-end no-print">
        <BudgetPanel periodKey={periodKey} onSave={handleBudgetSave} />
      </div>

      {isLoading ? (
        <div className="min-h-96 flex items-center justify-center bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 mx-auto animate-spin" />
            <span className="text-xs font-bold text-gray-400 block animate-pulse">P&L hesabatı toplanır...</span>
          </div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-red-600">Xəta: {(error as any)?.message || "Hesabat yüklənərkən xəta baş verdi"}</p>
        </div>
      ) : !data ? (
        <div className="text-center text-xs text-gray-400 py-16 bg-white rounded-3xl border border-gray-100 font-medium">
          Seçilmiş dövr üçün məlumat tapılmadı
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-in fade-in-20 duration-300">
            <StatCard title="Satış Gəliri" value={formatCurrency(data.summary.totalRevenue)}
              icon={<TrendingUp className="w-4 h-4" />} color="emerald"
              subtitle={`${data.summary.salesCount} satış`}
              budgetActual={data.summary.totalRevenue} budgetTarget={data.budget.revenue} budgetGoodIfOver={true}
              change={data.previousPeriod.change.revenue} />
            <StatCard title="Məhsul Mayası (COGS)" value={formatCurrency(data.summary.totalCOGS)}
              icon={<Boxes className="w-4 h-4" />} color="amber"
              subtitle={formatPercent(data.summary.grossMargin)}
              budgetActual={data.summary.totalCOGS} budgetTarget={data.budget.cogs} budgetGoodIfOver={false} />
            <StatCard title="Ümumi Mənfəət" value={formatCurrency(data.summary.grossProfit)}
              icon={<DollarSign className="w-4 h-4" />} color="indigo"
              subtitle={`Marja: ${formatPercent(data.summary.grossMargin)}`}
              budgetActual={data.summary.grossProfit} budgetTarget={data.budget.grossProfit} budgetGoodIfOver={true}
              change={data.previousPeriod.change.grossProfit} />
            <StatCard title="Əməliyyat Xərcləri" value={formatCurrency(data.summary.totalExpenses)}
              icon={<TrendingDown className="w-4 h-4" />} color="red"
              subtitle={`${Object.keys(data.summary.expenseByCategory).length} kateqoriya`}
              budgetActual={data.summary.totalExpenses} budgetTarget={data.budget.expenses} budgetGoodIfOver={false}
              change={data.previousPeriod.change.expenses} />
            <StatCard title="Xalis Mənfəət" value={formatCurrency(data.summary.netProfit)}
              icon={<Wallet className="w-4 h-4" />} color={data.summary.netProfit >= 0 ? "emerald" : "red"}
              subtitle={`Marja: ${formatPercent(data.summary.netMargin)}`}
              budgetActual={data.summary.netProfit} budgetTarget={data.budget.netProfit} budgetGoodIfOver={true}
              change={data.previousPeriod.change.netProfit} />
            <StatCard title="Orta Çek" value={formatCurrency(data.summary.avgTicket)}
              icon={<ShoppingBag className="w-4 h-4" />} color="blue"
              subtitle={`${formatCurrency(data.summary.avgProfitPerSale)} mənfəət/satış`} />
          </div>

          {/* Period Label */}
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 bg-white/50 px-4 py-2 rounded-xl border border-gray-100/50">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Hesabat dövrü: <span className="text-gray-700">{new Date(data.period.from).toLocaleDateString("az-AZ")}</span> — <span className="text-gray-700">{new Date(data.period.to).toLocaleDateString("az-AZ")}</span></span>
            <span className="text-gray-300 mx-1">|</span>
            <span>Ötən dövr: <span className="text-gray-700">{formatCurrency(data.previousPeriod.revenue)}</span></span>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
            {/* P&L Trend Chart */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-3 glass-card">
              <div className="mb-3">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Aylıq P&L Trendi</span>
                <h3 className="font-extrabold text-gray-900 text-sm mt-0.5">Gəlir, COGS və Xərc Axını</h3>
              </div>
              <PnLTrendChart data={data.monthlyTrend} />
            </div>

            {/* Expense Category Breakdown */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-2 glass-card">
              <div className="mb-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Xərc Bölgüsü</span>
                <h3 className="font-extrabold text-gray-900 text-sm mt-0.5">Kateqoriyalar üzrə Xərclər</h3>
              </div>
              <ExpenseCategoryChart data={data.summary.expenseByCategory} />
            </div>
          </div>

          {/* Margins Row */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs glass-card col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-gray-900 text-sm">Marja Göstəriciləri</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 font-semibold">Ümumi Marja</span>
                    <span className="font-black text-indigo-600 font-mono">{formatPercent(data.summary.grossMargin)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, data.summary.grossMargin)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 font-semibold">Xalis Marja</span>
                    <span className={`font-black font-mono ${data.summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPercent(data.summary.netMargin)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${data.summary.netProfit >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.max(2, Math.min(100, data.summary.netMargin))}%` }}></div>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-50">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400 font-medium">Xərc/Gəlir Nisbəti</span>
                    <span className="font-bold font-mono text-gray-700">
                      {data.summary.totalRevenue > 0 ? ((data.summary.totalExpenses / data.summary.totalRevenue) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-gray-400 font-medium">COGS/Gəlir Nisbəti</span>
                    <span className="font-bold font-mono text-gray-700">
                      {data.summary.totalRevenue > 0 ? ((data.summary.totalCOGS / data.summary.totalRevenue) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Comparison */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-2 glass-card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                <h3 className="font-extrabold text-gray-900 text-sm">Dövr Müqayisəsi</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="p-2.5 pl-0">Metrik</th>
                      <th className="p-2.5 text-right">Cari Dövr</th>
                      <th className="p-2.5 text-right">Əvvəlki Dövr</th>
                      <th className="p-2.5 text-right pr-0">Dəyişmə</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: "Gəlir", val: data.summary.totalRevenue, prev: data.previousPeriod.revenue, change: data.previousPeriod.change.revenue, color: "text-gray-900" },
                      { label: "Maya (COGS)", val: data.summary.totalCOGS, prev: data.previousPeriod.cogs, change: 0, color: "text-gray-700" },
                      { label: "Ümumi Mənfəət", val: data.summary.grossProfit, prev: data.previousPeriod.grossProfit, change: data.previousPeriod.change.grossProfit, color: "text-indigo-600 font-black" },
                      { label: "Xərclər", val: data.summary.totalExpenses, prev: data.previousPeriod.expenses, change: data.previousPeriod.change.expenses, color: "text-red-600" },
                      { label: "Xalis Mənfəət", val: data.summary.netProfit, prev: data.previousPeriod.netProfit, change: data.previousPeriod.change.netProfit, color: data.summary.netProfit >= 0 ? "text-green-600 font-black" : "text-red-600 font-black" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                        <td className={`p-2.5 pl-0 font-semibold ${row.color.includes("font-black") ? "font-black" : ""}`}>{row.label}</td>
                        <td className={`p-2.5 text-right font-mono font-bold ${row.color.split(" ")[0]}`}>{row.val.toFixed(2)} ₼</td>
                        <td className="p-2.5 text-right font-mono text-gray-400">{row.prev.toFixed(2)} ₼</td>
                        <td className="p-2.5 text-right pr-0">
                          {i > 0 && <ChangeBadge value={row.change} />}
                          {i === 0 && <ChangeBadge value={row.change} />}
                          {i === 1 && <span className="text-gray-300 text-[9px] font-bold">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed P&L Table */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs glass-card">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-gray-500" />
              <h3 className="font-extrabold text-gray-900 text-sm">Genişləndirilmiş P&L Cədvəli</h3>
            </div>
            <PnLTable data={data.summary} prev={data.previousPeriod} budget={data.budget} />
          </div>
        </>
      )}
      {/* Email Send Modal */}
      {emailModalOpen && (
        <div className="liquid-glass-overlay !z-100">
          <div className="liquid-glass-card max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg leading-tight flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" />
                {emailSent ? "Hesabat Göndərildi!" : "P&L Hesabatını Göndər"}
              </h3>
              <button onClick={() => { setEmailModalOpen(false); setEmailSent(false); }} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailSent ? (
              <div className="text-center py-8 space-y-4">
                <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-gray-900">Hesabat uğurla göndərildi!</p>
                <p className="text-xs text-gray-400">{emailAddress} ünvanına P&L hesabatı göndərildi.</p>
                <button onClick={() => { setEmailModalOpen(false); setEmailSent(false); }}
                  className="px-6 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-gray-800 cursor-pointer">
                  Bağla
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 font-medium mb-4">
                  Seçilmiş dövr ({new Date(fromDate).toLocaleDateString("az-AZ")} — {new Date(toDate).toLocaleDateString("az-AZ")}) üçün P&L hesabatını e-poçt ilə göndərin.
                </p>
                <div className="space-y-1 mb-5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block">E-poçt ünvanı</label>
                  <input type="email" placeholder="ornek@email.com" value={emailAddress}
                    onChange={e => setEmailAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30" />
                </div>
                <div className="flex gap-3 justify-end pt-3 border-t border-gray-50">
                  <button onClick={() => { setEmailModalOpen(false); setEmailSent(false); }}
                    className="px-4 py-2 border border-gray-200 text-gray-500 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
                    disabled={emailSending}>
                    Ləğv et
                  </button>
                  <button onClick={handleSendEmail}
                    disabled={!emailAddress || emailSending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    {emailSending ? "Göndərilir..." : "Göndər"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div> {/* end no-print */}
    </div>
  );
}
