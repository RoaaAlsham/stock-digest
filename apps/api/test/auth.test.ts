import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalInboundPath,
  hmacSha256Hex,
  inboundPayload,
  sha256Hex,
  verifyGatewaySignature,
} from "../src/auth.ts";

const SECRET = "test-secret";
const GATEWAY_KEY = "gwk_test";
const NOW = 1_700_000_000;
const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const KNOWN_PAYLOAD =
  "GET\n/products\n1700000000\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const KNOWN_HMAC = "acd004125ced64d1dad5a044784ed7f04ebe5ab925b658779f994051c21be186";

function verify(overrides: Partial<Parameters<typeof verifyGatewaySignature>[0]> = {}) {
  return verifyGatewaySignature({
    method: "GET",
    pathname: "/products",
    rawBody: "",
    gatewayKeyHeader: GATEWAY_KEY,
    signatureHeader: `t=${NOW},v1=${KNOWN_HMAC}`,
    expectedGatewayKey: GATEWAY_KEY,
    serviceSecret: SECRET,
    nowSeconds: NOW,
    ...overrides,
  });
}

test("known inbound vector matches", () => {
  assert.equal(sha256Hex(""), EMPTY_HASH);
  assert.equal(inboundPayload("GET", "/products", "1700000000", ""), KNOWN_PAYLOAD);
  assert.equal(hmacSha256Hex(SECRET, KNOWN_PAYLOAD), KNOWN_HMAC);
  assert.equal(verify(), true);
});

test("tampered hex fails", () => {
  const tampered = `${KNOWN_HMAC.slice(0, -1)}0`;
  assert.notEqual(tampered, KNOWN_HMAC);
  assert.equal(verify({ signatureHeader: `t=${NOW},v1=${tampered}` }), false);
});

test("timestamp 1 fails when now is far from 1", () => {
  const payload = inboundPayload("GET", "/products", "1", "");
  const mac = hmacSha256Hex(SECRET, payload);
  assert.equal(
    verify({
      signatureHeader: `t=1,v1=${mac}`,
      nowSeconds: NOW,
    }),
    false,
  );
});

test("wrong gateway key fails", () => {
  assert.equal(verify({ gatewayKeyHeader: "gwk_other" }), false);
});

test("trailing slash is normalized before signing", () => {
  assert.equal(canonicalInboundPath("/products/"), "/products");
  assert.equal(verify({ pathname: "/products/" }), true);
});

test("query strings are not part of the path", () => {
  const pathname = new URL("https://stock-api.example/products?sku=1").pathname;
  assert.equal(pathname, "/products");
  assert.equal(verify({ pathname }), true);
  const withQuery = hmacSha256Hex(SECRET, "GET\n/products?sku=1\n1700000000\n" + EMPTY_HASH);
  assert.equal(verify({ signatureHeader: `t=${NOW},v1=${withQuery}` }), false);
});

test("different signature lengths do not throw", () => {
  assert.equal(verify({ signatureHeader: `t=${NOW},v1=abc` }), false);
});
