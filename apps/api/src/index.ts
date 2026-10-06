import { verifyGatewaySignature } from "./auth.ts";
import { readConfig } from "./config.ts";
import { adjustProduct, createDigest, getProduct, listDigests, listProducts } from "./db.ts";
import type { Product } from "./db.ts";
import { json, matchRoute, parseJsonBody, readDelta, readItems } from "./http.ts";

async function dispatch(
  route: ReturnType<typeof matchRoute>,
  body: unknown,
  db: D1Database,
): Promise<Response> {
  switch (route.name) {
    case "health":
      return json({ ok: true });
    case "list-products": {
      const products = await listProducts(db);
      return json({ products });
    }
    case "get-product": {
      const product = await getProduct(db, route.sku);
      if (!product) return json({ error: "not found" }, 404);
      return json(product);
    }
    case "adjust": {
      const delta = readDelta(body);
      if (delta === null) return json({ error: "delta must be a number" }, 400);
      const product = await adjustProduct(db, route.sku, delta);
      if (!product) return json({ error: "not found" }, 404);
      return json(product);
    }
    case "create-digest": {
      const items = readItems(body);
      if (!items) return json({ error: "items must be an array" }, 400);
      const digest = await createDigest(db, items as Product[]);
      return json(digest, 201);
    }
    case "list-digests": {
      const digests = await listDigests(db);
      return json({ digests });
    }
    default:
      return json({ error: "not found" }, 404);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const config = readConfig(env);
    const url = new URL(request.url);
    const configured = Boolean(config.gatewayKey && config.serviceSecret);

    if (url.pathname !== "/health" && !configured) {
      return json({ error: "not configured" }, 500);
    }

    const route = matchRoute(request.method, url.pathname);
    if (route.name === "not-found") return json({ error: "not found" }, 404);
    if (route.name === "method-not-allowed") return json({ error: "method not allowed" }, 405);
    if (route.name === "health") return json({ ok: true });

    const rawBody = await request.text();
    const authorized = verifyGatewaySignature({
      method: request.method,
      pathname: url.pathname,
      rawBody,
      gatewayKeyHeader: request.headers.get("X-Gateway-Key") ?? undefined,
      signatureHeader: request.headers.get("X-Gateway-Signature") ?? undefined,
      expectedGatewayKey: config.gatewayKey ?? "",
      serviceSecret: config.serviceSecret ?? "",
      nowSeconds: Date.now() / 1000,
    });
    if (!authorized) {
      return json({ error: "unauthorized" }, 401);
    }

    const userId = request.headers.get("X-AuthDeep-User-ID");
    const userIdPresent = userId !== null && userId.length > 0;
    if (userIdPresent) {
      console.warn("gateway request authenticated — unexpected User-ID header present");
    }
    console.log(
      JSON.stringify({
        auth_type: request.headers.get("X-AuthDeep-Auth-Type"),
        api_key_type: request.headers.get("X-AuthDeep-API-Key-Type"),
        user_id_present: userIdPresent,
      }),
    );

    const needsBody = route.name === "adjust" || route.name === "create-digest";
    let body: unknown;
    if (needsBody) {
      const parsed = parseJsonBody(rawBody);
      if (!parsed.ok) return json({ error: "invalid json" }, 400);
      body = parsed.value;
    }

    try {
      return await dispatch(route, body, config.db);
    } catch (error) {
      console.error(error);
      return json({ error: "internal" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
