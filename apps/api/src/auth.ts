import { timingSafeEqual } from "node:crypto";

export function authorizeApiKey(provided: string | undefined, expected: string): boolean {
  if (provided === undefined || provided.length === 0 || expected.length === 0) {
    return false;
  }
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  if (providedBytes.byteLength !== expectedBytes.byteLength) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}
