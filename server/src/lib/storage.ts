import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare R2 Environment Variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN; // e.g. "https://cdn.qazanpos.az" or "https://pub-xxx.r2.dev"

let s3Client: S3Client | null = null;

if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
  try {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    console.log("Storage Service: Cloudflare R2 client initialized successfully.");
  } catch (err) {
    console.error("Storage Service: Failed to initialize Cloudflare R2 client:", err);
    s3Client = null;
  }
} else {
  console.log("Storage Service: Cloudflare R2 credentials not set. Falling back to local disk storage (/uploads).");
}

export interface UploadResult {
  url: string;
  key: string;
  storageType: "r2" | "local";
  size: number;
}

/**
 * Upload a product image with strict tenant isolation.
 * Path format: tenants/{tenantId}/products/p_{timestamp}_{randomHex}.{ext}
 */
export async function uploadProductImage(
  tenantId: number,
  fileBuffer: Buffer,
  mimeType: string,
  extension: string = "webp"
): Promise<UploadResult> {
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const filename = `p_${Date.now()}_${randomSuffix}.${extension.replace(/^\./, "")}`;
  const objectKey = `tenants/${tenantId}/products/${filename}`;

  // 1. If Cloudflare R2 is configured, upload to Cloudflare R2
  if (s3Client && R2_BUCKET_NAME) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: mimeType || "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const domain = (R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");
      const publicUrl = domain ? `${domain}/${objectKey}` : `https://${R2_BUCKET_NAME}.r2.dev/${objectKey}`;

      return {
        url: publicUrl,
        key: objectKey,
        storageType: "r2",
        size: fileBuffer.length,
      };
    } catch (r2Error) {
      console.error("Cloudflare R2 upload failed, falling back to local storage:", r2Error);
    }
  }

  // 2. Fallback: Save to local disk (/uploads/tenants/{tenantId}/products/...)
  const uploadsDir = path.resolve(__dirname, "../../uploads");
  const tenantProductDir = path.join(uploadsDir, "tenants", String(tenantId), "products");

  if (!fs.existsSync(tenantProductDir)) {
    fs.mkdirSync(tenantProductDir, { recursive: true });
  }

  const localFilePath = path.join(tenantProductDir, filename);
  fs.writeFileSync(localFilePath, fileBuffer);

  const localUrl = `/uploads/tenants/${tenantId}/products/${filename}`;

  return {
    url: localUrl,
    key: objectKey,
    storageType: "local",
    size: fileBuffer.length,
  };
}
