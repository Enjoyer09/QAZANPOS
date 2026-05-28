import React from "react";

// Standard EAN-13 patterns
const PATTERNS = {
  A: [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011"
  ],
  B: [
    "0100111", "0110011", "0011011", "0100001", "0011101",
    "0111001", "0000101", "0010001", "0001001", "0010111"
  ],
  C: [
    "1110010", "1100110", "1101100", "1000010", "1011100",
    "1001110", "1010000", "1000100", "1001000", "1110100"
  ]
};

// First digit structures determining Left Group patterns
const STRUCTURES = [
  "AAAAAA", // 0
  "AABABB", // 1
  "AABBAB", // 2
  "AABBBA", // 3
  "ABAABB", // 4
  "ABBAAB", // 5
  "ABBBAA", // 6
  "ABABAB", // 7
  "ABABBA", // 8
  "ABBABA"  // 9
];

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export default function Barcode({
  value,
  width = 150,
  height = 70,
  showText = true
}: BarcodeProps) {
  // Validate EAN-13 format
  const cleanValue = value.replace(/\s+/g, "");
  if (!/^\d{13}$/.test(cleanValue)) {
    return (
      <div className="text-[10px] text-red-500 font-bold border border-red-100 p-2 rounded-lg bg-red-50 text-center max-w-[150px]">
        Format Xətası! EAN-13 barkodu 13 rəqəmdən ibarət olmalıdır.
      </div>
    );
  }

  const firstDigit = parseInt(cleanValue[0]);
  const leftGroup = cleanValue.substring(1, 7);
  const rightGroup = cleanValue.substring(7, 13);

  // 1. Start Guard (101)
  let modules = "101";

  // 2. Left Group (6 digits)
  const leftStructure = STRUCTURES[firstDigit];
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftGroup[i]);
    const type = leftStructure[i] as "A" | "B";
    modules += PATTERNS[type][digit];
  }

  // 3. Center Guard (01010)
  modules += "01010";

  // 4. Right Group (6 digits, always C)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightGroup[i]);
    modules += PATTERNS.C[digit];
  }

  // 5. Stop Guard (101)
  modules += "101";

  // Total EAN-13 module width is 95 modules
  const totalModules = modules.length;
  const barWidth = width / totalModules;
  const barcodeHeight = showText ? height - 15 : height;

  return (
    <div className="flex flex-col items-center justify-center select-none" style={{ width }}>
      <svg 
        width={width} 
        height={barcodeHeight} 
        viewBox={`0 0 ${width} ${barcodeHeight}`}
        className="overflow-visible"
      >
        {modules.split("").map((char, index) => {
          if (char === "0") return null;
          
          // Draw standard EAN-13 guard bars slightly longer (extra 4px height)
          const isGuard = 
            index < 3 || // Start Guard
            (index >= 45 && index < 50) || // Center Guard
            index >= 92; // Stop Guard

          const currentHeight = isGuard ? barcodeHeight : barcodeHeight - 4;

          return (
            <rect
              key={index}
              x={index * barWidth}
              y={0}
              width={barWidth + 0.1} // overlap slightly to prevent tiny scaling gaps
              height={currentHeight}
              fill="#000000"
            />
          );
        })}
      </svg>

      {showText && (
        <div 
          className="flex justify-between w-full text-[10px] font-black font-mono tracking-wider text-gray-900 mt-1 pl-1 pr-1"
          style={{ width }}
        >
          {/* First Digit (Outside Left) */}
          <span>{cleanValue[0]}</span>
          
          {/* Left Group */}
          <span>{cleanValue.substring(1, 7)}</span>
          
          {/* Right Group */}
          <span>{cleanValue.substring(7, 13)}</span>
        </div>
      )}
    </div>
  );
}

// Helper to calculate the EAN-13 check digit and generate a valid EAN-13 code sequential/randomly
export function generateValidEAN13(): string {
  // Generate a random 9-digit serial number
  const body = Math.floor(100000000 + Math.random() * 900000000).toString();
  const first12 = "200" + body; // 200 prefix for internal retail usage

  // Calculate check digit
  let sumEven = 0;
  let sumOdd = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12[i]);
    if (i % 2 === 1) {
      sumEven += digit;
    } else {
      sumOdd += digit;
    }
  }
  const total = sumOdd + (sumEven * 3);
  const checkDigit = (10 - (total % 10)) % 10;

  return first12 + checkDigit.toString();
}
