# Deployment Guide

This covers moving from local development to a real host. Read the whole checklist before starting, several of these steps depend on each other and are easy to get out of order.

## Hosting requirements

- PHP 8.1 or newer, with `pdo_mysql` and `curl` extensions enabled
- Apache with `mod_rewrite` (the included `public/.htaccess` routes every request through `index.php`, this is what makes clean URLs like `/api/collections` work instead of `/api/index.php?path=collections`)
- MySQL or MariaDB, reachable from the host running PHP
- Composer available at deploy time, or the ability to run `composer install` locally and upload the resulting `vendor/` folder
- **HTTPS.** Not optional, EcoCash requires a public HTTPS URL for `ECOCASH_NOTIFY_URL`, and a plain HTTP admin panel would send the login password in cleartext.

## Pre-deployment checklist

Go through this in order. Several of these were mistakes made during development, they're listed here specifically because they already happened once.

### 1. Rotate the JWT secret

If this has not already been done: generate a fresh value and put it only in the production `.env`, never in `.env.example`.

    php -r "echo bin2hex(random_bytes(32));"

The value currently in `.env.example` has been visible in this project's public GitHub history since early in development. Deploying with that value still active means anyone who has seen the repository can forge a valid admin session, regardless of the actual login password.

### 2. Set every environment-dependent value correctly

These four behave differently in production than they do during local development, and getting any of them wrong fails in a way that can look like an unrelated bug:

| Variable | Local value | Production value |
|---|---|---|
| `APP_ENV` | `local` | anything else, or unset (production is the default, fail-safe behavior) |
| `FRONTEND_ORIGIN` | `http://localhost:5500` (or unset, falls back automatically) | the real frontend domain, exactly, scheme included (`https://sparkleandslay.com`) |
| `ECOCASH_API_URL` / `ECOCASH_QUERY_BASE_URL` | the `-preprod` EcoCash endpoints | the production EcoCash endpoints, only after a successful preprod test transaction |
| `ECOCASH_NOTIFY_URL` | an `ngrok` tunnel URL | the real, permanent, public HTTPS URL ending in `/api/ecocash/notify` |

Getting `FRONTEND_ORIGIN` wrong in production doesn't throw an error anywhere obvious, it silently blocks every request from the browser with a CORS failure, which looks identical to the API being down entirely. If the site loads but nothing that hits the API works, check this first.

### 3. Install dependencies for production

    composer install --no-dev --optimize-autoloader

`--no-dev` skips PHPUnit, PHPStan, and PHP CS Fixer, none of which are needed to actually run the site, and none of which should exist on a production host. `--optimize-autoloader` is worth adding here specifically, it wasn't used during development but costs nothing and speeds up every request slightly in an environment where files don't change between requests.

### 4. Run migrations

    php migrate.php

Or, if the host only offers phpMyAdmin or a similar web-based tool with no SSH access, paste each file under `migrations/` into it in numeric order, `001` through `005`.

### 5. Confirm file permissions on the uploads directory

`public/uploads/` needs to be writable by whatever user PHP runs as, or every image upload from the admin panel will fail with a 500 error. On most shared hosting this is handled automatically, on a VPS you control yourself, confirm explicitly:

    chmod 755 public/uploads

### 6. Verify the two `.htaccess` files made it to the server

Both are easy to lose if deployment happens via a method that filters dotfiles (some FTP clients and deploy scripts do this by default).

- `public/.htaccess` — without this, every route except `/` returns Apache's default 404, `mod_rewrite` never hands the request to `index.php`
- `public/uploads/.htaccess` — without this, the defense-in-depth block against executing uploaded files as scripts is silently gone, the MIME type check in `src/upload.php` is still there, but this second layer isn't

Confirm both exist on the server after upload, not just locally, dotfiles are the specific category of file that goes missing silently.

### 7. Point the document root correctly

The document root needs to be `public/`, not the `server-php` folder itself. If the host requires the API to live under a specific path (like `/api`), the cleanest approach is placing the contents of `public/` inside a folder literally named `api` at the site root, matching what `config.js` on the frontend already expects (`http://.../api/...`).

