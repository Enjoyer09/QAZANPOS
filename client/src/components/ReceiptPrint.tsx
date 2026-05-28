import { qzService } from "../lib/qz.ts";

export function generateReceiptHtml(sale: any, settings: any): string {
  const storeName = settings?.receiptHeader || settings?.storeName || "QAZAN POS";
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

  const saleIdStr = sale.id.toString().padStart(5, "0");
  const dateStr = new Date(sale.saleDate).toLocaleDateString("az-AZ") + " " + new Date(sale.saleDate).toLocaleTimeString("az-AZ", { hour: '2-digit', minute: '2-digit' });

  // Dynamically build items HTML
  let itemsHtml = "";
  if (sale.items && Array.isArray(sale.items)) {
    sale.items.forEach((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.salePrice) || 0;
      const name = item.productName || item.product?.name || "Məhsul";
      const unit = item.unit || item.product?.unit || "ədəd";
      const total = (qty * price).toFixed(2);
      itemsHtml += `
        <div class="item-row">
          <div class="item-name">${name}</div>
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
  let paymentDetailsHtml = `
    <table class="receipt-table">
      <tr>
        <td>Ödəniş Üsulu:</td>
        <td>${sale.paymentType}</td>
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
  if (sale.paymentStatus === "credit") {
    const totalAmount = parseFloat(sale.totalAmount) || 0;
    const totalPaid = parseFloat(sale.totalPaid) || 0;
    const remainingDebt = sale.remainingDebt !== undefined ? parseFloat(sale.remainingDebt) : null;
    const remaining = (remainingDebt !== null ? remainingDebt : (totalAmount - totalPaid)).toFixed(2);
    debtHtml = `
      <table class="receipt-table" style="color: #000000; font-weight: bold;">
        <tr>
          <td>Qalıq Borc:</td>
          <td>${remaining} ₼</td>
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
          padding: 2px;
          width: ${width === "58mm" ? "44mm" : "70mm"};
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
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page {
            margin: 0;
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
          ${(showStoreAddress === 1 && address) ? `${address}` : ""}
        </div>
      </div>
      ` : `
      <div class="text-center" style="font-size: 8.5pt; padding: 2px 0; font-weight: bold;">
        ${(showStorePhone === 1 && phone) ? `Əlaqə: ${phone}` : ""} ${(showStoreAddress === 1 && address) ? ` | Ünvan: ${address}` : ""}
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
        <table class="receipt-table" style="font-weight: bold; font-size: 11.5pt;">
          <tr>
            <td style="width: 60%; text-align: left; font-size: 11.5pt;">CƏMİ:</td>
            <td style="width: 40%; text-align: right; font-size: 11.5pt;">${(parseFloat(sale.totalAmount) || 0).toFixed(2)} ₼</td>
          </tr>
        </table>
        <table class="receipt-table">
          <tr>
            <td>Ödənilən:</td>
            <td>${(parseFloat(sale.totalPaid) || 0).toFixed(2)} ₼</td>
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
    console.log("QZ Tray not connected, attempting connection...");
    isQzConnected = await qzService.connect();
  }
  
  if (isQzConnected && savedPrinter) {
    try {
      console.log(`QZ Tray: Silent printing to ${savedPrinter}`);
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
