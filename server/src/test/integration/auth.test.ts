import { describe, it, expect } from "vitest";
import { hashPassword, generateToken, verifyToken } from "../../lib/auth.js";

describe("Auth API - Password Hashing", () => {
  it("hashPassword returns consistent 64-char hex string", () => {
    const hash = hashPassword("test123");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same password produces same hash", () => {
    expect(hashPassword("hello")).toBe(hashPassword("hello"));
  });

  it("different passwords produce different hashes", () => {
    expect(hashPassword("pass1")).not.toBe(hashPassword("pass2"));
  });

  it("handles empty password", () => {
    expect(hashPassword("")).toBeTruthy();
  });

  it("handles Azerbaijani characters in password", () => {
    const hash = hashPassword("şifrə123üöğı");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
  });
});

describe("Auth API - Token Management", () => {
  const payload = { userId: 1, username: "admin", role: "Admin", tenantId: 1 };

  it("generates valid JWT-like token with 3 parts", () => {
    const token = generateToken(payload);
    const parts = token.split(".");
    expect(parts.length).toBe(3);
  });

  it("verifyToken decodes valid token correctly", () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(1);
    expect(decoded?.username).toBe("admin");
    expect(decoded?.role).toBe("Admin");
    expect(decoded?.tenantId).toBe(1);
  });

  it("verifyToken rejects tampered tokens", () => {
    const token = generateToken(payload);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.bad`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("verifyToken rejects malformed input", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("invalid")).toBeNull();
  });
});
