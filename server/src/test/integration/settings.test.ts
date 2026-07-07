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
    console.warn("App could not be loaded (DB might not be running). Settings tests will be skipped.");
    appLoaded = false;
  }
});

const itIf = (condition: boolean) => condition ? it : it.skip;

describe("Settings API - requireShift Persistence", () => {
  itIf(appLoaded)("should save requireShift=0 and return it via GET", async () => {
    // Set requireShift to 0 (disabled)
    const putRes = await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 0 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.requireShift).toBe(0);

    // Verify via GET
    const getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.status).toBe(200);
    expect(getRes.body.requireShift).toBe(0);
  });

  itIf(appLoaded)("should save requireShift=1 and return it via GET", async () => {
    // Set requireShift to 1 (enabled)
    const putRes = await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 1 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.requireShift).toBe(1);

    // Verify via GET
    const getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.status).toBe(200);
    expect(getRes.body.requireShift).toBe(1);
  });

  itIf(appLoaded)("should persist requireShift across multiple save cycles", async () => {
    // Cycle: 1 -> 0 -> 1
    await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 1 });

    let getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.body.requireShift).toBe(1);

    // Change to 0
    await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 0 });

    getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.body.requireShift).toBe(0);

    // Change back to 1
    await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 1 });

    getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.body.requireShift).toBe(1);
  });

  itIf(appLoaded)("should not affect other settings fields when saving requireShift", async () => {
    // Get current state
    const getRes = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes.status).toBe(200);

    const originalStoreName = getRes.body.storeName;
    const originalPhone = getRes.body.phone;

    // Toggle requireShift only
    await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 0 });

    // Verify other fields are unchanged
    const getRes2 = await request(app!)
      .get("/api/settings")
      .set("x-tenant-host", "localhost:5001");
    expect(getRes2.status).toBe(200);
    expect(getRes2.body.storeName).toBe(originalStoreName);
    expect(getRes2.body.phone).toBe(originalPhone);
    expect(getRes2.body.requireShift).toBe(0);

    // Restore
    await request(app!)
      .put("/api/settings")
      .set("x-tenant-host", "localhost:5001")
      .send({ requireShift: 1 });
  });
});
