import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { AuthenticatedRequest, logActivity } from "./helpers.js";

// ─── Super Admin middleware ────────────────────────────────────────────────
function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] as string;
  if (req.tenantSlug !== "super" || role !== "Admin") {
    return res.status(403).json({ message: "Yalnız Platforma Administratoru üçün" });
  }
  next();
}

export default function superRoutes(): Router {
  const router = Router();

  // ─── GET /super/tenants — List all tenants with stats ─────────────────────
  router.get("/super/tenants", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const allTenants = await db.select().from(schema.tenants).orderBy(desc(schema.tenants.id));
      const result = [];

      for (const tenant of allTenants) {
        const userCountResult = await db
          .select({ count: sql`COUNT(id)` })
          .from(schema.users)
          .where(eq(schema.users.tenantId, tenant.id));
        const userCount = parseInt((userCountResult[0]?.count as string) || "0");

        const saleCountResult = await db
          .select({ count: sql`COUNT(id)` })
          .from(schema.sales)
          .where(eq(schema.sales.tenantId, tenant.id));
        const saleCount = parseInt((saleCountResult[0]?.count as string) || "0");

        result.push({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          releaseTier: tenant.releaseTier,
          billingTier: (tenant as any).billingTier,
          createdAt: tenant.createdAt,
          userCount,
          saleCount,
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Biznesləri gətirərkən xəta baş verdi" });
    }
  });

  // ─── POST /super/tenants — Create/Provision a new tenant ─────────────────
  router.post("/super/tenants", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, slug, adminUsername, adminPassword } = req.body;
      if (!name || !slug || !adminUsername || !adminPassword) {
        return res.status(400).json({ message: "Bütün məlumatları doldurun" });
      }

      const normalizedSlug = slug.trim().toLowerCase();

      const existingTenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.slug, normalizedSlug),
      });
      if (existingTenant) {
        return res.status(400).json({ message: "Bu Biznes Kodu artıq istifadə olunur" });
      }

      const newTenant = await db.insert(schema.tenants).values({
        name,
        slug: normalizedSlug,
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString(),
      }).returning();

      const tenantId = newTenant[0].id;

      await db.insert(schema.settings).values({ tenantId, storeName: name });

      const normalizedUsername = adminUsername.trim().toLowerCase();
      await db.insert(schema.users).values({
        tenantId,
        username: normalizedUsername,
        password: hashPassword(adminPassword.trim()),
        role: "Admin",
      });

      // Create a default warehouse
      await db.insert(schema.warehouses).values({
        tenantId,
        name: "Əsas Anbar",
        isDefault: 1,
        createdAt: new Date().toISOString(),
      });

      await logActivity(req, "PROVISION_TENANT", `Yeni biznes hesabını aktivləşdirdi: '${name}' (Kod: ${normalizedSlug}, Admin: ${normalizedUsername})`);

      res.json(newTenant[0]);
    } catch (error: any) {
      console.error("Tenant provisioning error:", error);
      res.status(500).json({ message: `Biznes yaradılarkən xəta baş verdi: ${error.message || error}` });
    }
  });

  // ─── PUT /super/tenants/:id/status — Toggle tenant active/suspended ───────
  router.put("/super/tenants/:id/status", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (id === 2) {
        return res.status(400).json({ message: "Super platforma admin tenantı dayandırıla bilməz!" });
      }

      const updated = await db.update(schema.tenants).set({ status })
        .where(eq(schema.tenants.id, id)).returning();

      if (updated.length === 0) return res.status(404).json({ message: "Biznes tapılmadı" });

      await logActivity(req, "TOGGLE_TENANT_STATUS", `'${updated[0].name}' biznesinin statusunu yenilədi: ${status}`);
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ message: "Biznes statusu dəyişdirilərkən xəta baş verdi" });
    }
  });

  // ─── PUT /super/tenants/:id/tier — Set release updates tier ──────────────
  router.put("/super/tenants/:id/tier", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { releaseTier } = req.body;

      const updated = await db.update(schema.tenants).set({ releaseTier })
        .where(eq(schema.tenants.id, id)).returning();

      if (updated.length === 0) return res.status(404).json({ message: "Biznes tapılmadı" });

      await logActivity(req, "UPDATE_TENANT_TIER", `'${updated[0].name}' biznesinin yenilənmə dərəcəsini dəyişdi: ${releaseTier}`);
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ message: "Biznes dərəcəsi dəyişdirilərkən xəta baş verdi" });
    }
  });

  // ─── PUT /super/tenants/:id/billing-tier — Set billing plan ──────────────
  router.put("/super/tenants/:id/billing-tier", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { billingTier } = req.body;

      if (!billingTier || !["free", "mini", "pro", "enterprise"].includes(billingTier)) {
        return res.status(400).json({ message: "Yanlış tarif planı daxil edilib" });
      }

      const updated = await db.update(schema.tenants).set({ billingTier } as any)
        .where(eq(schema.tenants.id, id)).returning();

      if (updated.length === 0) return res.status(404).json({ message: "Biznes tapılmadı" });

      await logActivity(req, "UPDATE_TENANT_BILLING_TIER", `'${updated[0].name}' biznesinin abunəlik tarifini dəyişdi: ${billingTier}`);
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating tenant billing tier:", error);
      res.status(500).json({ message: "Biznes tarifi yenilənərkən xəta baş verdi" });
    }
  });

  // ─── GET /super/tenants/:id/users — Get all users for a tenant ───────────
  router.get("/super/tenants/:id/users", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantUsers = await db.query.users.findMany({
        where: eq(schema.users.tenantId, id),
      });
      res.json(tenantUsers);
    } catch (error: any) {
      console.error("Error fetching tenant users:", error);
      res.status(500).json({ message: "Biznes istifadəçilərini gətirərkən xəta baş verdi" });
    }
  });

  // ─── DELETE /super/tenants/:id — Delete a tenant (password-protected) ────
  router.delete("/super/tenants/:id", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Təsdiqləmək üçün Super Admin şifrəsini daxil edin" });
      }

      if (id === 2) {
        return res.status(400).json({ message: "Super platforma admin tenantı silinə bilməz!" });
      }

      const headerUsername = req.headers["x-user-username"];
      const superAdminUsername = (Array.isArray(headerUsername)
        ? (headerUsername[0] || "superadmin")
        : (headerUsername || "superadmin")).trim().toLowerCase();

      const superAdminUser = await db.query.users.findFirst({
        where: and(eq(schema.users.username, superAdminUsername), eq(schema.users.tenantId, req.tenantId)),
      });

      if (!superAdminUser || superAdminUser.password !== password.trim()) {
        return res.status(401).json({ message: "Daxil edilən Super Admin şifrəsi yanlışdır!" });
      }

      const tenantToDelete = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
      if (!tenantToDelete) return res.status(404).json({ message: "Silinəcək biznes tapılmadı" });

      await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
      await logActivity(req, "DELETE_TENANT", `'${tenantToDelete.name}' (Kod: ${tenantToDelete.slug}) biznesini tamamilə sildi`);

      res.json({ message: `Biznes hesabı ('${tenantToDelete.name}') uğurla silindi` });
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Biznes silinərkən xəta baş verdi" });
    }
  });

  // ─── PUT /super/profile — Update super admin credentials ─────────────────
  router.put("/super/profile", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "İstifadəçi adı və şifrə boş ola bilməz!" });
      }

      const superUser = await db.query.users.findFirst({
        where: and(eq(schema.users.tenantId, req.tenantId), eq(schema.users.role, "Admin")),
      });

      if (!superUser) return res.status(404).json({ message: "Super Admin hesabı tapılmadı!" });

      await db.update(schema.users).set({
        username: username.trim().toLowerCase(),
        password: password.trim(),
      }).where(eq(schema.users.id, superUser.id));

      await logActivity(req, "UPDATE_SUPER_PROFILE", `Super Admin profil məlumatlarını yenilədi: '${username}'`);
      res.json({ success: true, message: "Super Admin profil məlumatları uğurla yeniləndi!" });
    } catch (error) {
      console.error("Error updating super admin profile:", error);
      res.status(500).json({ message: "Profil məlumatlarını yeniləyərkən xəta baş verdi" });
    }
  });

  return router;
}
