import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_HEADER = /^t=(\d+),v1=([0-9a-f]+)$/;
const MAX_SKEW_SECONDS = 300;

export function canonicalInboundPath(pathname: string): string {
  let path = pathname;
  if (path.length === 0) return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path.length === 0 ? "/" : path;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function sameSecret(provided: string, expected: string): boolean {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  if (providedBytes.byteLength === 0 || providedBytes.byteLength !== expectedBytes.byteLength) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

export type GatewayAuthInput = {
  method: string;
  pathname: string;
  rawBody: string;
  gatewayKeyHeader: string | undefined;
  signatureHeader: string | undefined;
  expectedGatewayKey: string;
  serviceSecret: string;
  nowSeconds: number;
};

export function inboundPayload(method: string, pathname: string, timestamp: string, rawBody: string): string {
  const path = canonicalInboundPath(pathname);
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${sha256Hex(rawBody)}`;
}

export function verifyGatewaySignature(input: GatewayAuthInput): boolean {
  if (!sameSecret(input.gatewayKeyHeader ?? "", input.expectedGatewayKey)) {
    return false;
  }
  const match = SIGNATURE_HEADER.exec(input.signatureHeader ?? "");
  const timestamp = match?.[1];
  const providedMac = match?.[2];
  if (!timestamp || !providedMac) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(input.nowSeconds - timestampSeconds) > MAX_SKEW_SECONDS) return false;

  const expectedMac = hmacSha256Hex(
    input.serviceSecret,
    inboundPayload(input.method, input.pathname, timestamp, input.rawBody),
  );
  return sameSecret(providedMac, expectedMac);
}
