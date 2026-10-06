# stock-digest

Two Cloudflare Workers and one D1 database. An operator stores products. Each product has a quantity and a reorder point. A scheduled job loads every product, keeps the ones at or below their reorder point, and delivers that list.

There is no browser, no user login, and no signup.

| Worker | Role |
| --- | --- |
| `stock-api` | HTTP API. Owns the D1 database `stock-digest` (binding `DB`). |
| `stock-worker` | Cron `0 8 * * *` (08:00 UTC daily) and `POST /run`. No database binding. It reaches data only by HTTP. |

The worker calls the API with a normal `fetch` to its public `https://` origin. On the same Cloudflare account that request would otherwise skip the public edge and return 404, so `stock-worker` also enables the `global_fetch_strictly_public` compatibility flag. There is no service binding.

`main` delivers a low-stock digest by storing a row through the API, using a shared `API_KEY`. Branch `authdeep-integrated` keeps the same routes, SQL, seed, and low-stock rule, and replaces that key with AuthDeep Path C: gateway HMAC on the way in, service-key HMAC on the way out. On that branch the worker sends one email through AuthDeep instead of posting a digest row.

A retried cron can deliver twice. That is acceptable.

## Routes

Every response is `Content-Type: application/json`.

| Method | Path | Auth on main | Success |
| --- | --- | --- | --- |
| GET | `/health` | none | 200 `{ "ok": true }` |
| GET | `/products` | API key | 200 `{ "products": Product[] }` ordered by sku |
| GET | `/products/:sku` | API key | 200 `Product`, or 404 `{ "error": "not found" }` |
| POST | `/products/:sku/adjust` | API key | 200 updated `Product` |
| POST | `/digests` | API key | 201 stored `Digest` |
| GET | `/digests` | API key | 200 `{ "digests": Digest[] }` newest first, at most 20 |

Anything else is 404 `{ "error": "not found" }`. A known path with the wrong method is 405 `{ "error": "method not allowed" }`.

`POST /products/:sku/adjust` body is `{ "delta": number }`. The new quantity is `max(0, current + delta)`. Missing or non-numeric `delta` is 400 `{ "error": "delta must be a number" }`.

`POST /digests` body is `{ "items": Product[] }`. The API stores the array as given. It does not recompute low stock. A body whose `items` is not an array is 400 `{ "error": "items must be an array" }`.

On `main`, protected routes require header `X-Api-Key` equal to the `API_KEY` secret. `/health` ignores that header.

The worker accepts only `POST /run`. Header `X-Run-Key` must match `RUN_SECRET`. `POST /run?dry=1` lists low stock and does not deliver. Other worker paths are 404.

Low-stock rule: `quantity <= reorder_at`.

## Local development

```bash
npm install
```

Copy each app's `.dev.vars.example` to `.dev.vars` and fill in real values. `.dev.vars` is gitignored. Wrangler loads it for `wrangler dev` and does not upload it on deploy.

```bash
npm run db:migrate:local
npm run db:seed:local
npm run dev:api
npm run dev:worker
```

`seed.sql` uses `INSERT OR IGNORE`. Running it again does not change quantities and does not reset rows you have already adjusted.

```bash
npm test
npm run typecheck
```

Tests and typecheck need no secrets and no network.

## Remote database

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

Create the database once with `wrangler d1 create stock-digest` from `apps/api`, and put the returned `database_id` in `apps/api/wrangler.jsonc`. Apply `migrations/0001_init.sql` before the seed.

Deployed secrets are set with `wrangler secret put` from the app directory. Never put secret values in `wrangler.jsonc`, source, tests, or this README.

`main` API:

| Name | Kind |
| --- | --- |
| `DB` | D1 binding |
| `API_KEY` | secret |

`main` worker:

| Name | Kind |
| --- | --- |
| `API_KEY` | secret, same value as the API |
| `API_BASE_URL` | var, API origin, no path and no trailing slash |
| `RUN_SECRET` | secret |

`API_BASE_URL` in `apps/worker/wrangler.jsonc` may be a placeholder until the API is deployed. Set the real `https://stock-api.<account>.workers.dev` origin before relying on the cron.

```bash
npm run deploy:api
npm run deploy:worker
```

## This deployment

`main` is deployed:

| Worker | URL |
| --- | --- |
| `stock-api` | `https://stock-api.alsham.workers.dev` |
| `stock-worker` | `https://stock-worker.alsham.workers.dev` |

The worker cron is `0 8 * * *`. D1 database name `stock-digest`.

## Checks against the deployed API (main)

Replace the origin and send the real `X-Api-Key` / `X-Run-Key` from Wrangler. These examples do not contain secret values.

