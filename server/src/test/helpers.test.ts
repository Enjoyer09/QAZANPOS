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
