# Urja Ops Portal — REST API Wrapper

A clean, production-grade REST API service built over the **Urja Meter Ops** legacy portal. This project reverse-engineers the portal's SvelteKit-based architecture, handles programmatic authentication and session management, and exposes the portal's meter data through well-structured REST endpoints — without requiring users to access the legacy portal directly.

## Problem Statement

Field and operations teams need programmatic access to meter metadata, network placement, and historical consumption. The legacy Urja Meter Ops portal is human-facing and has no public API. This project builds a small, focused wrapper service that exposes the portal data through a consistent, documented REST interface so other systems can integrate reliably.

---

## Architecture

```
┌──────────────┐       ┌──────────────────────────────┐       ┌──────────────────────┐
│  API Client  │──────▶│   Express REST API            │──────▶│  Urja Ops Portal     │
│  (curl, UI)  │ JSON  │   ├─ Helmet + Rate Limiter    │ HTTP  │  (SvelteKit + Auth)  │
│              │◀──────│   ├─ Zod Validation            │◀──────│                      │
│              │       │   ├─ Service Layer             │ 🍪    │                      │
└──────────────┘       │   └─ PortalClient (Axios)     │       └──────────────────────┘
                       └──────────────────────────────┘
```

### Layer Responsibilities

| Layer | Path | Responsibility |
|---|---|---|
| **PortalClient** | `src/client/PortalClient.ts` | Authenticates with portal, manages session cookies, parses SvelteKit `devalue` responses |
| **Services** | `src/services/` | Business logic — data merging, formatting, concurrent page fetching |
| **Controllers** | `src/controllers/` | Thin request/response orchestration layer |
| **Validators** | `src/validators/` | Zod schemas for request parameter validation |
| **Routes** | `src/routes/api.ts` | Express router with full OpenAPI/Swagger annotations |
| **Middleware** | `src/middleware/` | Global error handler, Zod validation middleware |
| **Utils** | `src/utils/` | Logger, response envelope helper |

---

## Folder Structure

```
├── src/
│   ├── app.ts                          # Express app (Helmet, CORS, rate limiting, Swagger)
│   ├── server.ts                       # Server entry point
│   ├── client/PortalClient.ts          # Portal HTTP client with auth + devalue parser
│   ├── services/
│   │   ├── MeterService.ts             # Meter business logic
│   │   └── NetworkService.ts           # Network tree builder
│   ├── controllers/
│   │   ├── meters.ts                   # Meter endpoints handler
│   │   └── network.ts                  # Network endpoint handler
│   ├── routes/api.ts                   # Route definitions + Swagger JSDoc
│   ├── middleware/
│   │   ├── errorHandler.ts             # Global error handler + 404 catch-all
│   │   └── validate.ts                 # Zod validation middleware
│   ├── validators/meterSchemas.ts      # Zod schemas
│   ├── types/index.ts                  # Shared TypeScript interfaces + ApiError
│   └── utils/
│       ├── logger.ts                   # Structured logger
│       └── response.ts                 # Response envelope helpers
├── tests/
│   ├── unit/meters.test.ts             # 9 unit tests (mocked PortalClient)
│   └── integration/PortalClient.test.ts # 5 integration tests (live portal)
├── public/index.html                   # Web dashboard UI
├── PROTOCOL.md                         # Reverse-engineering findings
├── openapi.json                        # OpenAPI 3.0 specification
├── reflection.md                       # Reflection on the assignment
└── README.md                           # This file
```

---

## Technology Stack

| Category | Technology |
|---|---|
| Runtime | Node.js (v18+) |
| Language | TypeScript |
| Framework | Express.js |
| Validation | Zod |
| HTTP Client | Axios |
| Security | Helmet, express-rate-limit, CORS |
| Documentation | Swagger UI / OpenAPI 3.0 |
| Testing | Jest + Supertest |
| Dev Server | ts-node-dev |

---

## Installation & Setup

### Prerequisites
- Node.js v18+ and npm

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create a `.env` file in the project root:
```env
PORT=3000
PORTAL_EMAIL=operator@urja.local
PORTAL_PASSWORD=urja-ops-2026
PORTAL_BASE_URL=https://urja-ops.flockenergy.tech
NODE_ENV=development
```

### Environment variables (full list)

The service reads these environment variables (use the `.env` above in local development):

- `PORT` — HTTP port the wrapper listens on (default: `3000`)
- `PORTAL_EMAIL` — portal account email used for login
- `PORTAL_PASSWORD` — portal account password used for login
- `PORTAL_BASE_URL` — base URL of the legacy portal (e.g. `https://urja-ops.flockenergy.tech`)
- `NODE_ENV` — `development` or `production`
- `CORS_ORIGIN` — optional origin for `CORS` (defaults to `*`)
- `LOG_LEVEL` — optional logger level (`debug|info|warn|error`)

### 3. Start the server
```bash
# Development (hot-reload)
npm run dev

# Production
npm run build && npm start
```

### 4. Access the application
| URL | Description |
|---|---|
| `http://localhost:3000` | Web Dashboard |
| `http://localhost:3000/docs` | Swagger API Documentation |
| `http://localhost:3000/openapi.json` | OpenAPI 3.0 Spec (JSON) |

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health check with portal connectivity status |
| `GET` | `/api/meters?page=1` | Paginated list of all meters |
| `GET` | `/api/search?q=Genus&page=1` | Search meters by ID, serial, make, etc. |
| `GET` | `/api/meters/:id` | Full meter details (metadata + coordinates + hierarchy) |
| `GET` | `/api/meters/:id/consumption` | Historical energy readings (kWh, kVAh, voltage) |
| `GET` | `/api/network` | Hierarchical tree of transformers → meters |

