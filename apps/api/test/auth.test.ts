import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeApiKey } from "../src/auth.ts";

test("equal keys authorize", () => {
  assert.equal(authorizeApiKey("local-api-key", "local-api-key"), true);
});

test("different keys reject", () => {
  assert.equal(authorizeApiKey("local-api-key", "local-api-keY"), false);
});

test("different lengths reject without throwing", () => {
  assert.equal(authorizeApiKey("short", "much-longer-key"), false);
});

test("empty expected rejects", () => {
  assert.equal(authorizeApiKey("local-api-key", ""), false);
});

test("undefined provided rejects", () => {
  assert.equal(authorizeApiKey(undefined, "local-api-key"), false);
});