```bash
curl -sS https://stock-api.<account>.workers.dev/health
curl -sS https://stock-api.<account>.workers.dev/products
curl -sS -H "X-Api-Key: $API_KEY" https://stock-api.<account>.workers.dev/products
curl -sS -X POST -H "X-Api-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"delta\":1}" https://stock-api.<account>.workers.dev/products/BOLT-9/adjust
curl -sS -X POST -H "X-Api-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"delta\":-100}" https://stock-api.<account>.workers.dev/products/BOLT-9/adjust
curl -sS -X POST -H "X-Api-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"delta\":1}" https://stock-api.<account>.workers.dev/products/NOPE/adjust
```

Expected: `/health` is 200 `{ "ok": true }`. `/products` with no key is 401. With the key, 200 and the four products. `BOLT-9` delta `1` sets quantity to 1 (from the seed value 0). Delta `-100` sets quantity to 0. Unknown sku is 404.

Seeded rows:

| sku | name | quantity | reorder_at |
| --- | --- | --- | --- |
| WIDGET-1 | Widget | 100 | 10 |
| GADGET-2 | Gadget | 3 | 10 |
| BOLT-9 | Bolt | 0 | 5 |
| CRATE-4 | Crate | 50 | 5 |

`GADGET-2` and `BOLT-9` start at or below their reorder point. `updated_at` in the seed is `2026-01-01T00:00:00.000Z`.

Worker:

```bash
curl -sS -X POST -H "X-Run-Key: $RUN_SECRET" \
  "https://stock-worker.<account>.workers.dev/run?dry=1"
curl -sS -H "X-Api-Key: $API_KEY" https://stock-api.<account>.workers.dev/digests
curl -sS -X POST -H "X-Run-Key: $RUN_SECRET" \
  https://stock-worker.<account>.workers.dev/run
curl -sS -X POST https://stock-worker.<account>.workers.dev/run
```

Dry run returns 200 with `dryRun: true` and low stock including `GADGET-2` and `BOLT-9`, and does not store a digest. A real `POST /run` returns `delivered: true`. `GET /digests` then shows one row whose items are those low-stock products. `POST /run` without `X-Run-Key` is 401.

## Branch authdeep-integrated

Create this branch from deployed `main`. Keep the routes, SQL, seed, `findLowStock`, `runDigest` control flow, `POST /run`, and the cron. Replace transport and credentials.

AuthDeep is the external gateway. The tenant host is `https://<tenant-slug>.authdeep.com`. Do not call `https://app.authdeep.com` for these requests. The registered service slug is `stock-api`. That slug is part of the outbound path and must match the service registered in AuthDeep.

People authenticate to AuthDeep with a service API key (`sak_…`) and HMAC. AuthDeep then calls this API and signs that hop with a gateway key (`gwk_…`) and a service secret (`ssk_…`). This API never receives a human user id on this path. Do not authorize from `X-AuthDeep-User-ID`, `X-AuthDeep-User-Email`, or `X-AuthDeep-User-Roles`. If `X-AuthDeep-User-ID` is present on an otherwise valid request, still accept it and log one warning: `gateway request authenticated — unexpected User-ID header present`.

`/health` stays unauthenticated so AuthDeep can probe it. `POST /digests` and `GET /digests` stay on the API. The worker on this branch stops calling them.

### Inbound canonical string (gateway → API)

UTF-8, four lines separated by `\n`:

```
METHOD
path
timestamp
sha256hex(rawBody)
```

`METHOD` is the HTTP method, uppercase. `path` is the URL pathname only: no scheme, host, or query. Strip trailing slashes. An empty result becomes `/`. AuthDeep removes the `/api/gateway/proxy/stock-api` prefix before the request arrives, so a product list is signed as `/products`. `timestamp` is the digits from `t=` in `X-Gateway-Signature`. `rawBody` is the exact `request.text()` string. A GET uses `""`. The SHA-256 hex of `""` is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

HMAC-SHA256, key `AUTHDEEP_SERVICE_SECRET`, output hex. Header `X-Gateway-Signature` must match `^t=(\d+),v1=([0-9a-f]+)$`. Header `X-Gateway-Key` must equal `AUTHDEEP_GATEWAY_KEY`. Compare the hex digest to `v1` with `timingSafeEqual` on equal-length byte buffers. A key mismatch, a malformed header, a timestamp more than 300 seconds from `Date.now()/1000`, or a different HMAC is 401 `{ "error": "unauthorized" }`. There is no fallback to `X-Api-Key`.

### Outbound canonical string (worker → AuthDeep)

```
METHOD
path+query
timestamp
sha256hex(rawBody)
```

`path+query` is the path this client requests, including a query string when one exists. These calls have no query. The path is the full AuthDeep path, for example `/api/gateway/proxy/stock-api/products`. `rawBody` is `""` when there is no body, otherwise the exact string passed to `fetch`. Build that string with one `JSON.stringify` and hash that same string. Timestamp is `Math.floor(Date.now()/1000)` as a decimal string.

