import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

export interface ProviderSecretContext {
  accountId: string;
  provider: string;
  salonId: string;
}

export interface EncryptedSecret {
  authenticationTag: string;
  ciphertext: string;
  initializationVector: string;
  keyVersion: string;
}

function currentKeyVersion(): string {
  const version = process.env.PROVIDER_CREDENTIAL_KEY_VERSION?.trim() || "v1";
  if (!/^[a-zA-Z0-9._-]{1,32}$/.test(version)) {
    throw new Error("PROVIDER_CREDENTIAL_KEY_VERSION is invalid");
  }
  return version;
}

function keyEnvironmentName(version: string): string {
  return `PROVIDER_CREDENTIAL_ENCRYPTION_KEY_${version.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

function encryptionKey(version: string): Buffer {
  const currentVersion = currentKeyVersion();
  const encoded = version === currentVersion
    ? process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    : process.env[keyEnvironmentName(version)];
  if (!encoded) {
    throw new Error(`Provider credential key version ${version} is unavailable`);
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("PROVIDER_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

function additionalAuthenticatedData(context: ProviderSecretContext): Buffer {
  return Buffer.from(
    JSON.stringify(["esse-beauty-provider-secret", context.salonId, context.accountId, context.provider]),
    "utf8",
  );
}

export function encryptProviderSecret(
  secret: string,
  context: ProviderSecretContext,
): EncryptedSecret {
  if (!secret.trim()) throw new Error("Provider credential cannot be empty");
  const keyVersion = currentKeyVersion();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyVersion), iv);
  cipher.setAAD(additionalAuthenticatedData(context));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);

  return {
    authenticationTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    initializationVector: iv.toString("base64"),
    keyVersion,
  };
}

export function decryptProviderSecret(
  row: EncryptedSecret,
  context: ProviderSecretContext,
): string {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(row.keyVersion),
      Buffer.from(row.initializationVector, "base64"),
    );
    decipher.setAAD(additionalAuthenticatedData(context));
    decipher.setAuthTag(Buffer.from(row.authenticationTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Provider credential authentication failed");
  }
}
