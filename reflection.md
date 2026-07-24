# Technical Reflection: Reverse Engineering the Urja Ops Portal

---

## 1. What assumptions did I make?

1. **Data model stability** — Assumed that the SvelteKit devalue serialization index layout remains stable across portal builds. If the portal's SvelteKit version is updated, the devalue parser in `PortalClient.ts` may need adjustment.
2. **Read-only access** — Assumed read-only operations are sufficient and that no write authorization is needed. Used the default role assigned to the operator account.
3. **Single operator account** — Assumed `operator@urja.local` is the only supported login. Multi-tenant authentication is out of scope.
4. **Environment security** — Assumed developers run integration tests in environments without local proxy filtering (Sophos/captive portals would intercept direct internet queries).

---

## 2. Which part was the most difficult, and how did I get unstuck?

**Most difficult:** Decoding the SvelteKit `devalue` format. The `/meters/:id/__data.json` endpoint does not return normal JSON — it returns a flat array with index pointers that resolve properties recursively.

**Getting unstuck:** Dumped actual `__data.json` responses to local files, manually mapped the index paths, and wrote a recursive resolver in `PortalClient.ts` that traverses the array, checks for circular references, and reconstructs standard key-value objects. Tested against multiple distinct meter configurations to ensure resilience against index shifting.

**Secondary blocker:** Discovering the `x-sveltekit-action: true` header requirement. Without it, login requests returned `403 Forbidden`. Identified this by inspecting browser DevTools network traffic against the portal's own login form submission.

---

## 3. If I had another day, what would I improve?

1. **Caching layer** — In-memory or Redis cache with 5–10 minute TTL for meter listings and the `/network` tree to reduce load on the legacy portal.
2. **Circuit breaker** — Retry logic with exponential backoff and circuit breaker pattern for graceful portal outage handling.
3. **Geospatial filtering** — Index meter GPS coordinates in SQLite/PostGIS and expose `GET /api/meters/nearby?lat=X&lng=Y&radius=Z`.
4. **Docker containerization** — `Dockerfile` + `docker-compose.yml` for one-command deployment.
5. **E2E browser tests** — Playwright-based tests validating the full request lifecycle through the Swagger UI.

---

## 4. What mistake did I make while solving this?

**The mistake:** Initially ran sequential pagination fetches when building the `/network` tree. With ~23 pages of data (21 meter pages + 2 transformer pages), this resulted in 10+ second latency and caused integration tests to timeout.

**Resolution:** Rewrote the fetching logic to use `Promise.all` for concurrent page requests after extracting the total count from the first page. This reduced `/network` response time from 10+ seconds to under 1.2 seconds.

**Secondary mistake:** Windows-specific glob path matching bug where backslashes in Swagger JSDoc file paths prevented route annotations from loading. Fixed with `.replace(/\\\\/g, '/')` normalization in the swagger config.

---

## 5. If I were reviewing my own submission, what would I criticise?

1. **No caching layer** — Every API call hits the portal live. Under load, this would be slow and could trigger rate limits on the upstream.
2. **No API authentication** — The wrapper itself is unprotected. Any client can access the data without credentials.
3. **Concurrent portal requests** — The `/network` endpoint fires ~21 requests simultaneously. While fast, this pattern could trigger automated security blocks on the portal.
4. **PortalClient as module-level singleton** — The `PortalClient` instance is created at import time in the controller layer. A proper IoC container would be better for larger codebases.
5. **No request retry strategy** — If a single portal request fails mid-pagination (in `/network`), the `.catch(() => ({ data: [] }))` silently drops that page. A retry mechanism would be more robust.
