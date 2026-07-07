import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "QAZANPOS <noreply@qazanpos.az>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  tenantId: number;
}

/**
 * Send an email via Resend API
 */
export async function sendEmail({ to, subject, html, tenantId }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!RESEND_API_KEY) {
      return { success: false, error: "RESEND_API_KEY təyin edilməyib" };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (res.ok && data.id) {
      return { success: true };
    } else {
      return { success: false, error: data.message || data.error || "E-poçt göndərilmədi" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "E-poçt göndərilərkən xəta" };
  }
}

/**
 * Generate HTML for the P&L report email
 */
export function generatePnlEmailHtml(data: any): string {
  const formatCurrency = (val: number) => `${(val || 0).toFixed(2)} ₼`;
  const formatPercent = (val: number) => `${(val || 0).toFixed(1)}%`;

  const renderTrendTable = () => {
    if (!data.monthlyTrend || data.monthlyTrend.length === 0) return "";
    return `
      <h3 style="margin: 16px 0 8px; color: #0f172a; font-size: 13px;">Aylıq Trend</h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Ay</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Gəlir</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">COGS</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Xərc</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Mənfəət</th>
        </tr></thead>
        <tbody>
          ${data.monthlyTrend.map((m: any) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${m.month}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(m.revenue)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(m.cogs)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(m.expenses)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;${m.profit >= 0 ? 'color:#059669;' : 'color:#dc2626;'}">${formatCurrency(m.profit)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  };

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f8fafc;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <div style="border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
      <h1 style="font-size:20px;font-weight:900;margin:0;color:#0f172a;">Mənfəət/Zərər Hesabatı</h1>
      <h2 style="font-size:12px;font-weight:600;margin:4px 0 0;color:#64748b;">P&L (Profit & Loss) Report</h2>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:8px;">
        <span>Dövr: ${new Date(data.period.from).toLocaleDateString("az-AZ")} — ${new Date(data.period.to).toLocaleDateString("az-AZ")}</span>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Göstərici</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Cari Dövr</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Büdcə</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9px;text-transform:uppercase;">Fərq</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#059669;">Satış Gəliri</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.summary.totalRevenue)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.budget.revenue)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${data.budget.variance.revenue.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;color:#6b7280;">Məhsul Mayası (COGS)</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.summary.totalCOGS)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.budget.cogs)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${data.budget.variance.cogs.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:800;border-top:2px solid #cbd5e1;color:#6366f1;">Ümumi Mənfəət</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:800;">${formatCurrency(data.summary.grossProfit)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.budget.grossProfit)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${data.budget.variance.grossProfit.toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;color:#dc2626;">Əməliyyat Xərcləri</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.summary.totalExpenses)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.budget.expenses)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${data.budget.variance.expenses.toFixed(1)}%</td>
        </tr>
        ${Object.entries(data.summary.expenseByCategory || {}).map(([cat, amt]) => `
        <tr>
          <td style="padding:2px 8px;padding-left:16px;color:#9ca3af;font-size:10px;">└ ${cat}</td>
          <td style="padding:2px 8px;text-align:right;color:#9ca3af;font-size:10px;">${formatCurrency(amt as number)}</td>
          <td style="padding:2px 8px;text-align:right;color:#9ca3af;font-size:10px;">—</td>
          <td style="padding:2px 8px;text-align:right;color:#9ca3af;font-size:10px;">—</td>
        </tr>`).join("")}
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:800;border-top:2px solid #cbd5e1;${data.summary.netProfit >= 0 ? 'color:#059669;' : 'color:#dc2626;'}">Xalis Mənfəət</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:800;">${formatCurrency(data.summary.netProfit)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(data.budget.netProfit)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${data.budget.variance.netProfit.toFixed(1)}%</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
        <span style="display:block;font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5pt;">Ümumi Marja</span>
        <span style="display:block;font-size:14px;font-weight:800;color:#0f172a;">${formatPercent(data.summary.grossMargin)}</span>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
        <span style="display:block;font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5pt;">Xalis Marja</span>
        <span style="display:block;font-size:14px;font-weight:800;color:#0f172a;">${formatPercent(data.summary.netMargin)}</span>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
        <span style="display:block;font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5pt;">Satış Sayı</span>
        <span style="display:block;font-size:14px;font-weight:800;color:#0f172a;">${data.summary.salesCount}</span>
      </div>
    </div>

    ${renderTrendTable()}

    <div style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:16px;text-align:center;font-size:8px;color:#94a3b8;">
      <p>QAZANPOS — P&L Hesabatı | Avtomatik yaradılmışdır</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Generate a text summary of the P&L report for the email body
 */
export function generatePnlTextSummary(data: any): string {
  const lines = [
    "=== MƏNFƏƏT/ZƏRƏR HESABATI ===",
    `Dövr: ${new Date(data.period.from).toLocaleDateString("az-AZ")} — ${new Date(data.period.to).toLocaleDateString("az-AZ")}`,
    "",
    `Satış Gəliri: ${data.summary.totalRevenue.toFixed(2)} ₼`,
    `Məhsul Mayası: ${data.summary.totalCOGS.toFixed(2)} ₼`,
    `Ümumi Mənfəət: ${data.summary.grossProfit.toFixed(2)} ₼`,
    `Əməliyyat Xərcləri: ${data.summary.totalExpenses.toFixed(2)} ₼`,
    `Xalis Mənfəət: ${data.summary.netProfit.toFixed(2)} ₼`,
    `Ümumi Marja: ${data.summary.grossMargin.toFixed(1)}%`,
    `Xalis Marja: ${data.summary.netMargin.toFixed(1)}%`,
    `Satış Sayı: ${data.summary.salesCount}`,
    `Orta Çek: ${data.summary.avgTicket.toFixed(2)} ₼`,
    "",
    "QAZANPOS — P&L Hesabatı",
  ];
  return lines.join("\n");
}
