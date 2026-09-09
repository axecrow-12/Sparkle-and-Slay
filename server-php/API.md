# API Reference

Base URL: `/api` (the router strips this prefix, so `/api/health` maps to the `/health` route below).

All request and response bodies are JSON unless noted otherwise. Endpoints marked **Admin** require an `Authorization: Bearer <token>` header with a valid JWT, obtained from `/auth/login` or `/auth/setup`. Endpoints marked **Rate limited** enforce a per-IP request cap, exceeding it returns `429` with `{"error": "Too many attempts. Please wait a few minutes and try again."}`.

## Health

### `GET /health`
No auth. Returns `{"status": "ok"}`. Use this to confirm the server is actually running before debugging anything else.

## Authentication

### `GET /auth/status`
No auth. Tells the frontend whether to show the login form or the first-time setup form.

**Response:** `{"hasPassword": boolean}`

### `POST /auth/setup`
No auth, but only works once, before any admin password exists.

**Body:** `{"password": string}` (minimum 8 characters)

**Response `201`:** `{"token": string}`
**Errors:** `400` password too short · `409` an admin password already exists, use login instead

### `POST /auth/login`
**Rate limited**: 5 attempts per 15 minutes per IP, failed attempts count against the limit, a successful login clears it.

**Body:** `{"password": string}`

**Response `200`:** `{"token": string}`
**Errors:** `400` password missing · `401` wrong password · `404` no admin password has been set yet

### `PUT /auth/password`
**Admin.**

**Body:** `{"currentPassword": string, "newPassword": string}` (new password minimum 8 characters)

**Response `200`:** `{"token": string}` — a fresh token, since changing the password is treated as a new session
**Errors:** `400` new password too short · `401` current password is wrong

## Products (Collections)

The frontend and this API use "collections" and "products" interchangeably, `/collections` and `/products` are exact aliases of each other, same handlers, same behavior.

> **Archiving is soft.** `DELETE` on a product, order, or payment sets a
> `deleted_at` timestamp instead of removing the row. Archived records drop out
> of every list, lookup, report, and the checkout flow, but can be brought back
> with the matching `POST .../{id}/restore`. Admin list endpoints accept
> `?includeArchived=1` to include archived rows (each carries a `deleted_at`
> field) so the panel can show and restore them.

### `GET /collections`
No auth. Two response shapes depending on query parameters:

- **No parameters at all:** returns a plain array of every product, unpaginated. This is the original behavior, kept for backward compatibility with the storefront.
- **With `?page=N`:** returns `{"data": [...], "total": N, "page": N, "perPage": N}`. `perPage` defaults to 24, capped at 100.
- **With `?search=term`:** filters by product name or description (case-insensitive substring match) in either response mode, combine with `?page=` for paginated search results.

Cached publicly for 60 seconds via `Cache-Control`, except when `?search=` is present, search results are never cached.

Each product object: `{id, name, description, image, video, price, stock_status, colors, sizes, rating_average, rating_count}`. `colors` and `sizes` are comma-separated strings, not arrays.

### `GET /collections/{id}`
No auth. Returns the full row for one product, including fields not exposed in the list view (e.g. `created_at`).

**Errors:** `404` no product with that ID

### `POST /collections`
**Admin.**

**Body:** `{name, description, image?, video?, price?, stock_status?, colors?, sizes?, rating_average?, rating_count?}` — `name` and `description` are required, everything else optional. `stock_status` defaults to `"in_stock"` if omitted.

**Response `201`:** the newly created product, same shape as `GET /collections/{id}`
**Errors:** `400` missing name or description

### `PUT /collections/{id}`
**Admin.** Partial update, any field not included in the body keeps its existing value.

**Response:** the updated product
**Errors:** `404` no product with that ID

### `DELETE /collections/{id}`
**Admin.** Soft delete (sets `deleted_at`).

**Response:** `204` No Content, empty body
**Errors:** `404` no product with that ID (or already archived)

### `POST /collections/{id}/restore`
**Admin.** Clears `deleted_at`.

**Response:** the restored product
**Errors:** `404` no archived product with that ID

## Newsletter

### `POST /subscribe`
No auth. **Rate limited**: 5 signups per hour per IP, every attempt counts, not just failures.

