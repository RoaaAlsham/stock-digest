import type { WorkerConfig } from "./config.ts";
import type { Product } from "./digest.ts";

export async function getProducts(config: WorkerConfig): Promise<Product[]> {
  const path = "/products";
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { "X-Api-Key": config.apiKey },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { products: Product[] };
  return body.products;
}

export async function deliverDigest(config: WorkerConfig, items: Product[]): Promise<void> {
  const path = "/digests";
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} ${response.status} ${response.statusText}`);
  }
}
