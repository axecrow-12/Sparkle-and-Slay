# Sparkle and Slay backend, PHP version

This is a plain PHP rewrite of the server folder, built for shared hosting that runs Apache and MySQL but does not run a persistent Node process. It has no Composer dependencies, so it will work on hosting where you cannot install packages or run a build step.

It exposes the same routes as the Node backend, so the frontend files (config.js, collections.js, admin.js, and the newsletter forms) do not need any changes beyond pointing config.js at wherever this backend ends up living.

## Requirements

- PHP 8.1 or newer, with the pdo_mysql and cURL extensions
- MySQL or MariaDB
- Apache with mod_rewrite, or an equivalent that can route unmatched requests to index.php

## Setup

On Windows with Laravel Herd, close and reopen PowerShell after installation so the `php` command is available. Verify it with:

   php -v
   php -m | findstr pdo_mysql

1. Create a database and a user in MySQL or phpMyAdmin:

   CREATE DATABASE sparkle_slay;
   CREATE USER 'sparkle_user'@'localhost' IDENTIFIED BY 'changeme';
   GRANT ALL PRIVILEGES ON sparkle_slay.* TO 'sparkle_user'@'localhost';

2. Copy the environment template and fill in your own values. On Windows PowerShell:

   Copy-Item .env.example .env

   Set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD to match what you created, and set JWT_SECRET to a long random string. Do not reuse the example values in production.

3. Run the migration from this directory. The schema starts empty; add products later through the admin panel:

   php migrate.php

   This applies the payment ledger and EcoCash API checkout migrations.

4. For local testing, PHP has a built-in server on port 4001:

   php -S localhost:4001 -t public public/index.php

5. In a second terminal, serve the frontend from the project root on port 5500:

   python -m http.server 5500

Open http://localhost:5500 after both servers are running.

   For real hosting, point the document root at the public folder, or place the public folder inside a directory called api at your site root so the routes line up with /api/... the way config.js expects.

## How this maps to the Node version

- Each route file under src/routes matches its counterpart in server/src/routes one to one: auth.php, collections.php, subscribe.php, orders.php.
- Password hashing uses PHP's built in password_hash and password_verify instead of bcryptjs. Same algorithm underneath.
- JSON web tokens are signed and checked with a small hand written HS256 implementation in src/jwt.php instead of the jsonwebtoken package, so no Composer install is required. If you would rather use a maintained library, firebase/php-jwt is a drop in replacement.
- public/index.php is the front controller. It reads the request path and method and calls the matching function, the same shape as the Express routes in server/src/index.js.
- The database schema in migrations/001_init.sql is the MySQL equivalent of the PostgreSQL schema in the Node version. Column names and table names are identical.

## Notes for shared hosting

- Most shared hosting exposes phpMyAdmin or a control panel database tool instead of a command line MySQL, so you can also paste migrations/001_init.sql into that tool instead of running php migrate.php over SSH.
- Keep .env out of the public folder. This project already keeps it one level above public, which is the safer place for it.
- Customers can use either the existing manual EcoCash reference form or automated EcoCash checkout. Automated checkout recalculates the cart total on the server, sends the payment request to EcoCash, and records the transaction in `payments`.
- Automated checkout requires the EcoCash values in `.env.example` to be copied into `.env`. Keep the username, password, merchant PIN, merchant code, and merchant number server-side; never put them in frontend files or Admin Settings. The sample values are placeholders and must be replaced locally.
- Set `ECOCASH_NOTIFY_URL` to a public HTTPS URL ending in `/api/ecocash/notify`. EcoCash sends the final `COMPLETED` or `FAILED` notification there. Localhost is not reachable by EcoCash; use a secure tunnel or a deployed pre-production callback when testing.
- Set `ECOCASH_API_URL` to the pre-production endpoint while testing, then change it to the production endpoint only after a successful test transaction. The current integration sends the documented JSON contract and stores provider references and statuses in `payments`.
- Automated checkout calculates the product subtotal plus the existing 1.3% EcoCash and 2% IMTT fees. The cart is cleared only after EcoCash confirms completion.
- The admin Payments view provides weekly and monthly reports and uses the browser print dialog. Reports use the PHP/MySQL server local time for calendar boundaries.
