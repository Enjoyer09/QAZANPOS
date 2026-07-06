import { qzService } from "../lib/qz.ts";

export function generateReceiptHtml(sale: any, settings: any): string {
  const storeName = settings?.receiptHeader || settings?.storeName || "BirSaaS";
  const phone = settings?.phone || "";
  const address = settings?.address || "";
  const footerMessage = settings?.receiptFooter || "Bizi seçdiyiniz üçün təşəkkür edirik!";
  const width = settings?.receiptWidth || "80mm";
  const showBarcode = settings?.showBarcode ?? 1;
  const showCustomerInfo = settings?.showCustomerInfo ?? 1;
  const showStorePhone = settings?.showStorePhone ?? 1;
  const showStoreAddress = settings?.showStoreAddress ?? 1;
  const showReceiptHeader = settings?.showReceiptHeader ?? 1;
  const showReceiptFooter = settings?.showReceiptFooter ?? 1;
  const showPaymentDetails = settings?.showPaymentDetails ?? 1;

  // Azerbaijan Tax Compliance settings
  const voen = settings?.voen || "";
  const taxStatus = settings?.taxStatus || "";
  const edvRate = settings?.edvRate ?? 18.0;
  const simplifiedRate = settings?.simplifiedRate ?? 2.0;
  const showTaxOnReceipt = settings?.showTaxOnReceipt ?? 1;

  const saleIdStr = sale.id.toString().padStart(5, "0");
  const dateStr = new Date(sale.saleDate).toLocaleDateString("az-AZ") + " " + new Date(sale.saleDate).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });

  // Calculate totals dynamically and robustly
  const totalAmount = parseFloat(sale.totalAmount) || 0;
  const returnedAmount = (sale.returns || []).reduce(
    (sum: number, r: any) => sum + (parseFloat(r.totalAmount) || 0),
    0
  );
  const loyaltyDiscountPaid = parseFloat(sale.loyaltyDiscountPaid) || 0;
  const loyaltyPointsEarned = parseFloat(sale.loyaltyPointsEarned) || 0;
  const netAmount = totalAmount - returnedAmount;
  
  let totalPaid = parseFloat(sale.totalPaid);
  if (isNaN(totalPaid) || sale.totalPaid === undefined || sale.totalPaid === null) {
    if (sale.paymentStatus === "paid") {
      totalPaid = totalAmount;
    } else {
      totalPaid = sale.payments && Array.isArray(sale.payments)
        ? sale.payments.reduce((acc: number, p: any) => acc + (parseFloat(p.amount) || 0), 0)
        : 0;
    }
  }

  const isCredit = sale.paymentStatus === "credit" || sale.paymentType === "Nisyə";
  let remainingDebt = 0;
  if (isCredit) {
    const customRemaining = sale.remainingDebt !== undefined && sale.remainingDebt !== null 
      ? parseFloat(sale.remainingDebt) 
      : null;
    remainingDebt = customRemaining !== null ? customRemaining : Math.max(0, totalAmount - totalPaid - returnedAmount);
  }

  // Azerbaijan Tax calculations
  let taxDetailsHtml = "";
  if (showTaxOnReceipt === 1 && taxStatus) {
    if (taxStatus === "edv") {
      if (sale.applyEdv !== 0) {
        const vatVal = (netAmount * edvRate) / (100 + edvRate);
        taxDetailsHtml = `
          <table class="receipt-table" style="font-size: 8.5pt; color: #333333; margin-top: 2px;">
            <tr>
              <td>ƏDV (${edvRate}% daxil):</td>
              <td>${vatVal.toFixed(2)} ₼</td>
            </tr>
          </table>
        `;
      } else {
        taxDetailsHtml = `
          <table class="receipt-table" style="font-size: 8.5pt; color: #555555; margin-top: 2px; font-style: italic;">
            <tr>
              <td>Vergi Rejimi:</td>
              <td>ƏDV-siz (Azad)</td>
            </tr>
          </table>
        `;
      }
    } else if (taxStatus === "sadelestirilmis") {
      const simplifiedVal = (netAmount * simplifiedRate) / 100;
      taxDetailsHtml = `
        <table class="receipt-table" style="font-size: 8.5pt; color: #333333; margin-top: 2px;">
          <tr>
            <td>Sadələşdirilmiş V. (${simplifiedRate}%):</td>
            <td>${simplifiedVal.toFixed(2)} ₼</td>
          </tr>
        </table>
      `;
    }
  }

  // Dynamically build items HTML
  let itemsHtml = "";
  if (sale.items && Array.isArray(sale.items)) {
    sale.items.forEach((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.salePrice) || 0;
      const name = item.productName || item.product?.name || "Məhsul";
      const unit = item.unit || item.product?.unit || "ədəd";
      const total = (qty * price).toFixed(2);
      
      const itemSerials = (sale.serials || []).filter((s: any) => s.productId === item.productId);
      const serialsHtml = itemSerials.length > 0
        ? `<div style="font-size: 7.5pt; font-family: monospace; color: #444444; margin-top: 1px; font-weight: bold;">S/N: ${itemSerials.map((s: any) => s.serialNumber).join(", ")}</div>`
        : "";

      const getWarrantyExpiryString = (saleDateStr: string, months: number) => {
        if (!saleDateStr || !months) return null;
        const d = new Date(saleDateStr);
        if (isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + months);
        
        // Format as DD.MM.YYYY
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
      };

      const warrantyMonths = item.product?.warrantyMonths;
      const warrantyExpiry = getWarrantyExpiryString(sale.saleDate, warrantyMonths);
      const warrantyHtml = warrantyExpiry
        ? `<div style="font-size: 7.5pt; font-family: monospace; color: #000000; margin-top: 1px; font-weight: bold;">Zəmanət: ${warrantyMonths} ay (Bitmə: ${warrantyExpiry})</div>`
        : "";

      itemsHtml += `
        <div class="item-row">
          <div class="item-name">${name}</div>
          ${serialsHtml}
          ${warrantyHtml}
          <table class="receipt-table" style="font-size: 8.5pt;">
            <tr>
              <td style="width: 65%; text-align: left; font-size: 8.5pt; padding: 1px 0;">${qty} ${unit} x ${price.toFixed(2)} ₼</td>
              <td style="width: 35%; text-align: right; font-weight: bold; font-family: monospace; font-size: 8.5pt; padding: 1px 0;">${total} ₼</td>
            </tr>
          </table>
        </div>
      `;
    });
  }

  // Dynamic Payment info
  const displayPaymentType = sale.paymentType === "Kart" && sale.bankName
    ? `${sale.paymentType} (${sale.bankName})`
    : sale.paymentType;

  let paymentDetailsHtml = `
    <table class="receipt-table">
      <tr>
        <td>Ödəniş Üsulu:</td>
        <td>${displayPaymentType}</td>
      </tr>
    </table>
  `;

  if (sale.paymentStatus === "credit") {
    paymentDetailsHtml += `
      <table class="receipt-table">
        <tr style="color: #000000;">
          <td>Ödəniş Statusu:</td>
          <td style="font-weight: bold;">Nisyə (Ödənilməyib)</td>
        </tr>
      </table>
    `;
    if (sale.creditDueDate) {
      paymentDetailsHtml += `
        <table class="receipt-table">
          <tr style="color: #000000;">
            <td>Ödəniş Tarixi:</td>
            <td>${new Date(sale.creditDueDate).toLocaleDateString("az-AZ")}</td>
          </tr>
        </table>
      `;
    }
  } else {
    paymentDetailsHtml += `
      <table class="receipt-table">
        <tr>
          <td>Ödəniş Statusu:</td>
          <td style="font-weight: bold;">Ödənilib</td>
        </tr>
      </table>
    `;
  }

  // Debt details if applicable
  let debtHtml = "";
  if (isCredit) {
    debtHtml = `
      <table class="receipt-table" style="color: #000000; font-weight: bold;">
        <tr>
          <td>Qalıq Borc:</td>
          <td>${remainingDebt.toFixed(2)} ₼</td>
        </tr>
      </table>
    `;
  }

  // Customer block
  let customerHtml = "";
  if (showCustomerInfo === 1 && (sale.customerName || sale.customerId)) {
    customerHtml = `
      <div style="border-top: 1px dashed #000000; margin-top: 4px; padding-top: 4px;">
        <table class="receipt-table">
          <tr>
            <td>Müştəri:</td>
            <td style="font-weight: bold;">${sale.customerName || "Seçilməyib"}</td>
          </tr>
        </table>
      </div>
      ${(sale.customerPhone && showStorePhone === 1) ? `
      <table class="receipt-table">
        <tr>
          <td>Telefon:</td>
          <td>${sale.customerPhone}</td>
        </tr>
      </table>
      ` : ""}
    `;
  }

  // Dynamic Barcode SVG
  let barcodeHtml = "";
  if (showBarcode === 1) {
    const text = `QZ-${saleIdStr}`;
    let x = 15;
    const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const pattern = [1, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 1, 2, 3, 1, 1, 2, 1, 1, 3, 1, 2, 1, 1];
    let barcodeLines = "";
    
    for (let i = 0; i < 40; i++) {
      const w = pattern[(hash + i) % pattern.length];
      if (i % 2 === 0) {
        barcodeLines += `<rect x="${x}" y="2" width="${w}" height="22" />`;
      }
      x += w + 1;
    }

    barcodeHtml = `
      <div class="barcode-container">
        <svg width="150" height="32" viewBox="0 0 150 32" xmlns="http://www.w3.org/2000/svg">
          <rect width="150" height="32" fill="#ffffff"/>
          <g fill="#000000">
            ${barcodeLines}
          </g>
          <text x="75" y="30" font-family="monospace" font-size="7" font-weight="bold" text-anchor="middle">${text}</text>
        </svg>
      </div>
    `;
  }

  // Construct complete clean HTML document for thermal print output
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Çek - № ${saleIdStr}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: "Courier New", Courier, monospace, system-ui, sans-serif;
          font-size: 9.5pt;
          line-height: 1.4;
          color: #000000;
          background-color: #ffffff;
          padding: 2px 4mm 20px 4mm;
          width: ${width === "58mm" ? "40mm" : "64mm"};
          margin: 0 auto;
        }
        .text-center {
          text-align: center;
        }
        .bold {
          font-weight: bold;
        }
        .header-title {
          font-size: 13pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }
        .header-meta {
          font-size: 8.5pt;
          color: #333333;
          margin-bottom: 4px;
        }
        .divider {
          border-top: 1px dashed #000000;
          margin: 6px 0;
        }
        .pt-1 {
          padding-top: 4px;
        }
        .item-row {
          margin-bottom: 6px;
          width: 100%;
        }
        .item-name {
          font-weight: bold;
          word-break: break-all;
          display: block;
          width: 100%;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2px;
        }
        .receipt-table td {
          padding: 1px 0;
          vertical-align: top;
          font-size: 9.5pt;
          color: #000000;
        }
        .receipt-table td:first-child {
          text-align: left;
          width: 60%;
        }
        .receipt-table td:last-child {
          text-align: right;
          width: 40%;
        }
        .total-box {
          border-top: 1px dashed #000000;
          padding-top: 4px;
          margin-top: 6px;
          width: 100%;
        }
        .grand-total {
          font-size: 11.5pt;
          font-weight: 900;
        }
        .barcode-container {
          text-align: center;
          margin: 10px auto 6px auto;
          width: 100%;
        }
        .barcode-container svg {
          display: inline-block;
        }
        .footer-message {
          font-size: 8.5pt;
          text-align: center;
          font-style: italic;
          margin-top: 8px;
          line-height: 1.3;
        }
        @media print {
          body {
            width: ${width === "58mm" ? "40mm" : "64mm"};
            padding: 2px 4mm 20px 4mm;
            margin: 0 auto;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      ${showReceiptHeader === 1 ? `
      <div class="text-center">
        <h1 class="header-title">${storeName}</h1>
        <div class="header-meta">
          ${(showStorePhone === 1 && phone) ? `Əlaqə: ${phone}<br/>` : ""}
          ${(showStoreAddress === 1 && address) ? `${address}<br/>` : ""}
          ${(showTaxOnReceipt === 1 && voen) ? `VÖEN: ${voen}<br/>` : ""}
          ${(showTaxOnReceipt === 1 && taxStatus) ? `Vergi Rejimi: ${taxStatus === "edv" ? "ƏDV Ödəyicisi" : taxStatus === "sadelestirilmis" ? "Sadələşdirilmiş vergi" : taxStatus === "gelir" ? "Gəlir/Mənfəət" : "Vergidən Azad"}<br/>` : ""}
        </div>
      </div>
      ` : `
      <div class="text-center" style="font-size: 8.5pt; padding: 2px 0; font-weight: bold;">
        ${(showStorePhone === 1 && phone) ? `Əlaqə: ${phone}` : ""} ${(showStoreAddress === 1 && address) ? ` | Ünvan: ${address}` : ""}
        ${(showTaxOnReceipt === 1 && voen) ? ` | VÖEN: ${voen}` : ""}
      </div>
      `}

      <div class="divider"></div>

      <!-- Info Block -->
      <table class="receipt-table">
        <tr>
          <td>Qaimə №:</td>
          <td style="font-weight: bold;">${saleIdStr}</td>
        </tr>
      </table>
      <table class="receipt-table">
        <tr>
          <td>Tarix:</td>
          <td>${dateStr}</td>
        </tr>
      </table>
      
      ${customerHtml}

      <div class="divider"></div>

      <!-- Listing Header -->
      <table class="receipt-table" style="font-weight: bold; font-size: 9pt; margin-bottom: 4px;">
        <tr>
          <td style="width: 60%; text-align: left; font-size: 9pt;">Məhsul</td>
          <td style="width: 40%; text-align: right; font-size: 9pt;">Məbləğ</td>
        </tr>
      </table>

      <!-- Listing Items -->
      <div class="items-list">
        ${itemsHtml}
      </div>

      <!-- Totals -->
      <div class="total-box">
        ${returnedAmount > 0 ? `
        <table class="receipt-table" style="font-size: 8.5pt; color: #444444; margin-bottom: 2px;">
          <tr>
            <td>İlkin Məbləğ:</td>
            <td style="text-align: right; font-family: monospace;">${totalAmount.toFixed(2)} ₼</td>
          </tr>
          <tr>
            <td>Geri Qaytarılan:</td>
            <td style="text-align: right; font-family: monospace; color: #883333;">-${returnedAmount.toFixed(2)} ₼</td>
          </tr>
        </table>
        ` : ""}
        <table class="receipt-table" style="font-weight: bold; font-size: 11.5pt;">
          <tr>
            <td style="width: 60%; text-align: left; font-size: 11.5pt;">CƏMİ:</td>
            <td style="width: 40%; text-align: right; font-size: 11.5pt;">${netAmount.toFixed(2)} ₼</td>
          </tr>
        </table>
        ${loyaltyDiscountPaid > 0 ? `
        <table class="receipt-table" style="font-size: 8.5pt; color: #047857; margin-bottom: 2px;">
          <tr>
            <td>Bonus Güzəşti:</td>
            <td style="text-align: right; font-family: monospace;">-${loyaltyDiscountPaid.toFixed(2)} ₼</td>
          </tr>
        </table>
        ` : ""}
        ${loyaltyPointsEarned > 0 ? `
        <table class="receipt-table" style="font-size: 8.5pt; color: #b45309; margin-bottom: 2px;">
          <tr>
            <td>🎁 Qazanilan Bonus:</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold;">+${loyaltyPointsEarned.toFixed(2)} bal</td>
          </tr>
        </table>
        ` : ""}
        ${taxDetailsHtml}
        <table class="receipt-table">
          <tr>
            <td>Ödənilən:</td>
            <td>${Math.max(0, totalPaid - returnedAmount).toFixed(2)} ₼</td>
          </tr>
        </table>
        ${debtHtml}
      </div>

      <div class="divider"></div>

      <!-- Payment details -->
      ${showPaymentDetails === 1 ? `
      <div class="payment-info">
        ${paymentDetailsHtml}
        ${sale.notes ? `
          <table class="receipt-table" style="font-size: 8.5pt; font-style: italic;">
            <tr>
              <td>Qeyd:</td>
              <td>${sale.notes}</td>
            </tr>
          </table>
        ` : ""}
      </div>
      <div class="divider"></div>
      ` : ""}

      <!-- Barcode -->
      ${barcodeHtml}

      <!-- Footer Message -->
      ${(showReceiptFooter === 1 && footerMessage) ? `
      <div class="footer-message">
        ${footerMessage}
      </div>
      ` : ""}
    </body>
    </html>
  `;
}

export async function printReceipt(sale: any, settings: any): Promise<boolean> {
  const html = generateReceiptHtml(sale, settings);
  const width = settings?.receiptWidth || "80mm";
  
  const savedPrinter = localStorage.getItem("qazan_pos_selected_printer");
  
  // Try to connect to QZ Tray if not connected yet
  let isQzConnected = qzService.isConnected();
  if (!isQzConnected) {
    console.info("QZ Tray not connected, attempting connection...");
    isQzConnected = await qzService.connect();
  }
  
  if (isQzConnected && savedPrinter) {
    try {
      console.info(`QZ Tray: Silent printing to ${savedPrinter}`);
      await qzService.printHTML(savedPrinter, html, { width });
      return true;
    } catch (err) {
      console.error("QZ print failed, falling back to standard browser print...", err);
    }
  }
  
  // Fallback to standard browser print via hidden isolation iframe
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        resolve(false);
        return;
      }
      
      doc.open();
      doc.write(html);
      doc.close();
      
      // Give it standard render frame buffer allowance
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          resolve(true);
        } catch (e) {
          console.error("Iframe print action block error", e);
          resolve(false);
        }
      }, 300);
    } catch (err) {
      console.error("Standard browser printing fallback failure", err);
      resolve(false);
    }
  });
}

export function generateZReportHtml(stats: any, settings: any): string {
  const storeName = settings?.receiptHeader || settings?.storeName || "BirSaaS";
  const phone = settings?.phone || "";
  const address = settings?.address || "";
  const width = settings?.receiptWidth || "80mm";
  
  const shift = stats.shift;
  const openedAtStr = new Date(shift.openedAt).toLocaleDateString("az-AZ") + " " + new Date(shift.openedAt).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });
  const closedAtStr = new Date(shift.closedAt).toLocaleDateString("az-AZ") + " " + new Date(shift.closedAt).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: auto; margin: 0mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${width};
            margin: 0;
            padding: 5mm;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header { font-size: 11pt; line-height: 1.4; margin-bottom: 5px; text-transform: uppercase; }
          .divider { border-top: 1px dashed #000000; margin: 8px 0; }
          .item-row { display: flex; justify-content: space-between; font-size: 9pt; line-height: 1.5; }
          .title { font-size: 12pt; font-weight: bold; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="center header">
          <span class="title">${storeName}</span><br>
          ${address ? `<span>${address}</span><br>` : ""}
          ${phone ? `<span>Tel: ${phone}</span><br>` : ""}
        </div>
        <div class="divider"></div>
        <div class="center bold header">Z-HESABATI (NÖVBƏ SONU)</div>
        <div class="item-row">
          <span>Növbə No:</span>
          <span>#${shift.id}</span>
        </div>
        <div class="item-row">
          <span>Kassir:</span>
          <span>${shift.cashierName}</span>
        </div>
        <div class="item-row">
          <span>Açılış:</span>
          <span>${openedAtStr}</span>
        </div>
        <div class="item-row">
          <span>Bağlanış:</span>
          <span>${closedAtStr}</span>
        </div>
        <div class="divider"></div>
        <div class="item-row bold">
          <span>Giriş Nağd:</span>
          <span>${Number(stats.stats.openingCash).toFixed(2)} ₼</span>
        </div>
        <div class="item-row">
          <span>Nağd Satış (+):</span>
          <span>${Number(stats.stats.cashSalesAmount).toFixed(2)} ₼</span>
        </div>
        <div class="item-row">
          <span>Nağd Qaytarış (-):</span>
          <span>${Number(stats.stats.cashReturnsAmount).toFixed(2)} ₼</span>
        </div>
        <div class="item-row">
          <span>Nağd Xərc (-):</span>
          <span>${Number(stats.stats.cashExpensesAmount).toFixed(2)} ₼</span>
        </div>
        <div class="divider"></div>
        <div class="item-row bold">
          <span>Gözlənilən Nağd:</span>
          <span>${Number(stats.stats.expectedCash).toFixed(2)} ₼</span>
        </div>
        <div class="item-row bold">
          <span>Sayılan Nağd:</span>
          <span>${Number(stats.stats.actualCash).toFixed(2)} ₼</span>
        </div>
        <div class="divider"></div>
        <div class="item-row bold">
          <span>Fərq (Artıq/Kəsir):</span>
          <span>${stats.stats.variance >= 0 ? "+" : ""}${Number(stats.stats.variance).toFixed(2)} ₼</span>
        </div>
        <div class="divider"></div>
        <div class="center bold" style="font-size: 8pt; margin-top: 10px;">
          BirSaaS Kassa Sistemi.
        </div>
      </body>
    </html>
  `;
}

export async function printZReport(stats: any, settings: any): Promise<boolean> {
  const html = generateZReportHtml(stats, settings);
  const width = settings?.receiptWidth || "80mm";
  
  const savedPrinter = localStorage.getItem("qazan_pos_selected_printer");
  let isQzConnected = qzService.isConnected();
  if (!isQzConnected) {
    isQzConnected = await qzService.connect();
  }
  
  if (isQzConnected && savedPrinter) {
    try {
      await qzService.printHTML(savedPrinter, html, { width });
      return true;
    } catch (err) {
      console.error("QZ print failed, falling back to standard browser print...", err);
    }
  }
  
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        resolve(false);
        return;
      }
      
      doc.open();
      doc.write(html);
      doc.close();
      
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          resolve(true);
        } catch {
          resolve(false);
        }
      }, 300);
    } catch {
      resolve(false);
    }
  });
}

