import assert from "node:assert/strict";
import { test } from "node:test";
import { findLowStock } from "../src/digest.ts";
import type { Product } from "../src/digest.ts";

const updatedAt = "2026-01-01T00:00:00.000Z";

function product(
  id: number,
  sku: string,
  name: string,
  quantity: number,
  reorderAt: number,
): Product {
  return {
    id,
    sku,
    name,
    quantity,
    reorder_at: reorderAt,
    updated_at: updatedAt,
  };
}

const seeded = [
  product(1, "WIDGET-1", "Widget", 100, 10),
  product(2, "GADGET-2", "Gadget", 3, 10),
  product(3, "BOLT-9", "Bolt", 0, 5),
  product(4, "CRATE-4", "Crate", 50, 5),
];

test("seeded catalog marks GADGET-2 and BOLT-9 as low stock", () => {
  const low = findLowStock(seeded).map((item) => item.sku);
  assert.deepEqual(low, ["GADGET-2", "BOLT-9"]);
});

test("WIDGET-1 and CRATE-4 are not low stock", () => {
  const low = new Set(findLowStock(seeded).map((item) => item.sku));
  assert.equal(low.has("WIDGET-1"), false);
  assert.equal(low.has("CRATE-4"), false);
});

test("equal quantity and reorder point is low stock", () => {
  const low = findLowStock([product(1, "EVEN-1", "Even", 5, 5)]);
  assert.equal(low.length, 1);
  assert.equal(low[0]?.sku, "EVEN-1");
});

test("empty input returns an empty array", () => {
  assert.deepEqual(findLowStock([]), []);
});
