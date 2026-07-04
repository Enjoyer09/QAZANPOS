import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const PASSWORD_SALT = process.env.PASSWORD_SALT || "qazanpos_salt_2026";

/**
 * Hash a plain text password using HMAC-SHA256 with a fixed salt.
 */
export function hashPassword(password: string): string {
  return crypto.createHmac("sha256", PASSWORD_SALT).update(password).digest("hex");
}

/**
 * Generate a JWT-like signed token using built-in crypto.
 */
export function generateToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${data}`)
    .digest("base64url");
  return `${header}.${data}.${signature}`;
}

/**
 * Verify and decode a JWT-like token. Returns null if signature is invalid or parsing fails.
 */
export function verifyToken(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${data}`)
      .digest("base64url");
    if (signature !== expectedSignature) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
  } catch (e) {
    return null;
  }
}
