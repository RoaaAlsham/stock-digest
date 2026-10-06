import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256Hex, signOutbound } from "../src/client.ts";

const BODY = '{"to":"ops@example.com","subject":"s","html_body":"<p>h</p>","text_body":"t"}';
const BODY_HASH = "a1a95500d1f8e34c53842326b71486e6cfcb596405e5c527dc4d80552c44eb87";
const KNOWN_HMAC = "4ce8d8b75e353215fe30aa91a61e582500b80ec24840bd9cf70fcb10c012a78d";

test("known outbound email vector", () => {
  const signed = signOutbound({
    secret: "hmac-test",
    method: "POST",
    pathAndQuery: "/api/gateway/notifications/email",
    timestamp: "1700000000",
    rawBody: BODY,
  });
  assert.equal(sha256Hex(BODY), BODY_HASH);
  assert.equal(signed.bodyHash, BODY_HASH);
  assert.equal(signed.signature, KNOWN_HMAC);
});
