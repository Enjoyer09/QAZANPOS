import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Printer, 
  Plus, 
  Trash2, 
  Maximize2, 
  Type, 
  Barcode as BarcodeIcon, 
  Building, 
  Move, 
  Grid, 
  RefreshCw,
  Search,
  Check,
  Tag,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "../components/Toast.tsx";

// Code39 Standard Character Set Binary Mapping (Bars '1', Spaces '0')
const CODE39_CHARS: Record<string, string> = {
  "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
  "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
  "8": "110100101101", "9": "101100101101", "A": "110101001011", "B": "101101001011",
  "C": "110110100101", "D": "101011001011", "E": "110101100101", "F": "101101100101",
  "G": "101010011011", "H": "110101001101", "I": "101101001101", "J": "101011001101",
  "K": "110101010011", "L": "101101010011", "M": "110110101001", "N": "101011010011",
  "O": "110101101001", "P": "101101101001", "Q": "101010110011", "R": "110101011001",
  "S": "101101011001", "T": "101011011001", "U": "110010101011", "V": "100110101011",
  "W": "110011010101", "X": "100101101011", "Y": "110010110101", "Z": "100110110101",
  "-": "100101011011", ".": "110010101101", " ": "100110101101", "*": "100101101101",
  "+": "100110011001", "$": "100100100101", "%": "101001001001", "/": "100100101001"
};

// Pure React code39 Barcode Generator SVG component (Zero-dependency)
function Barcode({ value }: { value: string }) {
  const clean = ("*" + value.trim().toUpperCase() + "*").replace(/[^0-9A-Z\-.\s*$/+%/]/g, "");
  let binary = "";
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const pattern = CODE39_CHARS[char] || CODE39_CHARS[" "];
    binary += pattern + "0"; // Add separator gap between chars
  }

  const rects: React.ReactNode[] = [];
  const barWidth = 1.6;
  const height = 40;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      rects.push(
        <rect
          key={i}
          x={i * barWidth}
          y={0}
          width={barWidth}
          height={height}
          fill="black"
        />
      );
    }
  }

  const totalWidth = binary.length * barWidth;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="w-full h-[80%]">
        <svg 
          viewBox={`0 0 ${totalWidth} ${height}`} 
          width="100%" 
          height="100%" 
          preserveAspectRatio="none"
          className="block"
        >
          {rects}
        </svg>
      </div>
      <span className="text-[7px] font-mono tracking-widest text-black font-bold mt-1 select-none">{value}</span>
    </div>
  );
}

interface LabelElement {
  id: string;
  name: string;
  type: "store" | "name" | "price" | "barcode" | "text" | "unit";
  x: number; // Left percentage (0 - 100)
  y: number; // Top percentage (0 - 100)
  fontSize: number; // px
  bold: boolean;
  align: "left" | "center" | "right";
  customText?: string;
  width?: number; // percentage width
}

