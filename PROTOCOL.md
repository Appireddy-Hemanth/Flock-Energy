# Urja Ops Legacy Portal — Protocol Documentation

This document describes **only information actually observed** during reverse-engineering of the Urja Ops portal (`https://urja-ops.flockenergy.tech`). No APIs, cookies, headers, or request URLs have been fabricated.

---

## Portal Overview

The Urja Ops portal is a **SvelteKit-based** web application for managing electrical meter infrastructure. It provides a dashboard view with key statistics and a searchable meter catalog.

### Dashboard (Observed)

Upon successful login, the portal redirects to `/meters` which displays:

- **Total Meters** — Count of all registered meters (observed: 403)
- **Transformers** — Count of distribution transformers (observed: 40)
- **Page Size** — Items per page in the meter table (observed: 20)
- **API Status** — Indicator showing portal availability

### Navigation Flow

1. User visits `https://urja-ops.flockenergy.tech` → Redirected to `/login`
2. After authentication → Redirected to `/meters` (main dashboard)
3. Meter table shows paginated list with search functionality
4. Clicking a meter row opens `/meters/:id` — a detail view/modal
5. Detail view shows meter metadata, coordinates, and energy consumption graph

---

## Authentication

### Login Process

- **Endpoint:** `POST /login`
- **Content-Type:** `application/x-www-form-urlencoded`
- **Required Headers:**
  - `Accept: application/json`
  - `x-sveltekit-action: true` — Required by SvelteKit to treat this as a form action
  - `Origin: https://urja-ops.flockenergy.tech`
  - `Referer: https://urja-ops.flockenergy.tech/login`
- **Payload:** `email=operator%40urja.local&password=urja-ops-2026`
- **Response (200):**
  ```json
  { "type": "redirect", "status": 303, "location": "/meters" }
  ```
- **Session Cookie:** `__Secure-better-auth.session_token` set via `Set-Cookie` header
  - Properties: `Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax`

### Session Management

- The session token expires after 1 hour (`Max-Age=3600`).
- Expired or invalid sessions result in a redirect to `/login` (302) or a 401/403 response.
- The authentication library appears to be **better-auth** (based on cookie naming convention).

> **Note:** No other authentication mechanisms (e.g., API keys, OAuth, bearer tokens) were observed during investigation.

---

## Discovered API Endpoints

All endpoints require the session cookie `Cookie: __Secure-better-auth.session_token=<token>`.

### 1. Search / List Meters

- **Endpoint:** `GET /portal/meters/search?q=<query>&page=<page>`
- **Parameters:**
  - `q` (string, optional) — Search query. Empty returns all meters.
  - `page` (integer, optional) — Page number (default: 1)
- **Response (200):**
  ```json
  {
    "data": [
      {
        "meterId": "J100008",
        "serialNo": "SE63900",
        "make": "Genus",
        "phaseType": "single",
        "installStatus": "Installed",
        "dtCode": "DT-009"
      }
    ],
    "total": 403,
    "page": 1,
    "pageSize": 20
  }
  ```

### 2. Meter Details (SvelteKit Data)

- **Endpoint:** `GET /meters/<id>/__data.json?x-sveltekit-invalidated=001`
- **Description:** Returns SvelteKit-serialized state using the `devalue` format
- **Contains:**
  - Basic parameters: `Make`, `Serial No`, `Phase Type`, `Installation Status`, `Installation Type`
  - Network hierarchy: `Zone`, `Circle`, `Division`, `Subdivision`, `Sub Station`, `Feeder`, `DT`

### 3. Meter Geo Coordinates

- **Endpoint:** `GET /portal/meters/<id>/geo`
- **Response (200):**
  ```json
  {
    "data": {
      "latitude": "26.899010438325444",
      "longitude": "75.8400677302598"
    }
  }
  ```

### 4. Meter Energy Consumption

- **Endpoint:** `GET /portal/meters/<id>/energy`
- **Response (200):**
  ```json
  {
    "data": [
      {
        "timestamp": "23/06/2026 23:30",
        "kwh": "27623.95",
        "kvah": "29833.87",
        "voltR": "227"
      }
    ]
  }
  ```
- **Note:** Timestamps use `DD/MM/YYYY HH:mm` format. Values are returned as strings.

### 5. Distribution Transformers (DTs)

- **Endpoint:** `GET /portal/dts?page=<page>`
- **Response (200):**
  ```json
  {
    "data": [
      {
        "code": "DT-001",
        "name": "Malviya Nagar DT 1",
        "feederCode": "F-001",
        "capacityKva": 100
      }
    ],
    "total": 40,
    "page": 1,
    "pageSize": 20
  }
  ```

---

## Data Observations

| Metric | Observed Value |
|--------|---------------|
| Total meters | 403 |
| Total transformers (DTs) | 40 |
| Page size | 20 |
| Meter ID format | `J1XXXXX` (e.g., J100000–J100402) |
| Coordinates | Jaipur region (latitude ~26.9°, longitude ~75.8°) |
| Meter makes | Genus, L&T, HPL, Secure, Elster (observed) |
| Phase types | single, three (observed) |

---

## Portal Quirks

1. **SvelteKit devalue serialization** — The `/meters/:id/__data.json` endpoint does not return standard JSON. It uses SvelteKit's `devalue` protocol — a flat array with index pointers instead of nested objects. A custom parser is required.
2. **x-sveltekit-action header** — The login endpoint returns 403 without the `x-sveltekit-action: true` header. This was the primary blocker during reverse engineering.
3. **Self-signed SSL** — The portal may use self-signed certificates. HTTPS agent must be configured with `rejectUnauthorized: false`.
4. **Timestamps as strings** — Consumption data returns numeric values as strings and timestamps in `DD/MM/YYYY HH:mm` format rather than ISO 8601.
5. **Coordinate strings** — Geo coordinates are returned as strings, not numbers.

---

## Items Not Confirmed

- Whether the portal supports write operations (POST/PUT/DELETE for meter data)
- Whether additional user roles exist beyond the operator account
- Whether there are WebSocket or real-time data streams
- Whether the portal has rate limiting or request throttling

> Authentication mechanism confirmed as cookie-based via `better-auth` session tokens (SvelteKit form actions). No other authentication methods were discovered during investigation.
