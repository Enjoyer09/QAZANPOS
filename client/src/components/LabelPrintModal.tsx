import React, { useState } from "react";
import { X, Printer, Eye } from "lucide-react";
import Barcode from "./Barcode.tsx";

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  description: string | null;
  barcode: string | null;
}

interface LabelPrintModalProps {
  product: Product;
  storeName?: string;
  onClose: () => void;
}

export default function LabelPrintModal({
  product,
  storeName = "BirSaaS Store",
  onClose
}: LabelPrintModalProps) {
  const [format, setFormat] = useState<"a4" | "thermal">("a4");
  const [quantity, setQuantity] = useState(format === "a4" ? 24 : 1);
  const [customPrice, setCustomPrice] = useState("");
  const [barcodeOverride] = useState(product.barcode || "2000000000000");

  const displayPrice = customPrice !== "" ? parseFloat(customPrice) : 0; // Fallback to 0 or we can fetch a real price if they enter it.
  // Wait! Let's get the active price. Since products table does not have price, the price is in stockEntries or we can support entering a price for label printing!
  // In QazanPOS, products don't store prices directly; prices are set at stock entry / sale time. This is a common setup in wholesale POS.
  // So allowing the user to enter a custom price for the label is an absolutely crucial, perfect feature! If they don't enter one, it defaults to a placeholder like "0.00" or they can type the current selling price.
  // Let's add a clear input for "Etiket Qiyməti (AZN)" so they can print the exact price they want!

  const handleFormatChange = (newFormat: "a4" | "thermal") => {
    setFormat(newFormat);
    setQuantity(newFormat === "a4" ? 24 : 1);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Generate label HTML blocks
    let labelsHTML = "";
    for (let i = 0; i < quantity; i++) {
      labelsHTML += `
        <div class="label-card">
          <div class="store-name">${storeName}</div>
          <div class="product-name">${product.name}</div>
          <div class="barcode-wrapper">
            <!-- Render custom EAN-13 modules as pure CSS/HTML bars for perfect offline styling inside new window -->
            <div class="barcode-svg-container">
              ${document.getElementById("preview-barcode-container")?.innerHTML || ""}
            </div>
          </div>
          <div class="price-badge">${Number(displayPrice).toFixed(2)} AZN</div>
        </div>
      `;
    }

    // Layout-specific styling
    const styles = format === "a4" 
      ? `
        body {
          margin: 0;
          padding: 8mm 5mm;
          font-family: 'Inter', -apple-system, sans-serif;
          background: #fff;
        }
        .labels-grid {
          display: grid;
          grid-template-columns: repeat(3, 66mm);
          grid-gap: 2mm 4mm;
          justify-content: center;
        }
        .label-card {
          width: 66mm;
          height: 34mm;
          border: 0.2mm dashed #ccc;
          box-sizing: border-box;
          padding: 3mm;
          display: flex;
          flex-direction: col;
          flex-wrap: wrap;
          align-content: space-between;
          justify-content: center;
          align-items: center;
          text-align: center;
          page-break-inside: avoid;
          position: relative;
          background: #fff;
        }
        .store-name {
          font-size: 8px;
          text-transform: uppercase;
          font-weight: 800;
          color: #666;
          letter-spacing: 0.5px;
          width: 100%;
        }
        .product-name {
          font-size: 10px;
          font-weight: 800;
          color: #000;
          margin-top: 1px;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .barcode-wrapper {
          margin: 2px 0;
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .price-badge {
          font-size: 11px;
          font-weight: 900;
          color: #000;
          border: 1px solid #000;
          padding: 1px 6px;
          border-radius: 4px;
          margin-top: 1px;
        }
        @media print {
          .label-card {
            border: 0.1mm solid #eee; /* Light gray lines for A4 cutting guides */
          }
          @page {
            margin: 0;
          }
        }
      `
      : `
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, sans-serif;
          background: #fff;
          width: 40mm;
          height: 30mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .label-card {
          width: 40mm;
          height: 30mm;
          box-sizing: border-box;
          padding: 2mm 3mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
          page-break-inside: avoid;
          page-break-after: always;
        }
        .store-name {
          font-size: 7px;
          text-transform: uppercase;
          font-weight: 800;
          color: #555;
          letter-spacing: 0.3px;
          width: 100%;
        }
        .product-name {
          font-size: 9px;
          font-weight: 800;
          color: #000;
          margin: 0;
          width: 100%;
          line-height: 1.1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .barcode-wrapper {
          margin: 1px 0;
          transform: scale(0.9);
          transform-origin: center;
        }
        .price-badge {
          font-size: 10px;
          font-weight: 950;
          color: #000;
          border: 1px solid #000;
          padding: 0px 5px;
          border-radius: 3px;
        }
        @media print {
          @page {
            size: 40mm 30mm;
            margin: 0;
          }
        }
      `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${product.name} - Çap</title>
          <style>${styles}</style>
        </head>
        <body>
          <div class="${format === "a4" ? "labels-grid" : ""}">
            ${labelsHTML}
          </div>
          <script>
            // Automatically trigger printer dialog
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="liquid-glass-overlay">
      
      {/* Modal Container */}
      <div className="liquid-glass-card max-w-4xl p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100/50 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT COLUMN: Controls & Form (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          <div>
            <h3 className="font-extrabold text-gray-900 text-lg tracking-tight flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" /> Qiymət Kağızı Çapı
            </h3>
            <p className="text-[10px] text-gray-400 mt-1 font-semibold leading-relaxed uppercase tracking-wider">
              {product.name} üçün qiymət kağızı vərəqləri hazırlayın
            </p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Format selector */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Kağız Formatı *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFormatChange("a4")}
                  className={`py-3 px-4 rounded-xl border font-bold text-center cursor-pointer transition-all flex flex-col items-center gap-1 ${
                    format === "a4"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xs">A4 Vərəq</span>
                  <span className="text-[9px] opacity-75 font-medium">3x8 Cədvəl (24 ədəd)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange("thermal")}
                  className={`py-3 px-4 rounded-xl border font-bold text-center cursor-pointer transition-all flex flex-col items-center gap-1 ${
                    format === "thermal"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xs">Termal Etiket</span>
                  <span className="text-[9px] opacity-75 font-medium">Xprinter (40x30mm)</span>
                </button>
              </div>
            </div>

            {/* Custom Price */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Etiket Qiyməti (AZN) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-gray-400 font-bold">₼</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qiymət daxil edin"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold text-gray-900"
                  required
                />
              </div>
            </div>

            {/* Print Quantity */}
            <div className="space-y-1.5">
              <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Çap Sayı *</label>
              <input
                type="number"
                min="1"
                max="240"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-bold text-gray-900"
                required
              />
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-200 text-gray-500 rounded-xl font-bold hover:bg-gray-50 cursor-pointer flex-1 text-center"
            >
              Bağla
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10 flex-1 hover-elevate"
            >
              <Printer className="w-4 h-4" /> Çap Et
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Preview (7 cols) */}
        <div className="md:col-span-7 bg-gray-50/50 rounded-3xl border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <div className="flex items-center gap-2 self-start mb-2">
            <Eye className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Etiket Canlı Önizləmə</span>
          </div>

          {/* Styled Label Mock Container */}
          <div 
            className={`bg-white border border-gray-200 shadow-md flex flex-col justify-between items-center text-center p-4 relative ${
              format === "a4" 
                ? "w-[264px] h-[136px]"  // scaled representation of 66x34mm (roughly 2:1 scale)
                : "w-[240px] h-[180px]"  // scaled representation of 40x30mm (4:3 aspect)
            }`}
          >
            {/* Store Name */}
            <span className="text-[9px] uppercase font-black tracking-widest text-gray-400 leading-none">
              {storeName}
            </span>

            {/* Product Name */}
            <h4 className="text-xs font-black text-gray-900 leading-tight mt-1 max-w-[90%] truncate">
              {product.name}
            </h4>

            {/* Vector Barcode rendering */}
            <div id="preview-barcode-container" className="my-1.5 transform scale-95 origin-center">
              <Barcode value={barcodeOverride} width={130} height={45} showText={true} />
            </div>

            {/* Price tag badge */}
            <span className="inline-flex px-3 py-1 bg-gray-900 border border-gray-950 text-white font-black text-xs rounded-lg shadow-sm">
              {Number(displayPrice).toFixed(2)} AZN
            </span>
          </div>

          <p className="text-[10px] text-gray-400 text-center font-medium leading-relaxed max-w-[280px]">
            * Önizləmə printerə göndəriləcək etiket dizaynının təxmini vizualıdır. Çap zamanı cizgilər tamamilə vektor formatda olacaq.
          </p>
        </div>

      </div>
    </div>
  );
}