### Response Envelope

All successful responses follow a consistent shape:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "page": 1, "pageSize": 20, "total": 403 }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [ ... ]
}
```

### Example: Get Meter Details

**Request:**
```bash
curl http://localhost:3000/api/meters/J100008
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": "J100008",
    "serialNo": "SE63900",
    "make": "Genus",
    "phaseType": "single",
    "installStatus": "Installed",
    "installType": "Whole Current",
    "coordinates": {
      "latitude": 26.899010,
      "longitude": 75.840067
    },
    "hierarchy": {
      "zone": "Jaipur Zone",
      "circle": "Jaipur City Circle",
      "division": "...",
      "subdivision": "...",
      "substation": "...",
      "feeder": "...",
      "dt": "Sikar Road DT 9"
    }
  }
}
```

### Example: Get Consumption

**Request:**
```bash
curl http://localhost:3000/api/meters/J100008/consumption
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-06-23T23:30:00.000Z",
      "kwh": 27623.95,
      "kvah": 29833.87,
      "voltage": 227
    }
  ]
}
```

---

## Sample Requests

Search meters (portal-backed server-side search):

```bash
curl "http://localhost:3000/api/search?q=Genus&page=1"
```

Export meters as JSON:

```bash
curl "http://localhost:3000/api/export?format=json" -o meters.json
```

Export meters as CSV (attachment):

```bash
curl -OJ "http://localhost:3000/api/export?format=csv"
```

Get network transformer tree:

```bash
curl "http://localhost:3000/api/network"
```

Using Swagger UI

Start the server and open `http://localhost:3000/docs`. The documentation is generated from JSDoc annotations in `src/routes/api.ts`. Use the "Try it out" buttons to exercise endpoints; the wrapper will perform portal login automatically when necessary.

---

## Design Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **TypeScript** | Type safety catches bugs at compile time, especially when parsing unpredictable portal responses |
| **Custom devalue parser** | Portal uses SvelteKit's `devalue` serialization. Wrote a focused decoder instead of pulling the full Svelte runtime |
| **Service layer** | `MeterService` / `NetworkService` decouple business logic from Express handlers, improving testability and separation of concerns |
| **Automatic session renewal** | `PortalClient` detects 401/403 and transparently re-authenticates — API consumers never see auth failures |
| **Concurrent page fetching** | `/network` needs ~23 pages. Sequential fetching took 10+ seconds; `Promise.all` brings it under 1.2 seconds |
| **Zod validation** | Lightweight, TypeScript-native, provides clear error messages |
| **Helmet + Rate Limiting** | Security best practices — HTTP hardening headers and 100 req/min limit on API routes |
| **Response envelope** | Consistent `{ success, data, meta }` shape across all endpoints for predictable client consumption |

---

## Assumptions

1. **Read-only access** — The assignment specifies the portal is read-only, so only GET endpoints are exposed
2. **Data model stability** — SvelteKit devalue serialization index layout is assumed stable across portal builds
3. **Single operator account** — Only `operator@urja.local` credentials are supported
4. **Network availability** — Integration tests require internet access to the portal

---

## Limitations

- **No caching** — Every request hits the portal fresh. A TTL cache would reduce load
- **No persistent storage** — No database for offline capabilities or query optimization
- **No API authentication** — The wrapper itself has no auth layer (should use API keys in production)
- **Concurrent portal requests** — `/network` fires ~21 requests simultaneously, which could trigger rate limits on the portal

---

## Future Improvements

1. **Response caching** with configurable TTL (Redis or in-memory) for expensive endpoints like `/network`
2. **Circuit breaker** pattern with exponential backoff for portal outage resilience
3. **Geospatial queries** — Index meter coordinates and expose `GET /api/meters/nearby?lat=X&lng=Y&radius=Z`
4. **API authentication** — API key or JWT-based auth for the wrapper itself
5. **Docker containerization** for one-command deployment
6. **Comprehensive E2E tests** with Playwright for full request lifecycle validation

---

## Testing

```bash
# Run all tests
npm test

# Unit tests only (mocked, no network required)
npm run test:unit

# Integration tests (requires portal access)
npm run test:integration
```

- **9 unit tests** — Mock `PortalClient` prototype methods, test controllers + service layer in complete isolation
- **5 integration tests** — Call live portal to verify authentication, cookie handling, and data parsing

---

## Key Documents

| Document | Description |
|----------|-------------|
| [PROTOCOL.md](./PROTOCOL.md) | Reverse-engineering findings — authentication, endpoints, data formats, quirks |
| [openapi.json](./openapi.json) | OpenAPI 3.0 specification (also served live at `/openapi.json`) |
| [reflection.md](./reflection.md) | Detailed reflection on assumptions, challenges, and self-critique |
| [PROTOCOL.md](./PROTOCOL.md) | Reverse-engineering findings — authentication, endpoints, data formats, quirks |

---

## Reflection (short)

- **Assumptions:** Read-only portal, single operator account; portal devalue format stable for payload parsing.
- **Hardest part:** Reverse-engineering the SvelteKit `devalue` payload shape and login form-action headers — required careful inspection of portal network traffic.
- **If I had more time:** Add a TTL cache for `/network`, robust circuit-breaker behaviour for the portal client, and Playwright E2E tests for the dashboard flows.
- **Mistake made:** Initial frontend duplicated functions and left some modal state issues; fixed in follow-ups.
- **Self-review:** The project is functionally complete and adequately tested for unit-level behaviour; documentation and OpenAPI polishing were the main time sinks.
