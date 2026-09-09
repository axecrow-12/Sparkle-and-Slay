# Sparkle and Slay backend, PHP version

A PHP and MySQL backend built for straightforward hosting, no persistent Node process required, though it now uses Composer for its few small dependencies rather than being fully dependency free.

It exposes the same routes the frontend already expects, so `config.js`, `collections.js`, `admin.js`, and the newsletter forms do not need any changes beyond pointing `config.js` at wherever this backend ends up living.

## Requirements

- PHP 8.1 or newer, with the `pdo_mysql` and `curl` extensions
- [Composer](https://getcomposer.org)
- MySQL or MariaDB
- Apache with `mod_rewrite`, or an equivalent that can route unmatched requests to `index.php`

## Setup

On Windows with Laravel Herd, close and reopen PowerShell after installation so the `php` and `composer` commands are available. Verify with:

    php -v
    php -m | findstr pdo_mysql
    composer --version

1. From this directory, install dependencies:

       composer install --no-dev

   `--no-dev` skips the testing and static analysis tooling (PHPUnit, PHPStan, PHP CS Fixer), which is not required to actually run the site. Drop `--no-dev` once you are working on the test suite itself.

   Two things worth knowing if this step fails partway through, both encountered during development:

   - **Antivirus software may block it.** Composer extracts many package files in quick succession, which some antivirus heuristics (360 Total Security specifically has done this) mistake for ransomware behavior. If a security prompt appears mid install, allow it, then add an exclusion for this project's `vendor` folder and your PHP installation folder so future installs are not interrupted mid write, an interrupted extraction is a common cause of a corrupted, inconsistent `vendor` folder.
   - **GitHub rate limiting can cause repeated `HTTP 504` download failures.** If this happens consistently rather than as a one off, generate a free GitHub personal access token and run `composer config --global github-oauth.github.com YOUR_TOKEN`, which raises Composer's download rate limit substantially.

2. Create a database and a user in MySQL or phpMyAdmin:

       CREATE DATABASE sparkle_slay;
       CREATE USER 'sparkle_user'@'localhost' IDENTIFIED BY 'changeme';
       GRANT ALL PRIVILEGES ON sparkle_slay.* TO 'sparkle_user'@'localhost';

3. Copy the environment template and fill in your own values. On Windows PowerShell:

       Copy-Item .env.example .env

   Set the following, all required:

   - `DB_HOST` — use `127.0.0.1`, not `localhost`. On Windows, `localhost` can resolve to the IPv6 loopback address before falling back to IPv4, and if MySQL is only listening on IPv4, PHP's PDO driver hangs indefinitely trying to connect rather than failing with a clear error. This cost significant debugging time during development, `127.0.0.1` avoids the ambiguity entirely.
   - `DB_NAME`, `DB_USER`, `DB_PASSWORD` — match what you created above. Any value containing a space must be wrapped in double quotes (for example `ECOCASH_MERCHANT_NAME="Sparkle and Slay"`), the environment loader will fail to parse the file otherwise.
   - `JWT_SECRET` — a long random string, generate one with `php -r "echo bin2hex(random_bytes(32));"`. **Do not use the value currently committed in `.env.example`.** That value has been publicly visible in this project's GitHub history; anyone who has seen it can forge a valid admin session. Rotate this before deploying anywhere, and do not put a real secret back into `.env.example`, only an obvious placeholder belongs there.
   - `APP_ENV` — set to `local` for development. This enables visible PHP errors and defaults CORS to `http://localhost:5500` for convenience. Any other value, or leaving it unset, is treated as production: errors are logged instead of displayed, and `FRONTEND_ORIGIN` below becomes required rather than optional.
   - `FRONTEND_ORIGIN` — the exact origin the frontend is served from. In production, if this is not set, the API deliberately refuses to allow any cross origin request rather than falling back to a wildcard that would accept requests from any website.

4. Run the migrations from this directory. The schema starts empty; add products later through the admin panel:

       php migrate.php

   This applies all five migrations in order: the base schema, the payment ledger, EcoCash API checkout support, product variants, and the login rate limiting table.

5. For local testing, PHP has a built in server on port 4001:

       php -S localhost:4001 -t public public/index.php

6. In a second terminal, serve the frontend from the project root on port 5500:

       python -m http.server 5500

Open http://localhost:5500 after both servers are running.

For real hosting, point the document root at the `public` folder, or place the `public` folder inside a directory called `api` at your site root so the routes line up with `/api/...` the way `config.js` expects.

## Architecture

- **Routing** is handled by [nikic/fast-route](https://github.com/nikic/FastRoute), registered in `public/index.php`. Every route maps to a plain function in `src/routes/`, there is no controller class hierarchy to navigate, a route name in `index.php` is the function name to search for.
- **Environment loading** uses [vlucas/phpdotenv](https://github.com/vlucas/phpdotenv), wrapped in `src/env.php`'s `loadEnv()` so every existing call site kept working unchanged through the migration.
- **Authentication** is a small hand written HS256 JSON Web Token implementation in `src/jwt.php`, using `hash_equals` for constant time signature verification. There is a single admin account, no per-user roles exist. Login attempts are rate limited (`src/rateLimiter.php`) to guard against password guessing.
- **Database access** goes through a single PDO connection (`src/db.php`), always with prepared statements, no raw string interpolation into SQL anywhere in the codebase. The connection forces IPv4 and a five second timeout, see the setup note above for why.
- **Error handling** has two layers: `set_exception_handler` in `public/index.php` catches thrown exceptions and returns a generic error to the client while logging the real message server side, and a `register_shutdown_function` catches genuine PHP fatal errors (which exceptions alone do not cover) so a broken request can never return a silent, blank response.
- **EcoCash payment confirmation** does not trust the inbound `/ecocash/notify` webhook body on its own, EcoCash's API does not sign or authenticate that callback. Instead, the notify handler uses the webhook only as a signal to go ask EcoCash directly, using this server's own API credentials, what the transaction's real status is (`ecocashQueryTransaction()` in `src/routes/ecocash.php`), and finalizes the payment based on that authoritative response.
- **Pagination, search, and caching**: the product, orders, subscribers, and payments list endpoints all support `?page=` and `?perPage=`. Product search is server side via `?search=`. The public product list and public settings endpoints send `Cache-Control` headers, admin only endpoints are never cached.

## Notes for shared hosting

- Most shared hosting exposes phpMyAdmin or a control panel database tool instead of command line MySQL access, so you can also paste each file in `migrations/` into that tool in order instead of running `php migrate.php` over SSH.
- Keep `.env` out of the public folder. This project already keeps it one level above `public`, which is the safer location.
- The `public/uploads/` folder has an `.htaccess` blocking script execution as defense in depth, on top of the MIME type checking already done in `src/upload.php`. Uploaded files are currently stored on local disk; this is a known limitation, not yet migrated to cloud object storage, which matters if deploying to a host that wipes local storage on redeploy.
- There is currently no restriction on who can reach `admin.html` or the admin API routes beyond the login password itself. Restricting this further (by identity, via something like Cloudflare Access, since a fixed IP to allowlist is not available) is planned but not yet implemented.
- Customers can use either the manual EcoCash reference form or automated EcoCash checkout. Automated checkout recalculates the cart total server side, sends the payment request to EcoCash, and records the transaction in `payments`.
- Set `ECOCASH_NOTIFY_URL` to a public HTTPS URL ending in `/api/ecocash/notify`. Localhost is not reachable by EcoCash directly; use a secure tunnel (see `ECOCASH_NGROK_SETUP.md`) or a deployed environment when testing.
- Set `ECOCASH_API_URL` and `ECOCASH_QUERY_BASE_URL` to the pre-production endpoints while testing, then change both to the production endpoints only after a successful test transaction.
- Automated checkout calculates the product subtotal plus the existing 1.3% EcoCash and 2% IMTT fees. The cart clears only after EcoCash confirms completion via the query based confirmation described above.
- The admin Payments view provides weekly and monthly reports and uses the browser print dialog. Reports use the PHP/MySQL server's local time for calendar boundaries.

## Optimising images

`photos/` contains several large source images (some over 1 MB). Before deploying
the storefront, shrink them:

```
python scripts/optimize_images.py                        # dry run — shows a size table
python scripts/optimize_images.py --apply                # downscale + re-encode in place
python scripts/optimize_images.py --apply --png-to-jpeg  # also convert big opaque PNGs to JPEG
python scripts/optimize_images.py --apply --webp         # also emit .webp siblings
```

Originals are copied once to `photos/_originals/`. `--png-to-jpeg` renames files
(`.png` → `.jpg`) and flattens transparency onto white — update the references in
`*.html` / `*.js` / `styles.css` afterwards, and don't run it on the logo.
Needs Pillow (`pip install Pillow`).