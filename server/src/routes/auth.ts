import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyTOTP, generateSecret, getOTPAuthURI } from "../db/totp.js";
import { hashPassword, generateToken } from "../lib/auth.js";
import { AuthenticatedRequest, logActivity } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function authRoutes(): Router {
  const router = Router();

  router.post("/auth/login", async (req: AuthenticatedRequest, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "İstifadəçi adı və şifrə daxil edilməlidir" });
      }

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.username, username.trim().toLowerCase()), eq(schema.users.password, hashPassword(password)), eq(schema.users.tenantId, req.tenantId))
      });

      if (!user) return res.status(401).json({ message: "İstifadəçi adı və ya şifrə yanlışdır" });

      const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, req.tenantId) });

      if (user.twoFactorEnabled === 1) {
        const clientIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1").split(",")[0].trim();
        const trustToken = req.headers["x-2fa-trust-token"];
        const trustTokenStr = Array.isArray(trustToken) ? trustToken[0] : (trustToken || "");

        let trustedDevices: Array<{ deviceToken: string; ip: string; expireAt: number }> = [];
        if (user.twoFactorTrustedDevices) {
          try { trustedDevices = JSON.parse(user.twoFactorTrustedDevices); } catch (e) {}
        }

        const now = Date.now();
        const isTrusted = trustedDevices.some(d => (trustTokenStr && d.deviceToken === trustTokenStr || d.ip === clientIp) && d.expireAt > now);

        if (!isTrusted) return res.json({ require2FA: true, userId: user.id });
      }

      const token = generateToken({ userId: user.id, username: user.username, role: user.role, tenantId: req.tenantId });

      res.json({
        id: user.id, username: user.username, role: user.role, tenantId: req.tenantId,
        tenantName: tenant?.name || "Qazan POS", tenantSlug: req.tenantSlug, token
      });
    } catch (error) {
      res.status(500).json({ message: "Giriş zamanı xəta baş verdi" });
    }
  });

  router.post("/auth/2fa-setup", async (req: AuthenticatedRequest, res) => {
    try {
      const username = req.headers["x-user-username"];
      if (!username) return res.status(401).json({ message: "Səlahiyyətləndirmə xətası" });

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.username, String(username)), eq(schema.users.tenantId, req.tenantId))
      });
      if (!user) return res.status(404).json({ message: "İstifadəçi tapılmadı" });

      const secret = generateSecret();
      const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, req.tenantId) });
      const issuer = tenant?.name || "BirSaaS";
      const otpauthURI = getOTPAuthURI({ secret, label: user.username, issuer });

      res.json({ secret, otpauthURI });
    } catch (error) {
      res.status(500).json({ message: "2FA qurulması zamanı xəta baş verdi" });
    }
  });

  router.post("/auth/2fa-activate", async (req: AuthenticatedRequest, res) => {
    try {
      const username = req.headers["x-user-username"];
      const { secret, token } = req.body;
      if (!username) return res.status(401).json({ message: "Səlahiyyətləndirmə xətası" });
      if (!secret || !token) return res.status(400).json({ message: "Gizli açar və OTP kod daxil edilməlidir" });

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.username, String(username)), eq(schema.users.tenantId, req.tenantId))
      });
      if (!user) return res.status(404).json({ message: "İstifadəçi tapılmadı" });

      const isValid = verifyTOTP(token, secret);
      if (!isValid) return res.status(400).json({ message: "Daxil edilən OTP kod yanlışdır" });

      await db.update(schema.users).set({ twoFactorSecret: secret, twoFactorEnabled: 1, twoFactorTrustedDevices: JSON.stringify([]) }).where(eq(schema.users.id, user.id));
      await logActivity(req, "2FA Aktiv Edildi", `İstifadəçi '${user.username}' 2FA təhlükəsizliyini aktiv etdi`);
      res.json({ success: true, message: "İki-mərhələli təhlükəsizlik (2FA) uğurla aktiv edildi!" });
    } catch (error) {
      res.status(500).json({ message: "2FA aktivləşdirilməsi zamanı xəta baş verdi" });
    }
  });

  router.post("/auth/2fa-verify", async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, token, rememberDevice } = req.body;
      if (!userId || !token) return res.status(400).json({ message: "İstifadəçi ID və OTP kod daxil edilməlidir" });

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.id, Number(userId)), eq(schema.users.tenantId, req.tenantId))
      });
      if (!user || !user.twoFactorSecret) return res.status(404).json({ message: "İstifadəçi və ya 2FA tənzimləmələri tapılmadı" });

      const isValid = verifyTOTP(token, user.twoFactorSecret);
      if (!isValid) return res.status(400).json({ message: "Daxil edilən OTP kod yanlışdır" });

      let deviceToken = "";
      if (rememberDevice) {
        deviceToken = crypto.randomUUID();
        const clientIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1").split(",")[0].trim();
        const expireAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        let trustedDevices: any[] = [];
        if (user.twoFactorTrustedDevices) {
          try { trustedDevices = JSON.parse(user.twoFactorTrustedDevices); } catch (e) {}
        }
        trustedDevices.push({ deviceToken, ip: clientIp, expireAt });
        await db.update(schema.users).set({ twoFactorTrustedDevices: JSON.stringify(trustedDevices) }).where(eq(schema.users.id, user.id));
      }

      const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, user.tenantId) });
      const tokenStr = generateToken({ userId: user.id, username: user.username, role: user.role, tenantId: user.tenantId });

      res.json({
        id: user.id, username: user.username, role: user.role, tenantId: user.tenantId,
        tenantName: tenant?.name || "Qazan POS", tenantSlug: tenant?.slug || "demo",
        deviceToken: rememberDevice ? deviceToken : undefined, token: tokenStr
      });
    } catch (error) {
      res.status(500).json({ message: "2FA təsdiqlənməsi zamanı xəta baş verdi" });
    }
  });

  router.post("/auth/2fa-disable", async (req: AuthenticatedRequest, res) => {
    try {
      const username = req.headers["x-user-username"];
      if (!username) return res.status(401).json({ message: "Səlahiyyətləndirmə xətası" });

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.username, String(username)), eq(schema.users.tenantId, req.tenantId))
      });
      if (!user) return res.status(404).json({ message: "İstifadəçi tapılmadı" });

      await db.update(schema.users).set({ twoFactorSecret: null, twoFactorEnabled: 0, twoFactorTrustedDevices: JSON.stringify([]) }).where(eq(schema.users.id, user.id));
      await logActivity(req, "2FA Deaktiv Edildi", `İstifadəçi '${user.username}' 2FA təhlükəsizliyini söndürdü`);
      res.json({ success: true, message: "İki-mərhələli təhlükəsizlik deaktiv edildi!" });
    } catch (error) {
      res.status(500).json({ message: "2FA söndürülməsi zamanı xəta baş verdi" });
    }
  });

  router.get("/auth/qz-certificate", async (req: AuthenticatedRequest, res) => {
    try {
      const certPath = path.resolve(__dirname, "../../auth/digital-certificate.txt");
      if (!fs.existsSync(certPath)) return res.status(404).json({ message: "Rəqəmsal sertifikat tapılmadı" });
      const cert = fs.readFileSync(certPath, "utf8");
      res.type("text/plain").send(cert);
    } catch (error) {
      res.status(500).json({ message: "Sertifikatı gətirərkən xəta baş verdi" });
    }
  });

  router.post("/auth/qz-sign", async (req: AuthenticatedRequest, res) => {
    try {
      const { request } = req.body;
      if (!request) return res.status(400).json({ message: "İmzalanacaq məlumat daxil edilməyib" });

      const keyPath = path.resolve(__dirname, "../../auth/private-key.pem");
      if (!fs.existsSync(keyPath)) return res.status(500).json({ message: "Rəqəmsal imza açarı tapılmadı" });

      const privateKey = fs.readFileSync(keyPath, "utf8");
      const signer = crypto.createSign("RSA-SHA512");
      signer.update(request);
      const signature = signer.sign(privateKey, "base64");
      res.type("text/plain").send(signature);
    } catch (error) {
      res.status(500).json({ message: "İmzalama zamanı xəta baş verdi" });
    }
  });

  router.get("/users/me", async (req: AuthenticatedRequest, res) => {
    try {
      const username = req.headers["x-user-username"] as string;
      const role = req.headers["x-user-role"] as string;
      if (!username) return res.status(401).json({ message: "İstifadəçi tapılmadı" });

      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.username, username.trim().toLowerCase()), eq(schema.users.tenantId, req.tenantId))
      });

      if (!user) return res.status(404).json({ message: "İstifadəçi tapılmadı" });

      res.json({
        id: user.id, username: user.username, role: user.role,
        staffCanViewSalesHistory: user.staffCanViewSalesHistory,
        staffCanViewStock: user.staffCanViewStock,
        staffCanViewCustomers: user.staffCanViewCustomers,
        staffCanViewVendors: user.staffCanViewVendors,
        staffCanViewExpenses: user.staffCanViewExpenses,
        staffCanViewStockBalances: user.staffCanViewStockBalances,
        staffCanViewDebts: user.staffCanViewDebts,
        staffCanManageCatalog: user.staffCanManageCatalog,
        warehouseId: user.warehouseId,
      });
    } catch (error) {
      res.status(500).json({ message: "İstifadəçi məlumatları gətirilərkən xəta baş verdi" });
    }
  });

  router.put("/users/:id/warehouse", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { warehouseId } = req.body;
      const [updated] = await db.update(schema.users).set({ warehouseId: warehouseId || null })
        .where(and(eq(schema.users.id, id), eq(schema.users.tenantId, req.tenantId))).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "İstifadəçi anbar məlumatı yenilənərkən xəta baş verdi" });
    }
  });

  return router;
}
