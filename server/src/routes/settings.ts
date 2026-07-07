import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest, requireAdmin, logActivity } from "./helpers.js";
import { sendTelegramNotification } from "../lib/telegram.js";

export default function settingsRoutes(): Router {
  const router = Router();

  // GET /settings - Public settings (no auth required)
  router.get("/settings", async (req: AuthenticatedRequest, res) => {
    try {
      const setting = await db.query.settings.findFirst({
        where: eq(schema.settings.tenantId, req.tenantId)
      });
      if (!setting) return res.status(404).json({ message: "Tənzimləmələr tapılmadı" });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Tənzimləmələri gətirərkən xəta baş verdi" });
    }
  });

  // PUT /settings - Update settings
  router.put("/settings", async (req: AuthenticatedRequest, res) => {
    try {
      const allowedFields = [
        "storeName", "phone", "address", "invoiceFooter", "lowStockAlertCount",
        "defaultCreditDays", "receiptWidth", "showBarcode", "showCustomerInfo",
        "receiptHeader", "receiptFooter", "showStorePhone", "showStoreAddress",
        "showReceiptHeader", "showReceiptFooter", "showPaymentDetails",
        "telegramBotToken", "telegramChatId", "telegramNotificationsEnabled",
        "backupTime", "telegramBackupEnabled", "voen", "taxStatus", "edvRate",
        "simplifiedRate", "showTaxOnReceipt", "showTaxOnInvoice",
        "marketplaceCommissions", "staffCanViewSalesHistory", "staffCanViewStock",
        "staffCanViewCustomers", "staffCanViewVendors", "staffCanViewExpenses",
        "activeBanks", "loyaltyRuleRate", "loyaltyMinPointsRedeem",
        "smsApiKey", "smsSenderName", "smsTemplateDebt", "smsTemplateSale",
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const [updated] = await db.update(schema.settings)
        .set(updateData)
        .where(eq(schema.settings.tenantId, req.tenantId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Tənzimləmələr tapılmadı" });
      await logActivity(req, "UPDATE_SETTINGS", "Mağaza tənzimləmələrini yenilədi");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Tənzimləmələr yenilənərkən xəta baş verdi" });
    }
  });

  // POST /settings/test-telegram - Test Telegram notification
  router.post("/settings/test-telegram", async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await db.query.settings.findFirst({
        where: eq(schema.settings.tenantId, req.tenantId)
      });
      if (!settings) return res.status(404).json({ message: "Tənzimləmələr tapılmadı" });

      await sendTelegramNotification(
        req.tenantId,
        "✅ <b>Telegram Test Bildirişi</b>\n\nQazanPOS sisteminizdən test mesajı uğurla göndərildi! 🎉"
      );
      res.json({ success: true, message: "Test bildirişi uğurla göndərildi!" });
    } catch (error: any) {
      res.status(500).json({ message: "Test bildirişi göndərilərkən xəta: " + (error.message || "") });
    }
  });

  // POST /settings/reset - Reset settings to defaults
  router.post("/settings/reset", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const defaults = {
        storeName: "Mətbəx Dünyası",
        phone: "055-123-4567",
        address: "Yuxarı Göyçay",
        invoiceFooter: "Bizi seçdiyiniz üçün təşəkkür edirik!",
        lowStockAlertCount: 5,
        defaultCreditDays: 30,
        receiptWidth: "80mm",
        showBarcode: 1,
        showCustomerInfo: 1,
        receiptHeader: "MƏTBƏX DÜNYASI",
        receiptFooter: "Çekimizi saxlamanızı xahiş edirik!",
        showStorePhone: 1,
        showStoreAddress: 1,
        showReceiptHeader: 1,
        showReceiptFooter: 1,
        showPaymentDetails: 1,
      };

      const [updated] = await db.update(schema.settings)
        .set(defaults)
        .where(eq(schema.settings.tenantId, req.tenantId))
        .returning();

      await logActivity(req, "RESET_SETTINGS", "Tənzimləmələri zavod parametrlərinə sıfırladı");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Tənzimləmələr sıfırlanarkən xəta baş verdi" });
    }
  });

  return router;
}