**Body:** `{"email": string}`

**Response `201`:** `{"message": "Subscribed."}` — resubscribing with an already-registered email also returns `201`, it does not error, the database silently no-ops on the duplicate
**Errors:** `400` invalid email format

### `GET /subscribe`
**Admin.** Paginated, `?page=` / `?perPage=` (default 50, capped at 100).

**Response:** `{"data": [{email, created_at}, ...], "total": N, "page": N, "perPage": N}`

## Orders (manual EcoCash reference flow)

This is the manual checkout path, where the customer pays via EcoCash themselves and submits their own transaction reference for the admin to verify. See the Checkout section below for the automated flow instead.

### `POST /orders`
No auth. **Rate limited**: 10 per hour per IP, every attempt counts.

**Body:** `{itemName, name, phone, reference, amount, address?, collectionId?, items?}` — if `items` is omitted, a single-item order is built automatically from `itemName` and `collectionId`. `amount` is a string, digits and a decimal point are extracted from it server side.

**Response `201`:** `{"orderId": number, "createdAt": string}`
**Errors:** `400` missing required fields, or amount is not a positive number · `409` this EcoCash reference has already been recorded (prevents duplicate submissions of the same payment)

### `GET /orders`
**Admin.** Paginated, `?page=` / `?perPage=` (default 20, capped at 100). Accepts
`?includeArchived=1`.

**Response:** `{"data": [...full order rows...], "total": N, "page": N, "perPage": N}`

### `DELETE /orders/{id}`
**Admin.** Soft delete. Archives the order **and** its payment(s) in one
transaction so the ledger and the sales figures stay consistent.

**Response:** `204` No Content
**Errors:** `404` no order with that ID (or already archived)

### `POST /orders/{id}/restore`
**Admin.** Un-archives the order and its payment(s).

**Response:** the restored order row
**Errors:** `404` no archived order with that ID

### `GET /orders/summary`
**Admin.** Dashboard figures: total orders, pending order count, total units sold, and the top 6 best-selling items by quantity.

**Response:** `{"orders": N, "pendingOrders": N, "units": N, "topItems": [{name, quantity}, ...]}`

### `PUT /orders/{id}/status`
**Admin.**

**Body:** `{"status": string}` — any string is accepted, there is no server-side enum check on this field, unlike payment status below.

**Response:** the updated order row
**Errors:** `400` status missing · `404` no order with that ID

## Checkout (automated EcoCash flow)

The customer never leaves the site, this triggers a real EcoCash charge request and confirms completion automatically. See the server-php README's Architecture section for how confirmation actually works, it does not trust the webhook body on its own.

### `POST /checkout`
No auth.

**Body:** `{name, address, phone, idempotencyKey, items: [{collectionId, quantity}, ...]}` — `phone` must be a valid Zimbabwean EcoCash number (normalized to `2637XXXXXXXX` format server side). `idempotencyKey` must be 16 to 120 characters, letters, numbers, periods, colons, or hyphens only, generate a fresh one per checkout attempt to prevent accidental double charges on retry. Cart is revalidated entirely server side, prices, stock status, and totals in the request body are ignored, the client cannot influence what actually gets charged.

**Response `201`:** `{orderId, paymentId, amount, currency, status, checkoutToken}` — `checkoutToken` is what the frontend polls with next
**Errors:** `400` invalid input · `409` idempotency key already used, or one or more cart items are out of stock or no longer exist

### `GET /checkout/{token}`
No auth. `{token}` must be a 64-character hex string (the raw `checkoutToken` from the response above, not a database ID). Poll this to find out whether the EcoCash payment completed.

**Response:** `{amount, currency, status, providerStatus}` — `status` is one of `pending`, `verified`, `rejected`. The frontend polls this every 2 seconds for up to 30 attempts (60 seconds) before giving up and showing a "still pending" message.
**Errors:** `404` no payment matches this token