## What deliberately does not change between environments

Worth stating explicitly, so nothing gets "fixed" that was never broken:

- The database connection uses `127.0.0.1`, not `localhost`, everywhere, including production. This isn't a local-only workaround, it avoids a real IPv6 resolution ambiguity that can occur on any host, not just the Windows development machine where it was first found.
- CORS never falls back to a wildcard `*` origin, in any environment. In `local` mode it defaults to a fixed convenience value, in every other mode, an unset `FRONTEND_ORIGIN` fails closed rather than falling open. There is no environment where this app allows requests from an unconfigured origin.
- The fatal error shutdown handler and the exception handler are both always active, regardless of `APP_ENV`. Only `display_errors` (whether the *details* are shown) changes with the environment, the guarantee that a broken request still returns a clean JSON error rather than a blank response does not.

## Known gaps at deployment time

Two items from the project's ongoing task list directly affect what "deployed" actually means right now, worth being explicit about rather than assuming they're handled:

- **Uploaded product images are stored on local disk.** On hosting that wipes local storage between deploys (common on several modern platform-as-a-service hosts), every uploaded image is lost on the next deploy. This is fine on traditional shared hosting or a persistent VPS, it is not fine on ephemeral hosting. Confirm which kind of host this is before relying on the upload feature in production.
- **The admin panel has no restriction beyond the login password.** Anyone who finds `admin.html` can see the login form itself, they just can't get past it without the password. If a stricter restriction (by identity, since a fixed IP to allowlist isn't available) is needed before launch, that work has not started yet.

## Frontend (static site) checklist

The storefront pages (`index.html`, `collection.html`, `contact.html`,
`login.html`, `admin.html`, `404.html` + `styles.css`, `*.js`, `photos/`,
`videos/`) are served separately from the API. Before/at deploy:

1. **`config.js`** — set `API_BASE` to the deployed backend's **HTTPS** origin
   (e.g. `https://sparkleandslay.com/api`). While it points at
   `http://localhost:4001` a crawler/browser reports "HTTP URLs", "Outlinks to
   localhost", and mixed-content warnings — those clear once it's an HTTPS URL.
2. **Canonical URLs** — every page has
   `<link rel="canonical" href="https://sparkleandslay.com/...">`. If the real
   domain differs, find/replace `https://sparkleandslay.com` across the `.html`
   files.
3. **Security headers** — the repo ships two equivalent configs; keep the one
   your host uses:
   - `/.htaccess` — Apache / shared hosting (`mod_headers` + `mod_expires`).
   - `/_headers` — Netlify / Cloudflare Pages.
   Both set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   `Permissions-Policy`, `Content-Security-Policy`, and (over HTTPS) HSTS.
   The API side is covered by `public/.htaccess` and header calls in
   `public/index.php`.
4. **CSP hardening (follow-up)** — the frontend CSP currently allows
   `script-src 'unsafe-inline'` because the pages use inline `<script>` blocks
   and inline `onerror=` handlers on the logo images. Moving those to external
   files (or nonces/hashes) lets you drop `'unsafe-inline'`. Also narrow
   `img-src`/`connect-src` from `https:` to the exact API origin once it's fixed.
5. **404** — `404.html` is wired via `ErrorDocument` in `.htaccess`; Netlify /
   Cloudflare Pages pick it up automatically.
6. **Images** — run `python scripts/optimize_images.py` (see `README.md`) to
   shrink the oversized `photos/` assets before deploy; re-point any `.png` → `.jpg`
   references if you use `--png-to-jpeg`.
7. **Re-crawl** the live HTTPS site to confirm the localhost/HTTP findings are
   gone.

## Post-deployment smoke test

In order, after the site is live:

1. `GET https://yourdomain.com/api/health` returns `{"status": "ok"}`
2. The storefront loads and the product list appears (confirms the database connection and CORS are both correct)
3. Log in to the admin panel with the real production password
4. Upload a test product image, confirm it actually appears (confirms upload directory permissions)
5. Run one real EcoCash preprod transaction end to end, including the phone approval and the notify callback actually arriving, before ever switching `ECOCASH_API_URL` to the production endpoint