export default function Labels() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Active designer preset properties
  const [preset, setPreset] = useState<"40x30" | "58x40" | "a4">("40x30");
  const [printQty, setPrintQty] = useState<number>(24);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>({
    name: "Ariel Yuyucu Toz 6kq",
    salePrice: "14.50",
    barcode: "541314984205",
    unit: "ədəd"
  });

  // Fetch catalog products from database
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  // Store settings for default shop name
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  const shopName = settings?.storeName || settings?.tenantName || "BirSaaS Mağaza";

  // Elements initial design layout (Price Tag default premium layout)
  const [elements, setElements] = useState<LabelElement[]>([
    { id: "el-store", name: "Mağaza Adı", type: "store", x: 5, y: 8, fontSize: 8, bold: true, align: "center" },
    { id: "el-name", name: "Məhsul Adı", type: "name", x: 5, y: 22, fontSize: 11, bold: true, align: "center" },
    { id: "el-price", name: "Məhsul Qiyməti", type: "price", x: 5, y: 44, fontSize: 24, bold: true, align: "center" },
    { id: "el-barcode", name: "Barkod xətləri", type: "barcode", x: 10, y: 70, fontSize: 7, bold: false, align: "center", width: 80 },
  ]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPrinting, setIsPrinting] = useState(false);

  // Update selection focus
  const selectedElement = elements.find((el) => el.id === selectedElementId);

  // Handle Dragging Logic
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedElementId(id);
    setDraggedElementId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedElementId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate mouse translation in percentage
    const deltaX = (e.clientX - dragStart.x) / canvasRect.width * 100;
    const deltaY = (e.clientY - dragStart.y) / canvasRect.height * 100;
    
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== draggedElementId) return el;
        
        let newX = Math.max(0, Math.min(95, el.x + deltaX));
        let newY = Math.max(0, Math.min(92, el.y + deltaY));
        
        return { ...el, x: Math.round(newX), y: Math.round(newY) };
      })
    );
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDraggedElementId(null);
  };

  // Add new element dynamically
  const addNewTextElement = () => {
    const newId = `el-text-${Date.now()}`;
    const newEl: LabelElement = {
      id: newId,
      name: "Yeni Mətn",
      type: "text",
      x: 10,
      y: 40,
      fontSize: 10,
      bold: false,
      align: "left",
      customText: "Fərdi Yazı"
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newId);
    toast({
      title: "Element Əlavə Olundu",
      description: "Yeni fərdi mətn etiketin mərkəzinə yerləşdirildi.",
      variant: "success"
    });
  };

  // Delete focused element
  const deleteSelectedElement = () => {
    if (!selectedElementId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
    setSelectedElementId(null);
    toast({
      title: "Element Silindi",
      description: "Seçilmiş dizayn elementi etiketdən çıxarıldı.",
      variant: "default"
    });
  };

  // Update properties of focused element
  const updateSelectedProperty = (property: keyof LabelElement, value: any) => {
    if (!selectedElementId) return;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElementId) return el;
        return { ...el, [property]: value };
      })
    );
  };

  // Preset configuration bounds
  const presetDimensions = {
    "40x30": { width: "320px", height: "240px", label: "40mm x 30mm (Termal Rulo)" },
    "58x40": { width: "420px", height: "290px", label: "58mm x 40mm (POS Rulo)" },
    "a4": { width: "380px", height: "270px", label: "A4 Vərəq (Çap Toru)" }
  };

  const normalizeSearchText = (text: any): string => {
    if (text === null || text === undefined) return "";
    const str = String(text);
    return str
      .toLocaleLowerCase("az-AZ")
      .replace(/ı/g, "i")
      .replace(/ə/g, "e")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g");
  };

  // Search filter catalog
  const filteredProducts = products.filter((p) => {
    const q = searchTerm.trim();
    if (!q) return true;
    const qNorm = normalizeSearchText(q);
    return (
      normalizeSearchText(p.name).includes(qNorm) ||
      (p.barcode && normalizeSearchText(p.barcode).includes(qNorm))
    );
  });

  // Trigger browser print dialog for designed labels
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 select-none no-print">
      
      {/* Dynamic print-grid simulation style sheet */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            display: block !important;
            width: 100% !important;
            background: white !important;
          }
          /* A4 Grid mode */
          .print-grid-a4 {
            display: grid !important;
            grid-template-columns: repeat(3, 70mm) !important;
            grid-gap: 5mm !important;
            padding: 10mm !important;
            justify-content: center !important;
          }
          /* Single Continuous Thermal rolls */
          .print-thermal-roll {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .print-label-item {
            width: ${preset === "40x30" ? "40mm" : "58mm"} !important;
            height: ${preset === "40x30" ? "30mm" : "40mm"} !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            position: relative !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .print-label-item-a4 {
            width: 70mm !important;
            height: 48mm !important;
            border: 1px dashed #ccc !important;
            position: relative !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            background: white !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/ayarlar">
            <button className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
              <Tag className="w-3 h-3" />
              <span>Yeni Modul</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">Daxili Qiymət Kağızı və Etiket Generatoru</h1>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary/95 text-white font-black rounded-2xl shadow-lg shadow-primary/25 transition-all text-xs tracking-wider uppercase cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Şablonu Çap Et 🖨️</span>
        </button>
      </div>

      {/* Layout workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        
        {/* Left column: Preset designer options & Catalog search selector */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Preset parameters & design properties card */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md space-y-5">
            <h2 className="text-sm font-black text-gray-900 tracking-tight border-b border-gray-100 pb-3 flex items-center gap-2">
              <Grid className="w-4.5 h-4.5 text-primary" />
              <span>Etiket Ölçüsü və Tənzimləmələr</span>
            </h2>

            {/* Sizes Preset toggler */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Format Presetləri</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setPreset("40x30");
                    if (printQty > 50) setPrintQty(24);
                  }}
                  className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all flex flex-col items-center justify-center gap-1 border ${
                    preset === "40x30"
                      ? "bg-primary/5 text-primary border-primary"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span className="block font-black text-[11px]">40x30 mm</span>
                  <span className="block text-[8px] font-semibold text-gray-400">Termal Etiket</span>
                </button>

                <button
                  onClick={() => {
                    setPreset("58x40");
                    if (printQty > 50) setPrintQty(24);
                  }}
                  className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all flex flex-col items-center justify-center gap-1 border ${
                    preset === "58x40"
                      ? "bg-primary/5 text-primary border-primary"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span className="block font-black text-[11px]">58x40 mm</span>
                  <span className="block text-[8px] font-semibold text-gray-400">POS Rulo</span>
                </button>

                <button
                  onClick={() => {
                    setPreset("a4");
                    setPrintQty(24); // default grid size for A4
                  }}
                  className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all flex flex-col items-center justify-center gap-1 border ${
                    preset === "a4"
                      ? "bg-primary/5 text-primary border-primary"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span className="block font-black text-[11px]">A4 Vərəq</span>
                  <span className="block text-[8px] font-semibold text-gray-400">Ofis Printeri</span>
                </button>
              </div>
            </div>

            {/* Print Quantity selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Çap olunacaq say</label>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{printQty} ədəd</span>
              </div>
              <input
                type="range"
                min="1"
                max={preset === "a4" ? "48" : "150"}
                value={printQty}
                onChange={(e) => setPrintQty(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Designer controls tool */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={addNewTextElement}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary font-black text-[10px] uppercase tracking-wider hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mətn Əlavə et</span>
              </button>
              
              <button
                onClick={() => {
                  setElements([
                    { id: "el-store", name: "Mağaza Adı", type: "store", x: 5, y: 8, fontSize: 8, bold: true, align: "center" },
                    { id: "el-name", name: "Məhsul Adı", type: "name", x: 5, y: 22, fontSize: 11, bold: true, align: "center" },
                    { id: "el-price", name: "Məhsul Qiyməti", type: "price", x: 5, y: 44, fontSize: 24, bold: true, align: "center" },
                    { id: "el-barcode", name: "Barkod xətləri", type: "barcode", x: 10, y: 70, fontSize: 7, bold: false, align: "center", width: 80 },
                  ]);
                  setSelectedElementId(null);
                  toast({
                    title: "Sıfırlandı",
                    description: "Dizayn şablonu ilkin standart formaya qaytarıldı.",
                    variant: "default"
                  });
                }}
                className="inline-flex items-center justify-center p-3 border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-800 rounded-xl transition-all cursor-pointer"
                title="Şablonu Sıfırla"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Product selector panel */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md space-y-4">
            <h2 className="text-sm font-black text-gray-900 tracking-tight border-b border-gray-100 pb-3 flex items-center gap-2">
              <BoxesIconComponent className="w-4.5 h-4.5 text-primary" />
              <span>Çap ediləcək məhsulu seç</span>
            </h2>

            {/* Catalog search bar */}
            <div className="relative">
              <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Məhsul adı və ya barkod..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Interactive products list */}
            <div className="max-h-[220px] overflow-y-auto space-y-2 border border-gray-50 rounded-xl p-1 bg-gray-50/20">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Məhsul tapılmadı.</div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.barcode === p.barcode;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        toast({
                          title: "Məhsul Seçildi 🏷️",
                          description: `Etiket ${p.name} məlumatları ilə vizuallaşdırıldı.`,
                          variant: "success"
                        });
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-primary/5 border-primary/30 ring-2 ring-primary/5"
                          : "bg-white border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="space-y-0.5 max-w-[80%]">
                        <span className="block text-xs font-black text-gray-800 truncate leading-tight">{p.name}</span>
                        <span className="block text-[9px] font-bold text-gray-400 font-mono tracking-wider">{p.barcode || "BARKODSUZ"}</span>
                      </div>
                      
                      <div className="text-right flex items-center gap-2">
                        <span className="text-xs font-black text-primary font-mono">{p.salePrice} ₼</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Center Canvas Workspace: Drag & Drop Interactive Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-gray-100/50 border border-gray-200/50 rounded-3xl p-8 min-h-[460px] relative shadow-inner">
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-gray-400 font-bold text-[9px] uppercase tracking-wider select-none">
            <Move className="w-3.5 h-3.5" />
            <span>Sürükləyib Yerini Dəyişin</span>
          </div>

          <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 text-gray-400 font-bold text-[9px] uppercase tracking-wider select-none">
            <span>Ölçü: {presetDimensions[preset].label}</span>
          </div>

          {/* Designer physical price tag canvas card */}
          <div 
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              width: presetDimensions[preset].width,
              height: presetDimensions[preset].height,
            }}
            className="bg-white border border-gray-300 shadow-2xl relative overflow-hidden transition-all rounded-sm flex items-center justify-center"
          >
            {/* Standard frame boundary markings */}
            <div className="absolute inset-0 border border-gray-200/10 pointer-events-none z-10"></div>

            {/* Elements render loop */}
            {elements.map((el) => {
              const isFocused = el.id === selectedElementId;
              let content: React.ReactNode = "";

              // Resolve dynamic values mapped to selected Product
              if (el.type === "store") content = el.customText || shopName;
              else if (el.type === "name") content = selectedProduct?.name || "Nümunə Məhsul";
              else if (el.type === "price") content = `${selectedProduct?.salePrice || "0.00"} ₼`;
              else if (el.type === "unit") content = `Vahid: 1 ${selectedProduct?.unit || "ədəd"}`;
              else if (el.type === "text") content = el.customText || "Mətn";
              else if (el.type === "barcode") {
                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width || 80}%`,
                      height: "48px"
                    }}
                    className={`absolute select-none cursor-move flex items-center justify-center p-1 rounded transition-all ${
                      isFocused ? "border border-primary ring-2 ring-primary/10 bg-primary/2" : "border border-transparent hover:border-gray-200"
                    }`}
                  >
                    <Barcode value={selectedProduct?.barcode || "000000000000"} />
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  onMouseDown={(e) => handleMouseDown(e, el.id)}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    fontSize: `${el.fontSize}px`,
                    fontWeight: el.bold ? "black" : "normal",
                    textAlign: el.align,
                  }}
                  className={`absolute select-none cursor-move px-1.5 py-0.5 rounded leading-tight truncate whitespace-nowrap text-black font-sans ${
                    isFocused 
                      ? "border border-primary ring-2 ring-primary/10 bg-primary/2 font-black" 
                      : "border border-transparent hover:border-gray-200"
                  }`}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Properties editor panel for selected element */}
        <div className="lg:col-span-3">
          {selectedElement ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md space-y-5 text-left">
              <h2 className="text-sm font-black text-gray-900 tracking-tight border-b border-gray-100 pb-3 flex items-center gap-2">
                <Maximize2 className="w-4.5 h-4.5 text-primary" />
                <span>Element Tənzimləmələri</span>
              </h2>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Seçilmiş Element</span>
                <span className="text-xs font-black text-gray-900 bg-gray-50 px-3 py-2 rounded-xl block border border-gray-100">{selectedElement.name}</span>
              </div>

              {/* Editable static text or store name override input */}
              {(selectedElement.type === "text" || selectedElement.type === "store") && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                    {selectedElement.type === "store" ? "Fərdi Mağaza Adı (Boşdursa ayarlardan götürülür)" : "Mətn Dəyəri"}
                  </label>
                  <input
                    type="text"
                    value={selectedElement.customText || ""}
                    placeholder={selectedElement.type === "store" ? shopName : ""}
                    onChange={(e) => updateSelectedProperty("customText", e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Barcode width sizing */}
              {selectedElement.type === "barcode" && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Eni (%)</label>
                  <input
                    type="number"
                    min="30"
                    max="100"
                    value={selectedElement.width || 80}
                    onChange={(e) => updateSelectedProperty("width", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              )}

              {/* Font Size slider */}
              {selectedElement.type !== "barcode" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Yazı Ölçüsü</label>
                    <span className="text-[9px] font-black text-primary font-mono">{selectedElement.fontSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="48"
                    value={selectedElement.fontSize}
                    onChange={(e) => updateSelectedProperty("fontSize", parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              )}

              {/* Font bold toggle & Alignment tools */}
              {selectedElement.type !== "barcode" && (
                <div className="space-y-3 pt-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Yazı Formatı</span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSelectedProperty("bold", !selectedElement.bold)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        selectedElement.bold
                          ? "bg-primary/5 text-primary border-primary"
                          : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                      <span>Qalın</span>
                    </button>

                    <div className="flex border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => updateSelectedProperty("align", "left")}
                        className={`p-2.5 cursor-pointer ${selectedElement.align === "left" ? "bg-primary/10 text-primary" : "bg-white text-gray-400 hover:text-gray-600"}`}
                        title="Sola düzləndir"
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateSelectedProperty("align", "center")}
                        className={`p-2.5 cursor-pointer ${selectedElement.align === "center" ? "bg-primary/10 text-primary" : "bg-white text-gray-400 hover:text-gray-600"}`}
                        title="Mərkəzə düzləndir"
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateSelectedProperty("align", "right")}
                        className={`p-2.5 cursor-pointer ${selectedElement.align === "right" ? "bg-primary/10 text-primary" : "bg-white text-gray-400 hover:text-gray-600"}`}
                        title="Sağa düzləndir"
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Absolute coordinates preview */}
              <div className="grid grid-cols-2 gap-2 text-[8px] font-bold text-gray-400 bg-gray-50 p-2.5 rounded-xl font-mono">
                <div>SOL: {selectedElement.x}%</div>
                <div>YUXARI: {selectedElement.y}%</div>
              </div>

              {/* Delete focused element button */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={deleteSelectedElement}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Elementi Sil</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md text-center py-10 space-y-3 text-gray-400 no-print">
              <Type className="w-8 h-8 mx-auto text-gray-300 animate-pulse" />
              <div className="space-y-1">
                <span className="block text-xs font-black text-gray-500 uppercase tracking-wider">Element Seçilməyib</span>
                <span className="block text-[10px] font-medium leading-relaxed">Etiket üzərindəki hər hansı yazının və ya barkodun yerini dəyişmək üçün üzərinə klikləyin, sürüşdürün və tənzimləyin.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RENDER CHANNELS FOR PRINT PREVIEW ONLY (Invisible inside regular UI, visible during @media print) */}
      <div className="hidden print-container">
        <div className={preset === "a4" ? "print-grid-a4" : "print-thermal-roll"}>
          {Array.from({ length: printQty }).map((_, itemIndex) => (
            <div 
              key={itemIndex}
              className={preset === "a4" ? "print-label-item-a4" : "print-label-item"}
              style={{
                position: "relative",
                backgroundColor: "white",
              }}
            >
              {elements.map((el) => {
                let content: React.ReactNode = "";

                if (el.type === "store") content = el.customText || shopName;
                else if (el.type === "name") content = selectedProduct?.name || "Nümunə Məhsul";
                else if (el.type === "price") content = `${selectedProduct?.salePrice || "0.00"} ₼`;
                else if (el.type === "unit") content = `Vahid: 1 ${selectedProduct?.unit || "ədəd"}`;
                else if (el.type === "text") content = el.customText || "";
                else if (el.type === "barcode") {
                  return (
                    <div
                      key={el.id}
                      style={{
                        position: "absolute",
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width || 80}%`,
                        height: "44px"
                      }}
                    >
                      <Barcode value={selectedProduct?.barcode || "000000000000"} />
                    </div>
                  );
                }

                return (
                  <div
                    key={el.id}
                    style={{
                      position: "absolute",
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      fontSize: `${el.fontSize}px`,
                      fontWeight: el.bold ? "bold" : "normal",
                      textAlign: el.align,
                      color: "black",
                      fontFamily: "sans-serif",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact internal icon wrapper to guarantee lucide matching
function BoxesIconComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    </svg>
  );
}