HMAC-SHA256 with `AUTHDEEP_HMAC_SECRET`, hex. Headers: `X-API-Key: <AUTHDEEP_SERVICE_KEY>` and `X-HMAC-Signature: t=<timestamp>,v1=<hex>`. Send `Content-Type: application/json` only when the body is non-empty.

`getProducts` calls `GET /api/gateway/proxy/stock-api/products` and expects 200 `{ "products": Product[] }`.

`deliverDigest` POSTs to `/api/gateway/notifications/email`:

```json
{
  "to": "<AUTHDEEP_DIGEST_TO>",
  "subject": "Stock low-stock digest — <count> item(s)",
  "html_body": "<h1>…</h1><table>…</table>",
  "text_body": "<subject>\\n<sku>\\t<name>\\tqty <quantity>\\treorder at <reorder_at>"
}
```

`html_body` is a heading plus an HTML table with columns SKU, Name, Quantity, Reorder at. Escape `& < > " '` in every interpolated value. Expect HTTP 202 and JSON `{ "accepted": true }`. Dry run still calls `getProducts` and does not send. The `POST /run?dry=1` response includes the email object: `{ "ok": true, "dryRun": true, "lowStock": [], "email": { … } }`.

### Which secret goes on which Worker

API (`stock-api`):

| Name | Kind |
| --- | --- |
| `DB` | D1 binding, same database as `main` |
| `AUTHDEEP_GATEWAY_KEY` | secret, `gwk_…` |
| `AUTHDEEP_SERVICE_SECRET` | secret, `ssk_…` |

Worker (`stock-worker`):

| Name | Kind |
| --- | --- |
| `AUTHDEEP_BASE_URL` | var, tenant origin `https://<tenant-slug>.authdeep.com`, no trailing slash |
| `AUTHDEEP_SERVICE_KEY` | secret, `sak_…` |
| `AUTHDEEP_HMAC_SECRET` | secret |
| `AUTHDEEP_DIGEST_TO` | var, recipient email |
| `RUN_SECRET` | secret, unchanged |

`apps/worker/wrangler.jsonc` on this branch ships placeholder values for `AUTHDEEP_BASE_URL` and `AUTHDEEP_DIGEST_TO`. Replace both before deploying the worker. Do not put `sak_`, `gwk_`, `ssk_`, or HMAC secrets in that file.

Remove `API_KEY` from the API Worker with `wrangler secret delete` after the gateway secrets work. Remove `API_KEY` and `API_BASE_URL` from the worker the same way.

### AuthDeep admin setup

The repository does not contain these credentials. Put them in Wrangler yourself. They are shown once.

1. Register a gateway service: slug `stock-api`, name `Stock API`, `backendUrl` = the deployed API origin (`https://stock-api.<account>.workers.dev`), `healthPath` `/health`. Copy `gwk_…` into `AUTHDEEP_GATEWAY_KEY` and `ssk_…` into `AUTHDEEP_SERVICE_SECRET` on `stock-api`.
2. Create one service API key (`sak_…`) with both permissions: `{ "serviceId": "<stock-api id>", "httpMethod": "*" }` and `{ "capability": "notifications_email", "httpMethod": "POST" }`. The key and its HMAC secret become `AUTHDEEP_SERVICE_KEY` and `AUTHDEEP_HMAC_SECRET` on `stock-worker`.
3. Confirm the tenant can send notification email (SMTP or AuthDeep Mail). Without that, AuthDeep can return 202 and still not deliver.
4. Set `AUTHDEEP_BASE_URL` to `https://<tenant-slug>.authdeep.com`.

Updating `backendUrl` on the existing `stock-api` service keeps the same `gwk_` and `ssk_`. Registering a second service issues a new pair, and the API secrets must change with it.

### Cutover checks

Deploy nothing from the branch until the gateway signature tests pass. Register the service against the URL already deployed from `main`. `/health` works before the auth swap.

1. Put the two API secrets on `stock-api`. Deploy the branch's API.
2. Direct checks against the Worker URL, using a signature computed with the real `ssk_` over `GET\n/products\n<now>\n<hash of empty string>` and header `X-Gateway-Key`:
   - `/health` → 200
   - `/products` with no headers → 401
   - `/products` with the old `X-Api-Key` → 401
   - `/products` with the wrong signature → 401
   - `/products` with a correct signature → 200 and the product list
3. Put the worker secrets and vars on `stock-worker`. Deploy the worker immediately after the API, because the old cron key no longer works.
4. `POST /run?dry=1` with `X-Run-Key` prints the email and does not send.
5. `POST /run` logs `digest sent`. AuthDeep returns 202, and the message arrives at `AUTHDEEP_DIGEST_TO`.
6. Delete the retired `API_KEY` secrets.

A 403 from AuthDeep on the product GET means the `sak_` is missing the `stock-api` permission. A 403 on the email POST means the `notifications_email` permission is missing. A 401 from the API during the proxied call means the `gwk_` / `ssk_` pair on the Worker does not match the registered service, or the signed path is not the path the API actually received.
