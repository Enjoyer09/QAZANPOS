import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import fs from "fs";
import path from "path";

// Dynamically load .env file locally if process.env.DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  try {
    const envPaths = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "server/.env")
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...valueParts] = trimmed.split("=");
            const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
            process.env[key.trim()] = value;
          }
        }
        break;
      }
    }
  } catch (error) {
    console.warn("Failed to load local .env file:", error);
  }
}

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/qazanpos";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

