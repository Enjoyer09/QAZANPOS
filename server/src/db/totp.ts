import crypto from "crypto";

/**
 * Decodes a standard Base32 encoded string into a Buffer.
 */
function base32Decode(base32Str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i]!;
    const idx = alphabet.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generates an HOTP code for a given secret and counter.
 */
export function generateHOTP(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(counterBuf);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1]! & 0xf;
  const code =
    ((hmacResult[offset]! & 0x7f) << 24) |
    ((hmacResult[offset + 1]! & 0xff) << 16) |
    ((hmacResult[offset + 2]! & 0xff) << 8) |
    (hmacResult[offset + 3]! & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verifies a given TOTP token against a secret with a drift window.
 * Default drift window is 1 (covers current 30s window + 1 before + 1 after).
 */
export function verifyTOTP(token: string, secret: string, options: { window?: number } = {}): boolean {
  const window = options.window ?? 1;
  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / 30);

  for (let i = -window; i <= window; i++) {
    const step = currentStep + i;
    if (generateHOTP(secret, step) === token) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a random Base32 secret key.
 */
export function generateSecret(length: number = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const randomBytes = crypto.randomBytes(length);
  let secret = "";
  for (let i = 0; i < length; i++) {
    const byte = randomBytes[i];
    if (byte !== undefined) {
      secret += alphabet[byte % alphabet.length];
    }
  }
  return secret;
}

/**
 * Generates a standard OTPAuth URL for Google Authenticator.
 */
export function getOTPAuthURI(options: {
  secret: string;
  label: string;
  issuer: string;
}): string {
  const { secret, label, issuer } = options;
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
