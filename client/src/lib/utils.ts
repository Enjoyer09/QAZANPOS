import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeQtyInput(val: string): string {
  // Strip leading zeros that are immediately followed by a digit.
  // This allows "0." to start decimal inputs but cleans "05" -> "5", "00.5" -> "0.5"
  let cleaned = val.replace(/^0+(?=\d)/, "");
  // If the value starts with a decimal dot (e.g. ".5"), prepend a single zero (e.g. "0.5")
  if (cleaned.startsWith(".")) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}
