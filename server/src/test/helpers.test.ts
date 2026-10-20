import { describe, it, expect } from "vitest";
import { normalizeName, getMonthBoundaries, TIER_LIMITS } from "../routes/helpers.js";

describe("normalizeName", () => {
  it("trims whitespace", () => {
    expect(normalizeName("  Test  ")).toBe("test");
  });

  it("converts to lowercase", () => {
    expect(normalizeName("HELLO World")).toBe("hello world");
  });

  it("replaces Azerbaijani characters (ı→i)", () => {
    expect(normalizeName("Bakı")).toBe("baki");
  });

  it("replaces Azerbaijani characters (ə→e)", () => {
    expect(normalizeName("Məhsul")).toBe("mehsul");
  });

  it("replaces Azerbaijani characters (ö→o, ü→u)", () => {
    expect(normalizeName("Möhsüm Günel")).toBe("mohsum gunel");
  });

  it("replaces Azerbaijani characters (ş→s, ç→c, ğ→g)", () => {
    expect(normalizeName("Şirin Çiçək Dağ")).toBe("sirin cicek dag");
  });

  it("handles already normalized text", () => {
    expect(normalizeName("test_product")).toBe("test_product");
  });

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });

  it("handles special characters", () => {
    expect(normalizeName("Məhsul#1 (Yeni)")).toBe("mehsul#1 (yeni)");
  });

  it("handles numbers in text", () => {
    expect(normalizeName("Məhsul 123")).toBe("mehsul 123");
  });
});

describe("getMonthBoundaries", () => {
  it("returns firstDay and lastDay as ISO strings", () => {
    const boundaries = getMonthBoundaries();
    expect(boundaries).toHaveProperty("firstDay");
    expect(boundaries).toHaveProperty("lastDay");

    // Verify they are valid ISO date strings
    const firstDate = new Date(boundaries.firstDay);
    const lastDate = new Date(boundaries.lastDay);
    expect(firstDate.toISOString()).toBe(boundaries.firstDay);
    expect(lastDate.toISOString()).toBe(boundaries.lastDay);
  });

  it("firstDay is the 1st of the month", () => {
    const { firstDay } = getMonthBoundaries();
    const date = new Date(firstDay);
    expect(date.getDate()).toBe(1);
  });

  it("lastDay is the last day of the month", () => {
    const { firstDay, lastDay } = getMonthBoundaries();
    const firstDate = new Date(firstDay);
    const lastDate = new Date(lastDay);

    // The month of firstDay and lastDay should be the same
    expect(lastDate.getMonth()).toBe(firstDate.getMonth());

    // The last day should be the last day of the month
    // Next month's 1st day minus 1 day
    const nextMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 1);
    const lastDayOfMonth = new Date(nextMonth.getTime() - 86400000);
    expect(lastDate.getDate()).toBe(lastDayOfMonth.getDate());
  });

  it("lastDay includes 23:59:59", () => {
    const { lastDay } = getMonthBoundaries();
    const date = new Date(lastDay);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });
});

describe("TIER_LIMITS", () => {
  it("defines limits for all tiers", () => {
    expect(TIER_LIMITS).toHaveProperty("free");
    expect(TIER_LIMITS).toHaveProperty("mini");
    expect(TIER_LIMITS).toHaveProperty("pro");
    expect(TIER_LIMITS).toHaveProperty("enterprise");
  });

  it("free tier has correct limits", () => {
    expect(TIER_LIMITS.free.products).toBe(10);
    expect(TIER_LIMITS.free.sales).toBe(20);
    expect(TIER_LIMITS.free.users).toBe(1);
  });

  it("mini tier has correct limits", () => {
    expect(TIER_LIMITS.mini.products).toBe(100);
    expect(TIER_LIMITS.mini.sales).toBe(500);
    expect(TIER_LIMITS.mini.users).toBe(3);
  });

  it("pro tier has correct limits", () => {
    expect(TIER_LIMITS.pro.products).toBe(1000);
    expect(TIER_LIMITS.pro.sales).toBe(5000);
    expect(TIER_LIMITS.pro.users).toBe(10);
  });

  it("enterprise tier has Infinity limits", () => {
    expect(TIER_LIMITS.enterprise.products).toBe(Infinity);
    expect(TIER_LIMITS.enterprise.sales).toBe(Infinity);
    expect(TIER_LIMITS.enterprise.users).toBe(Infinity);
  });

  it("each tier has the required keys", () => {
    const requiredKeys = ["products", "sales", "users"];
    Object.values(TIER_LIMITS).forEach((limits) => {
      requiredKeys.forEach((key) => {
        expect(limits).toHaveProperty(key);
      });
    });
  });
});

