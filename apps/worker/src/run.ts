import { deliverDigest, getProducts } from "./client.ts";
import type { WorkerConfig } from "./config.ts";
import { findLowStock } from "./digest.ts";
import type { Product } from "./digest.ts";
import { buildDigestEmail } from "./email.ts";
import type { DigestEmail } from "./email.ts";

export type RunResult =
  | { ok: true; dryRun: true; lowStock: Product[]; email: DigestEmail }
  | { ok: true; delivered: false; count: 0 }
  | { ok: true; delivered: true; count: number };

export async function runDigest(
  config: WorkerConfig,
  options: { dryRun: boolean },
): Promise<RunResult> {
  const products = await getProducts(config);
  const lowStock = findLowStock(products);
  if (lowStock.length === 0) {
    console.log("no low stock");
    return { ok: true, delivered: false, count: 0 };
  }
  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      lowStock,
      email: buildDigestEmail(config.digestTo, lowStock),
    };
  }
  await deliverDigest(config, lowStock);
  console.log("digest sent");
  return { ok: true, delivered: true, count: lowStock.length };
}
