import { describe, it, expect } from "vitest";
import { cleanNumberInput, sanitizeQtyInput } from "../lib/utils";

describe("sanitizeQtyInput and cleanNumberInput utilities", () => {
  it("allows typing integers", () => {
    expect(cleanNumberInput("20")).toBe("20");
    expect(cleanNumberInput("100")).toBe("100");
  });

  it("handles empty string gracefully", () => {
    expect(cleanNumberInput("")).toBe("");
  });

  it("converts comma to dot (numpad and european locales)", () => {
    expect(cleanNumberInput("20,5")).toBe("20.5");
    expect(cleanNumberInput("0,01")).toBe("0.01");
    expect(cleanNumberInput(",75")).toBe("0.75");
  });

  it("permits intermediate dot while user is typing", () => {
    expect(cleanNumberInput("20.")).toBe("20.");
    expect(cleanNumberInput("0.")).toBe("0.");
  });

  it("strips leading zeros appropriately", () => {
    expect(sanitizeQtyInput("05")).toBe("5");
    expect(sanitizeQtyInput("00.5")).toBe("0.5");
    expect(cleanNumberInput("05")).toBe("5");
    expect(cleanNumberInput("007")).toBe("7");
    expect(cleanNumberInput("00.5")).toBe("0.5");
  });

  it("prevents multiple decimal points", () => {
    expect(cleanNumberInput("10.5.2")).toBe("10.52");
    expect(cleanNumberInput("10..5")).toBe("10.5");
  });

  it("filters non-numeric characters", () => {
    expect(cleanNumberInput("abc25xyz")).toBe("25");
  });
});