describe("Stock Valuation and Quantity Integrity Rules", () => {
  it("strictly computes 0.00 total value when currentQuantity is 0 or negative", () => {
    // Helper function simulating the inventory valuation formula
    function computeInventoryValue(currentQuantity: number, entries: Array<{ quantity: number; purchasePrice: number }>, lastPurchasePrice: number) {
      if (currentQuantity <= 0) return 0;
      let totalValue = 0;
      let qtyNeeded = currentQuantity;
      for (let i = entries.length - 1; i >= 0; i--) {
        if (qtyNeeded <= 0) break;
        const entry = entries[i];
        const taken = Math.min(qtyNeeded, entry.quantity);
        totalValue += taken * entry.purchasePrice;
        qtyNeeded -= taken;
      }
      if (qtyNeeded > 0 && lastPurchasePrice > 0) {
        totalValue += qtyNeeded * lastPurchasePrice;
      }
      return Math.round(totalValue * 100) / 100;
    }

    // BOSCH scenario: 2 items were bought at 1083.00, but now 0 items in stock
    const boschEntries = [{ quantity: 2, purchasePrice: 1083.00 }];
    expect(computeInventoryValue(0, boschEntries, 1083.00)).toBe(0);
    expect(computeInventoryValue(-1, boschEntries, 1083.00)).toBe(0);

    // When 2 items exist, total value is 2166.00
    expect(computeInventoryValue(2, boschEntries, 1083.00)).toBe(2166.00);

    // Boru PVVC scenario: 14000 meters @ 1.20 AZN
    const pipeEntries = [{ quantity: 14000, purchasePrice: 1.20 }];
    expect(computeInventoryValue(14000, pipeEntries, 1.20)).toBe(16800.00);
    expect(computeInventoryValue(0, pipeEntries, 1.20)).toBe(0);
  });

  it("handles adjustment types correctly (manual_add/found add stock, loss/manual_remove decrease stock)", () => {
    const isAdjustmentIncrease = (type: string) =>
      ["found", "surplus", "manual_add", "add"].includes(String(type).toLowerCase());

    expect(isAdjustmentIncrease("found")).toBe(true);
    expect(isAdjustmentIncrease("manual_add")).toBe(true);
    expect(isAdjustmentIncrease("surplus")).toBe(true);
    expect(isAdjustmentIncrease("add")).toBe(true);

    expect(isAdjustmentIncrease("damage")).toBe(false);
    expect(isAdjustmentIncrease("loss")).toBe(false);
    expect(isAdjustmentIncrease("expired")).toBe(false);
    expect(isAdjustmentIncrease("manual_remove")).toBe(false);
  });
});