export function printPickTicket(basketItems: any[], userLabel: string): Promise<boolean> {
  const dateStr = new Date().toLocaleDateString("az-AZ") + " " + new Date().toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });
  
  let itemsRows = "";
  basketItems.forEach((item, idx) => {
    const name = item.productName || "Məhsul";
    const qty = item.quantity;
    const unit = item.unit || "ədəd";
    const serials = item.serialNumbers && item.serialNumbers.length > 0
      ? `<div style="font-size: 7.5pt; color: #555; margin-top: 2px;">IMEI/Serial: ${item.serialNumbers.join(", ")}</div>`
      : "";
      
    itemsRows += `
      <tr style="border-bottom: 1px dashed #dddddd;">
        <td style="padding: 6px 0; text-align: left; font-size: 9pt;">
          <b>${idx + 1}. ${name}</b>
          ${serials}
        </td>
        <td style="padding: 6px 0; text-align: right; font-size: 10pt; font-weight: bold; font-family: monospace;">
          ${qty} ${unit}
        </td>
      </tr>
    `;
  });

  const html = `
    <html>
      <head>
        <title>Pick Ticket</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 80mm;
            margin: 0;
            padding: 5mm;
            background: #ffffff;
            color: #000000;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .title {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .warning {
            font-size: 8pt;
            border: 1px solid #000000;
            padding: 4px;
            margin-top: 4px;
            display: inline-block;
            font-weight: bold;
          }
          .info-table {
            width: 100%;
            font-size: 8.5pt;
            margin-bottom: 10px;
            border-bottom: 1px solid #000000;
            padding-bottom: 5px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
          }
          .footer {
            margin-top: 15px;
            border-top: 1px solid #000000;
            padding-top: 8px;
            text-align: center;
            font-size: 8pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ANBAR YIĞIM BİLETİ</div>
          <div class="warning">MALİYYƏ SƏNƏDİ DEYİL</div>
        </div>
        <table class="info-table">
          <tr>
            <td align="left">Tarix:</td>
            <td align="right">${dateStr}</td>
          </tr>
          ${userLabel ? `
          <tr>
            <td align="left">Etiket / Masa:</td>
            <td align="right"><b>${userLabel}</b></td>
          </tr>
          ` : ""}
        </table>
        <table class="items-table">
          <thead>
            <tr style="border-bottom: 1px solid #000000;">
              <th align="left" style="font-size: 8.5pt; padding-bottom: 4px;">Məhsul adı</th>
              <th align="right" style="font-size: 8.5pt; padding-bottom: 4px;">Miqdar</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <div class="footer">
          QAZANPOS • Anbar Bölməsi
        </div>
      </body>
    </html>
  `;

  const savedPrinter = localStorage.getItem("qazan_pos_selected_printer");
  let isQzConnected = qzService.isConnected();

  return new Promise(async (resolve) => {
    if (!isQzConnected) {
      try { isQzConnected = await qzService.connect(); } catch {}
    }

    if (isQzConnected && savedPrinter) {
      try {
        await qzService.printHTML(savedPrinter, html, { width: "80mm" });
        resolve(true);
        return;
      } catch (err) {
        console.error("QZ print failed for Pick Ticket, falling back to standard browser print...", err);
      }
    }

    // Fallback to standard browser printing via hidden iframe
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        resolve(false);
        return;
      }
      
      doc.open();
      doc.write(html);
      doc.close();
      
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          resolve(true);
        } catch {
          resolve(false);
        }
      }, 300);
    } catch {
      resolve(false);
    }
  });
}