### `POST /ecocash/notify`
No auth (this is called by EcoCash's servers, not the frontend). Documented here for completeness, not something the frontend or an admin should ever call directly.

**Body:** whatever EcoCash's gateway sends, only `clientCorrelator` is actually read from it, everything else in the body is ignored on purpose, see the Architecture note in the README for why.

## Payments (admin)

### `GET /payments`
**Admin.** Paginated, `?page=` / `?perPage=` (default 20, capped at 100). Each row is joined with its parent order for `customer_name`, `phone`, and `item_name`. Accepts `?includeArchived=1`.

**Response:** `{"data": [...], "total": N, "page": N, "perPage": N}`

### `DELETE /payments/{id}`
**Admin.** Soft delete (archives this payment only).

**Response:** `204` No Content
**Errors:** `404` no payment with that ID (or already archived)

### `POST /payments/{id}/restore`
**Admin.** Clears `deleted_at`.

**Response:** the restored payment row
**Errors:** `404` no archived payment with that ID

### `PUT /payments/{id}/status`
**Admin.**

**Body:** `{"status": "pending"|"verified"|"rejected", "providerStatus"?: string}` — manually approving a payment that's still in the `INITIATED` provider state automatically sets `providerStatus` to `COMPLETED` for consistency, even if you don't pass it explicitly.

**Response:** the updated payment row
**Errors:** `400` status is not one of the three allowed values · `404` no payment with that ID

### `GET /payments/report`
**Admin.** `?period=weekly` (default) or `?period=monthly`. Weekly buckets use ISO week numbers, monthly uses `YYYY-MM`. Capped at the most recent 24 periods.

**Response:** `{"period": "weekly"|"monthly", "currency": "USD", "rows": [{period, payments, totalAmount, verifiedAmount}, ...]}`

### `GET /reports/sales`
**Admin.** The custom sales report powering the admin Payments view. All money is
aggregated from `payments.amount` (never `orders.amount`, which is a string).
Archived payments and orders are excluded.

**Query parameters** (all optional):
- `from`, `to` — `YYYY-MM-DD`, inclusive. Anything not matching that format is ignored.
- `status` — `all` (default) · `verified` · `pending` · `rejected`.
- `method` — `all` (default) or an exact `payments.method` value (e.g. `ecocash`).
- `groupBy` — `period` (default) · `product` · `customer`.
- `interval` — `day` · `week` (default) · `month`. Only used when `groupBy=period`.

**Response:**
```
{
  "groupBy": "period",
  "currency": "USD",
  "filters": { "from": null, "to": null, "status": "all", "method": "all", "interval": "week" },
  "summary": { "records": N, "totalAmount": N, "verifiedAmount": N, "customers": N },
  "columns": [ { "key": "period", "label": "Period", "type": "text" }, ... ],
  "rows": [ { ... keyed by column key ... } ]
}
```
`columns[].type` is one of `text` · `number` · `money` and lets a client render
and export any grouping generically. For `groupBy=product`, `revenueEstimate` is
`quantity x current collection price` — line items store no historical price, so
it is an estimate, flagged as such in the column label.

## Settings

### `GET /settings`
**Admin.** Every configurable store setting, with defaults filled in for anything not yet saved to the database.

**Response:** `{store_name, email, phone, whatsapp, ecocash_merchant_number, address, facebook, instagram, tiktok}`

### `PUT /settings`
**Admin.** Partial update, only keys present in the body get written, unrecognized keys are silently ignored (there's a fixed allowed list, this is not a generic key-value store).

**Response:** the full updated settings object
**Errors:** `400` `store_name` was included in the body but sent empty

### `GET /settings/public`
No auth. The subset of settings safe to expose to the storefront (excludes nothing currently, but this is the endpoint that would gain fields excluded from `GET /settings` in the future, keep new sensitive settings out of this function specifically, not just out of the frontend). Cached publicly for 60 seconds.

**Response:** same shape as `GET /settings`

## Uploads

### `POST /uploads`
**Admin.** `multipart/form-data`, not JSON, field name must be `file`.

Accepts JPG, PNG, WEBP, MP4, or WEBM, verified by actual file content (`finfo`), not just the filename extension. Maximum 20MB. Stored on local disk under `public/uploads/`, **not** cloud storage, see the README's shared hosting notes.

**Response `201`:** `{"path": "/uploads/<random-filename>.<ext>"}` — this relative path is what gets stored in the database, the frontend resolves it to a full URL against the API's own origin
**Errors:** `400` no file, file too large, or file type not allowed · `500` upload directory could not be created or the file could not be saved