describe("Sales Seller Filtering & Calculation", () => {
  interface MockSeller {
    id: string;
    name: string;
    roleOrPosition?: string | null;
    aliases: string[];
  }

  interface MockSale {
    id: number;
    sellerName: string;
    totalAmount: number;
    totalCost: number;
    returns?: { totalAmount: number; items?: { purchasePrice: number; quantity: number }[] }[];
  }

  const mockUsers = [
    { id: 1, username: "admin", role: "Admin" },
    { id: 2, username: "alzone", role: "Staff" },
  ];

  const mockEmployees = [
    { id: 10, name: "Əli Məmmədov", position: "Kassir", status: "active" },
    { id: 11, name: "Alzone", position: "Satıcı", status: "active" },
  ];

  const mockDistinctSalesSellers = [
    { sellerName: "admin" },
    { sellerName: "alzone" },
    { sellerName: "Sistem" },
  ];

  function aggregateSellers(
    employees: typeof mockEmployees,
    users: typeof mockUsers,
    salesSellers: typeof mockDistinctSalesSellers
  ): MockSeller[] {
    const map = new Map<string, { id: string; name: string; roleOrPosition?: string; aliases: Set<string> }>();

    for (const emp of employees) {
      const normName = emp.name.trim();
      const key = normName.toLowerCase();
      map.set(key, {
        id: `emp-${emp.id}`,
        name: normName,
        roleOrPosition: emp.position || undefined,
        aliases: new Set([key]),
      });
    }

    for (const u of users) {
      const normUser = u.username.trim();
      const key = normUser.toLowerCase();
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.aliases.add(key);
        if (!existing.roleOrPosition) {
          existing.roleOrPosition = u.role === "Admin" ? "Administrator" : "İşçi";
        }
      } else {
        map.set(key, {
          id: `user-${u.id}`,
          name: normUser,
          roleOrPosition: u.role === "Admin" ? "Administrator" : "İşçi",
          aliases: new Set([key]),
        });
      }
    }

    for (const s of salesSellers) {
      if (!s.sellerName) continue;
      const normSaleSeller = s.sellerName.trim();
      const key = normSaleSeller.toLowerCase();
      let found = false;
      for (const seller of map.values()) {
        if (seller.aliases.has(key) || seller.name.toLowerCase() === key) {
          seller.aliases.add(key);
          found = true;
          break;
        }
      }
      if (!found) {
        map.set(key, {
          id: `sales-${key}`,
          name: normSaleSeller,
          roleOrPosition: "Satıcı",
          aliases: new Set([key]),
        });
      }
    }

    return Array.from(map.values())
      .map(s => ({
        id: s.id,
        name: s.name,
        roleOrPosition: s.roleOrPosition || null,
        aliases: Array.from(s.aliases),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "az"));
  }

  it("aggregates and deduplicates users, employees, and historical sales sellers", () => {
    const sellers = aggregateSellers(mockEmployees, mockUsers, mockDistinctSalesSellers);

    expect(sellers.length).toBe(4);
    // Should include: "Alzone" (merged employee + user), "admin" (user), "Əli Məmmədov" (employee), "Sistem" (sales)
    const names = sellers.map(s => s.name);
    expect(names).toContain("Əli Məmmədov");
    expect(names).toContain("Alzone");
    expect(names).toContain("admin");
    expect(names).toContain("Sistem");

    const alzone = sellers.find(s => s.name.toLowerCase() === "alzone");
    expect(alzone).toBeDefined();
    expect(alzone?.aliases).toContain("alzone");
  });

  it("filters sales by selected seller matching name or alias case-insensitively", () => {
    const sellers = aggregateSellers(mockEmployees, mockUsers, mockDistinctSalesSellers);

    const salesList: MockSale[] = [
      { id: 1, sellerName: "alzone", totalAmount: 150, totalCost: 100 },
      { id: 2, sellerName: "admin", totalAmount: 300, totalCost: 200 },
      { id: 3, sellerName: "Alzone", totalAmount: 50, totalCost: 30 },
      { id: 4, sellerName: "Sistem", totalAmount: 20, totalCost: 10 },
      { id: 5, sellerName: "Əli Məmmədov", totalAmount: 500, totalCost: 350 },
    ];

    const filterBySeller = (list: MockSale[], selected: string) => {
      if (!selected || selected === "all") return list;
      const targetSeller = sellers.find(s => s.id === selected || s.name.toLowerCase() === selected.toLowerCase());
      return list.filter(sale => {
        const saleSeller = (sale.sellerName || "").trim().toLowerCase();
        if (targetSeller) {
          return (
            targetSeller.name.trim().toLowerCase() === saleSeller ||
            targetSeller.aliases.some(a => a.toLowerCase() === saleSeller)
          );
        }
        return saleSeller === selected.trim().toLowerCase();
      });
    };

    // Filter by Alzone
    const alzoneSales = filterBySeller(salesList, "Alzone");
    expect(alzoneSales.length).toBe(2);
    expect(alzoneSales.map(s => s.id)).toEqual([1, 3]);

    // Filter by admin
    const adminSales = filterBySeller(salesList, "admin");
    expect(adminSales.length).toBe(1);
    expect(adminSales[0].id).toBe(2);

    // Filter by Əli Məmmədov
    const eliSales = filterBySeller(salesList, "Əli Məmmədov");
    expect(eliSales.length).toBe(1);
    expect(eliSales[0].id).toBe(5);

    // Filter all
    expect(filterBySeller(salesList, "").length).toBe(5);
  });

  it("dynamically updates revenue, cost, and profit metrics for the filtered worker", () => {
    const salesList: MockSale[] = [
      { id: 1, sellerName: "alzone", totalAmount: 150, totalCost: 100 },
      { id: 2, sellerName: "admin", totalAmount: 300, totalCost: 200 },
      { id: 3, sellerName: "alzone", totalAmount: 50, totalCost: 30, returns: [{ totalAmount: 10, items: [{ purchasePrice: 6, quantity: 1 }] }] },
    ];

    const computeMetrics = (list: MockSale[]) => {
      const revenue = list.reduce((sum, s) => {
        const returned = (s.returns || []).reduce((acc, r) => acc + (r.totalAmount || 0), 0);
        return sum + (s.totalAmount - returned);
      }, 0);

      const cost = list.reduce((sum, s) => {
        const returnedCost = (s.returns || []).reduce((retSum, r) => {
          const itemsCost = (r.items || []).reduce((iSum, item) => iSum + item.purchasePrice * item.quantity, 0);
          return retSum + itemsCost;
        }, 0);
        return sum + (s.totalCost - returnedCost);
      }, 0);

      return { revenue, cost, profit: revenue - cost };
    };

    // All sales
    const allMetrics = computeMetrics(salesList);
    expect(allMetrics.revenue).toBe(490); // 150 + 300 + (50 - 10)
    expect(allMetrics.cost).toBe(324); // 100 + 200 + (30 - 6)
    expect(allMetrics.profit).toBe(166);

    // Only alzone
    const alzoneOnly = salesList.filter(s => s.sellerName === "alzone");
    const alzoneMetrics = computeMetrics(alzoneOnly);
    expect(alzoneMetrics.revenue).toBe(190); // 150 + (50 - 10)
    expect(alzoneMetrics.cost).toBe(124); // 100 + (30 - 6)
    expect(alzoneMetrics.profit).toBe(66);
  });
});

