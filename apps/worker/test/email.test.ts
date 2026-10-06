import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDigestEmail, escapeHtml } from "../src/email.ts";
import type { Product } from "../src/digest.ts";

function product(sku: string, name: string): Product {
  return {
    id: 1,
    sku,
    name,
    quantity: 1,
    reorder_at: 5,
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

test("subject count uses the low-stock length", () => {
  const email = buildDigestEmail("ops@example.com", [
    product("GADGET-2", "Gadget"),
    product("BOLT-9", "Bolt"),
  ]);
  assert.equal(email.subject, "Stock low-stock digest — 2 item(s)");
  assert.equal(email.to, "ops@example.com");
  assert.match(email.text_body, /^Stock low-stock digest — 2 item\(s\)\n/);
  assert.match(email.text_body, /GADGET-2\tGadget\tqty 1\treorder at 5/);
  assert.match(email.html_body, /<th>SKU<\/th><th>Name<\/th><th>Quantity<\/th><th>Reorder at<\/th>/);
});

test("html escapes interpolated values", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  const email = buildDigestEmail("ops@example.com", [product(`A&B`, `Tom <"boss">`)]);
  assert.equal(email.html_body.includes("A&B"), false);
  assert.equal(email.html_body.includes("&amp;"), true);
  assert.equal(email.html_body.includes("<\"boss\">"), false);
  assert.match(email.html_body, /A&amp;B/);
  assert.match(email.html_body, /Tom &lt;&quot;boss&quot;&gt;/);
  assert.match(email.text_body, /A&B\tTom <"boss">\tqty 1\treorder at 5/);
});
