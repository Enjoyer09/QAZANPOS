import { describe, it, expect } from "vitest";
import { generateHOTP, verifyTOTP, generateSecret, getOTPAuthURI } from "../db/totp.js";

describe("generateSecret", () => {
  it("generates a Base32 string", () => {
    const secret = generateSecret();
    expect(secret).toBeTruthy();
    expect(typeof secret).toBe("string");
    // Base32 alphabet: A-Z, 2-7
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("generates default length of 16", () => {
    const secret = generateSecret();
    expect(secret.length).toBe(16);
  });

  it("generates different secrets each time", () => {
    const secret1 = generateSecret();
    const secret2 = generateSecret();
    expect(secret1).not.toBe(secret2);
  });

  it("generates custom length", () => {
    const secret = generateSecret(32);
    expect(secret.length).toBe(32);
  });

  it("generates shorter length", () => {
    const secret = generateSecret(8);
    expect(secret.length).toBe(8);
  });
});

describe("generateHOTP", () => {
  it("generates a 6-digit string", () => {
    const secret = generateSecret();
    const code = generateHOTP(secret, 0);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("generates different codes for different counters", () => {
    const secret = generateSecret();
    const code1 = generateHOTP(secret, 0);
    const code2 = generateHOTP(secret, 1);
    expect(code1).not.toBe(code2);
  });

  it("pads with leading zeros when needed", () => {
    // Use a fixed secret to get a deterministic code
    const secret = "AAAAAAAAAAAAAAAA";
    const code = generateHOTP(secret, 0);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("is deterministic for same secret and counter", () => {
    const secret = generateSecret();
    const code1 = generateHOTP(secret, 5);
    const code2 = generateHOTP(secret, 5);
    expect(code1).toBe(code2);
  });

  it("handles large counter values", () => {
    const secret = generateSecret();
    const code = generateHOTP(secret, 9999999);
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("verifyTOTP", () => {
  it("verifies a valid TOTP code", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000);
    const currentStep = Math.floor(now / 30);
    const correctCode = generateHOTP(secret, currentStep);
    expect(verifyTOTP(correctCode, secret)).toBe(true);
  });

  it("rejects an invalid TOTP code", () => {
    const secret = generateSecret();
    expect(verifyTOTP("000000", secret)).toBe(false);
  });

  it("rejects empty token", () => {
    const secret = generateSecret();
    expect(verifyTOTP("", secret)).toBe(false);
  });

  it("accepts codes from within the drift window", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000);
    const previousStep = Math.floor(now / 30) - 1;
    const prevCode = generateHOTP(secret, previousStep);
    // Default window is 1, so previous step should be accepted
    expect(verifyTOTP(prevCode, secret)).toBe(true);
  });

  it("rejects codes outside the drift window", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000);
    const farStep = Math.floor(now / 30) - 5;
    const farCode = generateHOTP(secret, farStep);
    // Default window is 1, so 5 steps ago should NOT be accepted
    expect(verifyTOTP(farCode, secret)).toBe(false);
  });

  it("accepts codes with custom window size", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000);
    const farStep = Math.floor(now / 30) - 3;
    const farCode = generateHOTP(secret, farStep);
    // Window of 3 should accept the code from 3 steps ago
    expect(verifyTOTP(farCode, secret, { window: 3 })).toBe(true);
  });
});

describe("getOTPAuthURI", () => {
  it("generates a valid otpauth:// URI", () => {
    const secret = generateSecret();
    const uri = getOTPAuthURI({
      secret,
      label: "user@example.com",
      issuer: "BirSaaS",
    });
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=" + secret);
    expect(uri).toContain("BirSaaS");
  });

  it("includes all required parameters", () => {
    const secret = generateSecret();
    const uri = getOTPAuthURI({
      secret,
      label: "admin@birsaas.com",
      issuer: "BirSaaS",
    });
    expect(uri).toContain("secret=");
    expect(uri).toContain("issuer=");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("encodes special characters in label", () => {
    const secret = generateSecret();
    const uri = getOTPAuthURI({
      secret,
      label: "user name@company",
      issuer: "Test Co",
    });
    // Spaces should be URL encoded
    expect(uri).not.toContain("user name");
    expect(uri).toContain("user%20name");
  });
});
