import { test, expect } from "@playwright/test";

test.describe("QAZANPOS - Landing Page", () => {
  test("page loads with header", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check the header brand is present
    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Sınaq Sessiyası 🚀")).toBeVisible();
  });

  test("hero section has main headline", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Mağazanız üçün")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Vahid Bulud Nəzarəti")).toBeVisible();
  });

  test("features section is present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Qalıq və Anbar Nəzarəti")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Fövqəladə Oflayn Rejim")).toBeVisible();
    await expect(page.getByText("COGS Maya Dəyəri Auditi")).toBeVisible();
  });

  test("pricing section has plan names", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Tarif Planları")).toBeVisible({ timeout: 15000 });

    // Check that pricing cards are present (using generic plan card selectors)
    const pricingCards = page.locator("#tarifler .rounded-3xl");
    await expect(pricingCards.first()).toBeVisible({ timeout: 10000 });

    // Check at least one plan name is visible
    await expect(page.getByText("Mini Plan").first()).toBeVisible();
    await expect(page.getByText("Pro Plan").first()).toBeVisible();
  });

  test("FAQ section is interactive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Tez-tez Verilən Suallar")).toBeVisible({ timeout: 15000 });

    const faqQuestion = page.getByText("📡 İnternet kəsildikdə POS satışları işləyirmi?");
    await faqQuestion.click();

    await expect(
      page.getByText("Progressive Client-Side Oflayn POS mühərriki")
    ).toBeVisible({ timeout: 5000 });
  });

  test("CTA button is visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const ctaButtons = page.getByText("Sınaq Turuna Başla 🚀");
    await expect(ctaButtons.first()).toBeVisible({ timeout: 15000 });
  });

  test("no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const critical = errors.filter((e) => !e.includes("favicon.ico"));
    expect(critical.length).toBe(0);
  });

  test("page has visible content", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await page.waitForSelector("main", { timeout: 15000 });
    const main = page.locator("main");
    const screenshot = await main.screenshot();
    expect(screenshot.length).toBeGreaterThan(500);
  });
});
