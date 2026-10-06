import { timingSafeEqual } from "node:crypto";
import { readConfig } from "./config.ts";
import { runDigest } from "./run.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorizeRunKey(provided: string | null, expected: string): boolean {
  if (provided === null || provided.length === 0 || expected.length === 0) {
    return false;
  }
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  if (providedBytes.byteLength !== expectedBytes.byteLength) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

export default {
  async fetch(request, env): Promise<Response> {
    const config = readConfig(env);
    const url = new URL(request.url);
    if (url.pathname !== "/run") {
      return json({ error: "not found" }, 404);
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    if (!config.runSecret) {
      return json({ error: "not configured" }, 500);
    }
    if (!authorizeRunKey(request.headers.get("X-Run-Key"), config.runSecret)) {
      return json({ error: "unauthorized" }, 401);
    }
    const dryRun = url.searchParams.get("dry") === "1";
    const result = await runDigest(config, { dryRun });
    return json(result);
  },
  async scheduled(_controller, env): Promise<void> {
    const config = readConfig(env);
    await runDigest(config, { dryRun: false });
  },
} satisfies ExportedHandler<Env>;
