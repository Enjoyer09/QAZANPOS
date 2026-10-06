import { Router } from "express";
import { AuthenticatedRequest, requireAdmin, logActivity } from "./helpers.js";
import { ClimahomeService } from "../lib/climahome.js";

export default function climahomeRoutes(): Router {
  const router = Router();

  /**
   * GET /api/climahome/status
   * Cari tenantın Climahome inteqrasiya vəziyyətini qaytarır
   */
  router.get("/climahome/status", async (req: AuthenticatedRequest, res) => {
    try {
      const config = await ClimahomeService.getConfig(req.tenantId);
      res.json({
        enabled: config.enabled,
        baseUrl: config.baseUrl,
        hasToken: !!config.token,
        tokenMasked: config.token ? `${config.token.substring(0, 4)}...${config.token.substring(config.token.length - 4)}` : null,
        lastSync: config.lastSync,
        autoSync: config.autoSync,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Climahome statusu gətirilərkən xəta baş verdi" });
    }
  });

  /**
   * POST /api/climahome/test
   * Climahome API bağlantısını yoxlayır
   */
  router.post("/climahome/test", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await ClimahomeService.testConnection(req.tenantId);
      await logActivity(req, "TEST_CLIMAHOME", `Climahome API əlaqəsi yoxlanıldı: ${result.message}`);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Bağlantı xətası" });
    }
  });

  /**
   * POST /api/climahome/sync
   * Məhsulların sinxronizasiyasını başladır (Full və ya Delta)
   */
  router.post("/climahome/sync", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { full = false } = req.body || {};
      const result = await ClimahomeService.syncProducts(req.tenantId, { full });
      await logActivity(
        req,
        "SYNC_CLIMAHOME_PRODUCTS",
        `Climahome məhsulları sinxronlaşdırıldı (${full ? "Full" : "Delta"}): ${result.createdCount} yeni, ${result.updatedCount} yeniləndi`
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Sinxronizasiya zamanı xəta baş verdi" });
    }
  });

  /**
   * GET /api/climahome/search
   * Kassada barkod və ya kod üzrə axtarış və avtomatik idxal
   */
  router.get("/climahome/search", async (req: AuthenticatedRequest, res) => {
    try {
      const code = (req.query.code || req.query.barcode || req.query.q) as string;
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ message: "Barkod və ya məhsul kodu daxil edilməlidir" });
      }

      const product = await ClimahomeService.searchProductByBarcode(req.tenantId, code.trim());
      if (!product) {
        return res.status(404).json({ message: "Məhsul tapılmadı" });
      }

      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Axtarış zamanı xəta baş verdi" });
    }
  });

  /**
   * GET /api/climahome/bonus
   * Müştərinin telefon nömrəsi ilə bonus məlumatlarını yoxlayır
   */
  router.get("/climahome/bonus", async (req: AuthenticatedRequest, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone || typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({ message: "Müştəri telefon nömrəsi daxil edilməlidir" });
      }

      const bonusData = await ClimahomeService.lookupCustomerBonus(req.tenantId, phone.trim());
      res.json(bonusData);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Bonus məlumatı gətirilərkən xəta baş verdi" });
    }
  });

  return router;
}
