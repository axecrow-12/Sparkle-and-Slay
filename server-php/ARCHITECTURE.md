# Architecture Overview

This document explains how a request actually moves through the system, and why a handful of specific decisions were made the way they were, the things that aren't obvious just from reading the code top to bottom.

## System shape

Three independent pieces, talking over plain HTTP:

- **Frontend** — static HTML, CSS, and JavaScript, served by any static file server (`python -m http.server` locally, any static host in production). It knows nothing about PHP, it only ever talks to the API over `fetch()`.
- **API** — this PHP application, `server-php/`. Stateless between requests, no sessions, no server-side rendering, every response is JSON.
- **MySQL** — the only persistent state the API owns directly.

A fourth party sits outside this system entirely but is load-bearing for checkout: **EcoCash's own servers**, which the API calls out to for charges and status queries, and which call back into the API's `/ecocash/notify` endpoint. That relationship gets its own section below, since it's the least obvious part of the whole system and the part most likely to confuse someone reading the code cold.

## Request lifecycle

Every request to the API, regardless of route, passes through `public/index.php` in this order:

1. **`vendor/autoload.php`** loads every file listed under `composer.json`'s `"files"` key, all the route functions, `getDb()`, `jwtSign()`, everything, become available as plain global functions. There is no framework-style service container, a function is either loaded or it isn't, and if a new file is added to the codebase without also being added to that list, calling its functions will fail with a clear "function not found" error rather than something more confusing.
2. **`loadEnv()`** reads `.env` into both `$_ENV` and, explicitly, into `putenv()`, so every `getenv()` call throughout the codebase sees it. This second step is not automatic in the underlying library and was a real bug encountered during development, see the README's setup notes if this ever regresses.
3. **`APP_ENV`** is checked once, here, and decides whether PHP errors are shown or hidden, and later, whether CORS falls back to a convenience localhost origin or refuses to guess at all.
4. **CORS headers** are set based on `FRONTEND_ORIGIN`. This is a deliberate fail-closed design, covered in its own section below.
5. **The exception handler and shutdown handler** are registered. Anything thrown anywhere downstream, and any fatal PHP error that isn't even catchable as an exception, both end up producing the same clean `{"error": "..."}` JSON response rather than a blank page or a leaked stack trace.
6. **The router** (FastRoute) matches the request's method and path against the route table and calls the matching function, passing any path parameters (like a numeric ID) as arguments.
7. **The route function itself** typically does three things in order: check authorization if needed (`requireAdmin()`), validate and read input, then talk to the database via `getDb()`, which returns a single shared PDO connection (a static variable, one per request lifecycle, not a real connection pool, this app doesn't run long enough as one process for that distinction to matter).

## Authentication and authorization

There is exactly one identity in this system: **the admin account**. It isn't modeled as a `users` table, there's an `admin_users` table with a single row holding a password hash. Logging in issues a JWT (`src/jwt.php`, hand-written HS256, HMAC signature checked with `hash_equals` for constant-time comparison) that any route can require via `requireAdmin()` in `src/helpers.php`.

Two things worth understanding about this design rather than assuming they're accidents:

- **There is no role hierarchy.** Every authenticated request can do everything an admin can do. This is fine for a single-operator store and would need real work (a proper `users` table, permission checks per route) before it would make sense for more than one person to have separate access levels.
- **Tokens cannot be revoked early.** Once issued, a JWT is valid until it expires (`JWT_TTL_SECONDS`), full stop. There's no server-side session table to invalidate a specific token against. The only way to invalidate everything at once is rotating `JWT_SECRET`, which logs out every session simultaneously, not just one.

## The EcoCash payment confirmation design

This is the part of the system most worth understanding deeply before touching it, because the obvious-seeming implementation (trust whatever the webhook says) is actually a security hole, and the reason isn't obvious unless you've read EcoCash's own API documentation closely.

**The problem:** EcoCash's `/ecocash/notify` webhook is not signed or authenticated in any way. It's a plain POST to a URL you configure. Nothing about the request proves it actually came from EcoCash rather than from anyone who happened to discover or guess that URL.

**What that means concretely:** if the notify handler simply read `status: "COMPLETED"` out of the request body and marked the payment verified, anyone who found the notify endpoint could fabricate that exact POST themselves and get a payment marked as paid without EcoCash ever being involved.

**The actual design**, in `ecocashNotify()` (`src/routes/ecocash.php`):

1. The inbound webhook body is used for exactly one thing: reading `clientCorrelator`, to know *which* payment this notification claims to be about.
2. Everything else about that inbound body is discarded. It is never used to decide what actually happened.
3. The server then makes its own outbound call, `ecocashQueryTransaction()`, to EcoCash's Query Transaction endpoint, authenticated with this server's own API credentials (HTTP Basic Auth), asking "what is the real, current status of this specific transaction."
4. That authoritative response, not the original webhook body, is what gets checked against the expected amount, currency, and merchant code, and is what actually determines whether the payment gets marked verified or rejected.

The webhook is a *doorbell*, not a *delivery confirmation*. It tells the server when to go check, it never gets to say what the answer is.

One practical consequence of this design: `/ecocash/notify` can safely be hit by anyone, repeatedly, with a fabricated body, and the worst that happens is the server makes an extra authenticated query call to EcoCash and gets back the true state, which will not match whatever the attacker's fabricated payload claimed. No payment can be forged this way.

## Error handling

Two layers, covering two genuinely different failure modes:

- **`set_exception_handler`** catches anything explicitly thrown, a validation failure, a database error, a failed EcoCash call. Logs the real message server side via `error_log()`, returns a generic message to the client.
- **`register_shutdown_function`** catches genuine PHP fatal errors, the category that doesn't go through the exception handler at all, a `TypeError` that somehow wasn't caught, memory exhaustion, a broken `require`. Before this existed, a fatal error with `display_errors` off (the production default) produced a completely blank response, no error, no status explanation, nothing. This was directly responsible for a multi-hour debugging session during development where a completely unrelated cause (a misconfigured Xdebug breakpoint silently freezing every request) looked identical to a database hang from the outside, both looked exactly like a client that had gone dark. The shutdown handler doesn't fix issues like that, but it does guarantee any *catchable* class of silent failure gets a real, visible response going forward.

## Rate limiting

A single shared mechanism (`src/rateLimiter.php`), backed by a database table rather than in-memory storage, since the app has no long-running process to hold state in between requests. Three functions: check the count for a key within a time window, record an attempt, clear the record on success. Applied currently to login (5 per 15 minutes, only failures count), newsletter signup (5 per hour, every attempt counts), and order creation (10 per hour, every attempt counts). The distinction between "only failures count" and "every attempt counts" is deliberate: login rate limiting exists to stop password guessing, so a correct password should reset it; the other two exist to cap raw volume regardless of success, so counting successes too is the correct choice there.

## Known architectural limitations

Documented here deliberately, so they read as known tradeoffs rather than undiscovered bugs:

- **No automated tests exist yet.** `phpunit/phpunit` is listed as a dependency but not yet installed (skipped via `--no-dev`) or written.
- **Uploaded media lives on local disk**, not cloud object storage, which matters on any host that wipes local storage between deploys.
- **No restriction on who can reach the admin panel or its API routes** beyond the login password itself, no IP allowlist, no separate identity layer in front of it.
- **The database connection is a single PDO instance per request**, not a connection pool, this is appropriate at the current scale and would need reconsideration only if the app ever ran as a long-lived process rather than per-request via `php-fpm` or the built-in server.