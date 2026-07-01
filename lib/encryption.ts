import crypto from "crypto";
import { requireEnv } from "@/lib/env";

type EncryptedValue = {
  encryptedText: string;
  iv: string;
  authTag: string;
};

function getEncryptionKey(): Buffer {
  const raw = requireEnv("ENCRYPTION_KEY");
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) {
    return base64;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
}

export function encryptSecret(plainText: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  return {
    encryptedText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptSecret(value: EncryptedValue): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(value.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.encryptedText, "base64")),
    decipher.final()
  ]).toString("utf8");
}
