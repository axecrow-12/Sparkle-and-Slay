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

- The database connection defaults to `127.0.0.1`, not `localhost`, to avoid a real IPv6 resolution ambiguity that can occur on any host, not just the Windows development machine where it was first found. **Exception:** on cPanel and similar shared hosting, the MySQL user cPanel creates is often grant-restricted to `'user'@'localhost'` (the Unix socket) only — connecting via the TCP `127.0.0.1` path can then fail with "Access denied" even with correct credentials, because MySQL's privilege matching treats `localhost` and `127.0.0.1` as different hosts. If that happens, set `DB_HOST=localhost` in that environment's `.env`; see `.env.example`.
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

1. **`config.js`** — `API_BASE` now derives itself: `http://localhost:4001/api`
   only when the page is served from `localhost`/`127.0.0.1`, otherwise
   `${window.location.origin}/api`. Nothing to edit as long as the API lives at
   `/api` on the same domain as the frontend (the cPanel layout below). If the
   API instead lives on a separate domain or subdomain, replace the else-branch
   in `config.js` with that fixed HTTPS origin.
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

## cPanel walkthrough (same domain, `/api` path, SSH available)

This project's chosen layout: frontend and API on the same domain
(`sparkleandslay.com` and `sparkleandslay.com/api`), deploying with SSH access
to cPanel (cPanel's **Terminal** app, or a real SSH client). Run everything
below from the account's home directory unless noted.

### 1. Keep the PHP app out of the web root

`public_html` is the only web-accessible folder. `server-php/`'s `.env`,
`src/`, `vendor/`, and `migrations/` must **never** live inside it — otherwise
`https://sparkleandslay.com/.env` is a real, fetchable URL. Upload (via Git,
SFTP, or cPanel's File Manager) the whole `server-php` folder into the home
directory, as a sibling of `public_html`:

    ~/server-php/            <- NOT web-accessible
      public/
      src/
      vendor/                <- created by composer install, step 2
      migrations/
      .env                   <- created in step 4, never committed
      composer.json
    ~/public_html/           <- web-accessible (the frontend + everything below repo root)
      index.html
      collection.html
      ...

### 2. Install dependencies on the server

    cd ~/server-php
    composer install --no-dev --optimize-autoloader

If cPanel's Terminal doesn't have `composer`, check **Setup PHP App** /
**Software** in cPanel first — most modern cPanel builds bundle it. As a
fallback, run `composer install --no-dev --optimize-autoloader` locally and
upload the resulting `vendor/` folder via SFTP (it's large; a zip upload
extracted through File Manager is much faster than per-file SFTP).

### 3. Expose `public/` at `/api` without moving it into the web root

    cd ~/public_html
    ln -s ~/server-php/public api

This makes `https://sparkleandslay.com/api/...` serve
`~/server-php/public/index.php`, whose own `__DIR__ . '/../...'` paths
(`vendor/autoload.php`, `.env`) still resolve to the real `~/server-php/`
directory — so nothing sensitive ever sits inside `public_html`. The
`public/.htaccess` routing file and `public/uploads/.htaccess` travel with the
symlink automatically; nothing to duplicate.

(If cPanel's file structure uses `~/public_html` under a different path, e.g.
an addon domain's own `public_html`, point the symlink there instead — the
principle is the same: `api` inside the site's web root, pointing at
`server-php/public` outside it.)

### 4. Create the database and the `.env` file

In cPanel: **MySQL Databases** → create a database and a user, add the user to
the database with **All Privileges**. cPanel usually prefixes both with your
account username (e.g. `cpaneluser_sparkle_slay`) — use the prefixed names.

    cd ~/server-php
    cp .env.example .env

Edit `.env` (cPanel File Manager's code editor, or `nano .env` over SSH):

| Variable | Set to |
|---|---|
| `DB_HOST` | try `127.0.0.1` first; switch to `localhost` if you get "Access denied" (see the note above) |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | the prefixed values from the MySQL Databases page |
| `JWT_SECRET` | fresh output of `php -r "echo bin2hex(random_bytes(32));"` — never the `.env.example` placeholder |
| `APP_ENV` | unset, or anything other than `local` |
| `FRONTEND_ORIGIN` | `https://sparkleandslay.com` exactly |
| `ECOCASH_NOTIFY_URL` | `https://sparkleandslay.com/api/ecocash/notify` |
| `ECOCASH_API_URL` / `ECOCASH_QUERY_BASE_URL` | keep the `-preprod` values until a successful preprod transaction (see step 6) |

### 5. Migrate and set permissions

    cd ~/server-php
    php migrate.php
    chmod 755 public/uploads

### 6. SSL, then verify

cPanel's **SSL/TLS Status** → **AutoSSL** (or Let's Encrypt, depending on the
host) needs to be issued and active for the domain before EcoCash's notify
callback or the admin login are usable. Then work through the smoke test
below against `https://sparkleandslay.com`.



In order, after the site is live:

1. `GET https://yourdomain.com/api/health` returns `{"status": "ok"}`
2. The storefront loads and the product list appears (confirms the database connection and CORS are both correct)
3. Log in to the admin panel with the real production password
4. Upload a test product image, confirm it actually appears (confirms upload directory permissions)
5. Run one real EcoCash preprod transaction end to end, including the phone approval and the notify callback actually arriving, before ever switching `ECOCASH_API_URL` to the production endpoint