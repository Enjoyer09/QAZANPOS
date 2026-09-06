import { Router, Response } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { AuthenticatedRequest, requireAdmin, logActivity } from "./helpers.js";

export default function apiKeysRoutes(): Router {
  const router = Router();

  // GET /api-keys - List all API keys for tenant (Admin only)
  router.get("/api-keys", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const keys = await db.select().from(schema.apiKeys)
        .where(eq(schema.apiKeys.tenantId, req.tenantId))
        .orderBy(desc(schema.apiKeys.createdAt));

      // Mask keys for safety (e.g. qz_live_abc...xyz)
      const sanitized = keys.map((k) => {
        const full = k.key;
        const masked = full.length > 16 
          ? `${full.substring(0, 10)}...${full.substring(full.length - 4)}` 
          : full;
        return {
          id: k.id,
          name: k.name,
          maskedKey: masked,
          permissions: k.permissions,
          isActive: k.isActive,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
        };
      });

      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ message: "API açarları gətirilərkən xəta: " + error.message });
    }
  });

  // POST /api-keys - Generate a new API Key (Admin only)
  router.post("/api-keys", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, permissions } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "API açarı üçün ad tələb olunur" });
      }

      // Generate cryptographically secure random API key
      const randomSecret = crypto.randomBytes(24).toString("hex");
      const generatedKey = `qz_live_${randomSecret}`;

      const [newKey] = await db.insert(schema.apiKeys).values({
        tenantId: req.tenantId,
        name: name.trim(),
        key: generatedKey,
        permissions: permissions || "read:catalog,write:orders",
        isActive: 1,
        createdAt: new Date().toISOString(),
      }).returning();

      await logActivity(req, "CREATE_API_KEY", `Yeni API açarı yaradıldı: "${name.trim()}"`);

      // Return full key only upon creation
      res.status(201).json({
        id: newKey.id,
        name: newKey.name,
        key: newKey.key, // Exposed once
        permissions: newKey.permissions,
        createdAt: newKey.createdAt,
        message: "API açarı uğurla yaradıldı! Bu açarı təhlükəsiz saxlayın.",
      });
    } catch (error: any) {
      res.status(500).json({ message: "API açarı yaradılarkən xəta: " + error.message });
    }
  });

  // DELETE /api-keys/:id - Revoke and delete API Key (Admin only)
  router.delete("/api-keys/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Yanlış ID" });

      const existing = await db.query.apiKeys.findFirst({
        where: and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.tenantId, req.tenantId)),
      });

      if (!existing) {
        return res.status(404).json({ message: "API açarı tapılmadı" });
      }

      await db.delete(schema.apiKeys)
        .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.tenantId, req.tenantId)));

      await logActivity(req, "REVOKE_API_KEY", `API açarı ləğv edildi: "${existing.name}"`);

      res.json({ success: true, message: "API açarı uğurla ləğv edildi" });
    } catch (error: any) {
      res.status(500).json({ message: "API açarı silinərkən xəta: " + error.message });
    }
  });

  return router;
}
