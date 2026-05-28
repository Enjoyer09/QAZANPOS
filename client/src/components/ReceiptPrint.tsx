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
          <div class="item-details">
            <span>${qty} ${unit} x ${price.toFixed(2)} ₼</span>
            <span class="item-total">${total} ₼</span>
          </div>
        </div>
      `;
    });
  }

  // Dynamic Payment info
  let paymentDetailsHtml = `
    <div class="flex-row">
      <span>Ödəniş Üsulu:</span>
      <span>${sale.paymentType}</span>
    </div>
  `;

  if (sale.paymentStatus === "credit") {
    paymentDetailsHtml += `
      <div class="flex-row text-red">
        <span>Ödəniş Statusu:</span>
        <span class="bold">Nisyə (Ödənilməyib)</span>
      </div>
    `;
    if (sale.creditDueDate) {
      paymentDetailsHtml += `
        <div class="flex-row text-red">
          <span>Ödəniş Tarixi:</span>
          <span>${new Date(sale.creditDueDate).toLocaleDateString("az-AZ")}</span>
        </div>
      `;
    }
  } else {
    paymentDetailsHtml += `
      <div class="flex-row">
        <span>Ödəniş Statusu:</span>
        <span class="bold text-green">Ödənilib</span>
      </div>
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
      <div class="flex-row text-red bold font-medium">
        <span>Qalıq Borc:</span>
        <span>${remaining} ₼</span>
      </div>
    `;
  }

  // Customer block
  let customerHtml = "";
  if (showCustomerInfo === 1 && (sale.customerName || sale.customerId)) {
    customerHtml = `
      <div class="flex-row border-top-dash pt-1">
        <span>Müştəri:</span>
        <span class="bold">${sale.customerName || "Seçilməyib"}</span>
      </div>
      ${(sale.customerPhone && showStorePhone === 1) ? `
      <div class="flex-row">
        <span>Telefon:</span>
        <span>${sale.customerPhone}</span>
      </div>
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
        .flex-row {
          width: 100%;
          margin-bottom: 2px;
          white-space: nowrap;
        }
        .flex-row span:first-child {
          display: inline-block;
          width: 60%;
          text-align: left;
          vertical-align: top;
          white-space: normal;
        }
        .flex-row span:last-child {
          display: inline-block;
          width: 40%;
          text-align: right;
          vertical-align: top;
          font-weight: bold;
        }
        .pt-1 {
          padding-top: 4px;
        }
        .border-top-dash {
          border-top: 1px dashed #000000;
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
        .item-details {
          display: block;
          width: 100%;
          font-size: 8.5pt;
          padding-left: 4px;
          white-space: nowrap;
        }
        .item-details span:first-child {
          display: inline-block;
          width: 60%;
          text-align: left;
          vertical-align: top;
        }
        .item-details span:last-child {
          display: inline-block;
          width: 40%;
          text-align: right;
          vertical-align: top;
          font-weight: bold;
          font-family: monospace;
        }
        .item-total {
          font-weight: bold;
          font-family: monospace;
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
        .text-red {
          color: #000000; /* Force black for maximum contrast on thermal printers */
        }
        .text-green {
          color: #000000;
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
      <div class="flex-row">
        <span>Qaimə №:</span>
        <span class="bold">${saleIdStr}</span>
      </div>
      <div class="flex-row">
        <span>Tarix:</span>
        <span>${dateStr}</span>
      </div>
      
      ${customerHtml}

      <div class="divider"></div>

      <!-- Listing Header -->
      <div class="flex-row bold" style="font-size: 9pt; margin-bottom: 4px;">
        <span>Məhsul</span>
        <span>Məbləğ</span>
      </div>

      <!-- Listing Items -->
      <div class="items-list">
        ${itemsHtml}
      </div>

      <!-- Totals -->
      <div class="total-box">
        <div class="flex-row grand-total">
          <span>CƏMİ:</span>
          <span>${(parseFloat(sale.totalAmount) || 0).toFixed(2)} ₼</span>
        </div>
        <div class="flex-row">
          <span>Ödənilən:</span>
          <span>${(parseFloat(sale.totalPaid) || 0).toFixed(2)} ₼</span>
        </div>
        ${debtHtml}
      </div>

      <div class="divider"></div>

      <!-- Payment details -->
      ${showPaymentDetails === 1 ? `
      <div class="payment-info">
        ${paymentDetailsHtml}
        ${sale.notes ? `
          <div class="flex-row pt-1" style="font-size: 8.5pt; font-style: italic;">
            <span>Qeyd:</span>
            <span>${sale.notes}</span>
          </div>
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
