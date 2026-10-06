export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type Route =
  | { name: "health" }
  | { name: "list-products" }
  | { name: "get-product"; sku: string }
  | { name: "adjust"; sku: string }
  | { name: "list-digests" }
  | { name: "create-digest" }
  | { name: "not-found" }
  | { name: "method-not-allowed" };

function decodeSku(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function matchRoute(method: string, pathname: string): Route {
  const pieces = pathname.split("/");
  if (pieces[0] !== "") return { name: "not-found" };
  const segments = pieces.slice(1);
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return { name: "not-found" };
  }

  if (segments.length === 1 && segments[0] === "health") {
    return method === "GET" ? { name: "health" } : { name: "method-not-allowed" };
  }
  if (segments.length === 1 && segments[0] === "products") {
    return method === "GET" ? { name: "list-products" } : { name: "method-not-allowed" };
  }
  if (segments.length === 1 && segments[0] === "digests") {
    if (method === "GET") return { name: "list-digests" };
    if (method === "POST") return { name: "create-digest" };
    return { name: "method-not-allowed" };
  }
  if (segments.length === 2 && segments[0] === "products" && segments[1] !== undefined) {
    const sku = decodeSku(segments[1]);
    if (sku === null || sku.length === 0) return { name: "not-found" };
    return method === "GET" ? { name: "get-product", sku } : { name: "method-not-allowed" };
  }
  if (
    segments.length === 3 &&
    segments[0] === "products" &&
    segments[1] !== undefined &&
    segments[2] === "adjust"
  ) {
    const sku = decodeSku(segments[1]);
    if (sku === null || sku.length === 0) return { name: "not-found" };
    return method === "POST" ? { name: "adjust", sku } : { name: "method-not-allowed" };
  }

  return { name: "not-found" };
}

export function parseJsonBody(rawBody: string): { ok: true; value: unknown } | { ok: false } {
  if (rawBody === "") {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false };
  }
}

export function readDelta(value: unknown): number | null {
  if (value === null || typeof value !== "object") return null;
  const delta = (value as { delta?: unknown }).delta;
  if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
  return delta;
}

export function readItems(value: unknown): unknown[] | null {
  if (value === null || typeof value !== "object") return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  return items;
}
