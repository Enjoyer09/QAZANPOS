import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import https from "https";

export async function sendTelegramNotification(tenantId: number, message: string) {
  try {
    // 1. Fetch settings for tenant
    const tenantSettings = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.tenantId, tenantId))
      .limit(1);

    if (tenantSettings.length === 0) return;
    const s = tenantSettings[0];
    if (!s) return;

    // 2. Check if notifications are enabled
    const botToken = s.telegramBotToken;
    const chatIdRaw = s.telegramChatId;
    if (s.telegramNotificationsEnabled !== 1 || !botToken || !chatIdRaw) {
      return;
    }

    const token = botToken.trim();
    const chatId = chatIdRaw.trim();

    // 3. Make Telegram HTTPS call
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        // Silent success log
        console.log(`Telegram Bot notification delivered to Chat: ${chatId}`);
      });
    });

    req.on("error", (e) => {
      console.error(`Telegram Bot notification failed: ${e.message}`);
    });

    req.write(payload);
    req.end();
  } catch (error) {
    console.error("Telegram notification dispatcher error:", error);
  }
}
