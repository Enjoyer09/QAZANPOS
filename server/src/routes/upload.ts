import { Router, Response } from "express";
import multer from "multer";
import { AuthenticatedRequest, checkUserPermission } from "./helpers.js";
import { uploadProductImage } from "../lib/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Max 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Yalnız şəkil faylları qəbul edilir (JPEG, PNG, WebP, AVIF, GIF)."));
    }
  },
});

export default function uploadRoutes(): Router {
  const router = Router();

  // POST /api/upload/product-image
  router.post(
    "/upload/product-image",
    upload.single("image"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Şəkil faylı təqdim edilməyib." });
        }

        const canManage = await checkUserPermission(req, "staffCanManageCatalog");
        if (!canManage) {
          return res.status(403).json({ message: "Məhsul şəkli yükləmək üçün kataloq idarəetmə icazəniz yoxdur." });
        }

        const mime = req.file.mimetype;
        let ext = "webp";
        if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        else if (mime.includes("png")) ext = "png";
        else if (mime.includes("webp")) ext = "webp";
        else if (mime.includes("avif")) ext = "avif";

        const result = await uploadProductImage(req.tenantId, req.file.buffer, mime, ext);

        res.status(201).json({
          success: true,
          url: result.url,
          storageType: result.storageType,
          size: result.size,
          message: "Şəkil uğurla yükləndi!",
        });
      } catch (error: any) {
        console.error("Product image upload error:", error);
        res.status(500).json({ error: "Şəkil yüklənərkən xəta: " + (error.message || error) });
      }
    }
  );

  return router;
}
