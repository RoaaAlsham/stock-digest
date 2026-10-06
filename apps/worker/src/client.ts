import { createHash, createHmac } from "node:crypto";
import type { WorkerConfig } from "./config.ts";
import type { Product } from "./digest.ts";
import { buildDigestEmail } from "./email.ts";
import type { DigestEmail } from "./email.ts";

const PRODUCTS_PATH = "/api/gateway/proxy/stock-api/products";
const EMAIL_PATH = "/api/gateway/notifications/email";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function signOutbound(input: {
  secret: string;
  method: string;
  pathAndQuery: string;
  timestamp: string;
  rawBody: string;
}): { bodyHash: string; signature: string } {
  const bodyHash = sha256Hex(input.rawBody);
  const payload = `${input.method}\n${input.pathAndQuery}\n${input.timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", input.secret).update(payload, "utf8").digest("hex");
  return { bodyHash, signature };
}

export async function signedFetch(
  config: WorkerConfig,
  method: string,
  path: string,
  body?: string,
  timestamp = String(Math.floor(Date.now() / 1000)),
): Promise<Response> {
  const rawBody = body ?? "";
  const signed = signOutbound({
    secret: config.hmacSecret,
    method,
    pathAndQuery: path,
    timestamp,
    rawBody,
  });
  const headers: Record<string, string> = {
    "X-API-Key": config.serviceKey,
    "X-HMAC-Signature": `t=${timestamp},v1=${signed.signature}`,
  };
  if (rawBody !== "") {
    headers["Content-Type"] = "application/json";
  }
  return await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: rawBody === "" ? undefined : rawBody,
  });
}

export async function getProducts(config: WorkerConfig): Promise<Product[]> {
  const response = await signedFetch(config, "GET", PRODUCTS_PATH);
  if (!response.ok) {
    throw new Error(`GET ${PRODUCTS_PATH} ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { products: Product[] };
  return payload.products;
}

export async function deliverDigest(config: WorkerConfig, items: Product[]): Promise<DigestEmail> {
  const email = buildDigestEmail(config.digestTo, items);
  const rawBody = JSON.stringify(email);
  const response = await signedFetch(config, "POST", EMAIL_PATH, rawBody);
  if (response.status !== 202) {
    throw new Error(`POST ${EMAIL_PATH} ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { accepted?: unknown };
  if (payload.accepted !== true) {
    throw new Error(`POST ${EMAIL_PATH} ${response.status} ${response.statusText}`);
  }
  return email;
}
