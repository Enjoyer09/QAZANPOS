import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import https from "https";

const SMS_API_BASE = "https://1sms.az/api/v1";

/**
 * Send an SMS via 1sms.az API
 */
export async function sendSMS(
  tenantId: number,
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await db.query.settings.findFirst({
      where: eq(schema.settings.tenantId, tenantId),
    });

    if (!settings) return { success: false, error: "Tənzimləmələr tapılmadı" };

    const apiKey = settings.smsApiKey;
    const senderName = settings.smsSenderName || "QAZANPOS";

    if (!apiKey) {
      return { success: false, error: "SMS API açarı təyin edilməyib" };
    }

    // Normalize phone number to +994XXXXXXXXX format
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      return { success: false, error: `Yanlış telefon nömrəsi: ${phoneNumber}` };
    }

    const payload = JSON.stringify({
      recipients: [normalized],
      text: message,
      senderName: senderName,
    });

    const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const url = `${SMS_API_BASE}/sms/notification`;
      const options: https.RequestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const req = https.request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.success === true) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: parsed.message || parsed.error || "SMS göndərilmədi" });
            }
          } catch {
            resolve({ success: false, error: "SMS API cavabı oxunamadı" });
          }
        });
      });

      req.on("error", (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(payload);
      req.end();
    });

    return result;
  } catch (error: any) {
    return { success: false, error: error.message || "SMS göndərilərkən xəta" };
  }
}

/**
 * Send bulk SMS to multiple recipients (same message)
 */
export async function sendBulkSMS(
  tenantId: number,
  phoneNumbers: string[],
  message: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send one by one to track individual failures
  for (const phone of phoneNumbers) {
    const result = await sendSMS(tenantId, phone, message);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${phone}: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}

/**
 * Process SMS template by replacing placeholders with actual values
 * Available placeholders: [AD] (name), [BORC] (debt amount), [TARIX] (due date), [MAQAZA] (store name)
 */
export function processSMSTemplate(
  template: string,
  replacements: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, "g"), value);
  }
  return result;
}

/**
 * Normalize Azerbaijani phone numbers to +994XXXXXXXXX format
 * Accepts: +994XXXXXXXXX, 994XXXXXXXXX, 0XXXXXXXXX, XXXXXXXXX (9 digits), 055XXXXXXXX, 050XXXXXXXX etc.
 */
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  if (cleaned.startsWith("+994") && cleaned.length === 13) {
    return cleaned;
  }
  if (cleaned.startsWith("994") && cleaned.length === 12) {
    return "+" + cleaned;
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+994" + cleaned.substring(1);
  }
  // Without prefix (55XXXXXXX or 50XXXXXXX etc.) - 9 digits
  if (/^[1-9]\d{8}$/.test(cleaned)) {
    return "+994" + cleaned;
  }

  return null;
}
