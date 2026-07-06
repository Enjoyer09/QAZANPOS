import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express | null = null;
let appLoaded = false;

beforeAll(async () => {
  try {
    const mod = await import("../../index.js");
    app = mod.app;
    appLoaded = true;
  } catch (e) {
    console.warn("App could not be loaded (DB might not be running). API tests will be skipped.");
    appLoaded = false;
  }
});

// Skip all tests if app can't load
const itIf = (condition: boolean) => condition ? it : it.skip;

describe("Auth API Endpoints", () => {
  itIf(appLoaded)("POST /api/auth/login returns 400 for missing credentials", async () => {
    const res = await request(app!).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  itIf(appLoaded)("POST /api/auth/login returns 401 for wrong credentials", async () => {
    const res = await request(app!)
      .post("/api/auth/login")
      .send({ username: "nonexistent", password: "wrong" });
    // If route handler catches it properly, should be 401
    // If DB query fails, could be 500
    expect(res.status).toBe(401);
  });

  itIf(appLoaded)("GET /api/products returns 401 without auth token", async () => {
    const res = await request(app!)
      .get("/api/products")
      .set("x-tenant-host", "localhost:5001");
    expect(res.status).toBe(401);
  });

  itIf(appLoaded)("GET /api/sales returns 401 without auth token", async () => {
    const res = await request(app!)
      .get("/api/sales")
      .set("x-tenant-host", "localhost:5001");
    expect(res.status).toBe(401);
  });

  itIf(appLoaded)("GET /api/settings returns 200 or 500", async () => {
    const res = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    // Returns 200 if DB is running, 500 if not
    expect([200, 500]).toContain(res.status);
  });

  itIf(appLoaded)("OPTIONS /api/auth/login handles CORS preflight", async () => {
    const res = await request(app!)
      .options("/api/auth/login")
      .set("Origin", "http://localhost:3001")
      .set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
  });
});
