"use server";

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey(): Buffer {
  const hex = process.env.VAULT_MASTER_KEY;
  if (!hex) {
    throw new Error("VAULT_MASTER_KEY is not configured");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`VAULT_MASTER_KEY must be ${KEY_LENGTH} bytes (64 hex chars)`);
  }
  return key;
}

export function encryptSecret(plaintext: string, keyVersion = 1): { encrypted: string; iv: string } {
  const masterKey = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  const combined = `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;

  return {
    encrypted: combined,
    iv: iv.toString("hex"),
  };
}

export function decryptSecret(encrypted: string): string {
  const masterKey = getMasterKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, undefined, "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
