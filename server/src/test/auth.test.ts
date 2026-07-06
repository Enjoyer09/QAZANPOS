import { describe, it, expect } from "vitest";
import { hashPassword, generateToken, verifyToken } from "../lib/auth.js";

describe("hashPassword", () => {
  it("hashes a password to a hex string", () => {
    const hash = hashPassword("test123");
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it("produces consistent hashes for the same input", () => {
    const hash1 = hashPassword("mypassword");
    const hash2 = hashPassword("mypassword");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashPassword("password1");
    const hash2 = hashPassword("password2");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const hash = hashPassword("");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
  });

  it("handles special characters", () => {
    const hash = hashPassword("!@#$%^&*()_+{}:\"|<>?~`123");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
  });

  it("handles Unicode characters", () => {
    const hash = hashPassword("şəhərçi_123əüöğı");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
  });
});

describe("generateToken / verifyToken", () => {
  it("generates a valid JWT-like token", () => {
    const payload = { userId: 1, username: "admin", role: "Admin", tenantId: 1 };
    const token = generateToken(payload);
    expect(token).toBeTruthy();
    expect(token.split(".").length).toBe(3); // header.payload.signature
  });

  it("verifies a valid token and returns decoded payload", () => {
    const payload = { userId: 1, username: "admin", role: "Admin", tenantId: 1 };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe(1);
    expect(decoded.username).toBe("admin");
    expect(decoded.role).toBe("Admin");
    expect(decoded.tenantId).toBe(1);
  });

  it("returns null for an invalid token", () => {
    const result = verifyToken("invalid.token.here");
    expect(result).toBeNull();
  });

  it("returns null for malformed token", () => {
    const result = verifyToken("not-a-token");
    expect(result).toBeNull();
  });

  it("returns null for tampered token", () => {
    const payload = { userId: 1, username: "admin", role: "Admin", tenantId: 1 };
    const token = generateToken(payload);
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
    const result = verifyToken(tamperedToken);
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = verifyToken("");
    expect(result).toBeNull();
  });

  it("verifies token with multiple fields", () => {
    const payload = { userId: 42, username: "staff_user", role: "Staff", tenantId: 5, exp: 9999999999 };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe(42);
    expect(decoded.role).toBe("Staff");
    expect(decoded.tenantId).toBe(5);
  });
});
