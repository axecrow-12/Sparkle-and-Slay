# Sparkle and Slay

An online boutique website. The frontend is plain HTML, CSS, and JavaScript. The active local backend is the PHP/MySQL server:

- server-php, a plain PHP app using MySQL, built for shared hosting with no Composer step required. See server-php/README.md for full setup.
- server, a Node and Express app using PostgreSQL, retained as an alternative backend.

Either backend exposes the same routes, so the frontend does not care which one you run. You only need to point config.js at whichever one you choose.

## What is in this project

- Static frontend: index.html, collection.html, admin.html, login.html, contact.html, styles.css, collections.js, admin.js, config.js
- server: the Node and Express backend using PostgreSQL
- server-php: the PHP backend using MySQL, no Composer dependencies

The frontend used to store everything in the browser using localStorage. It now talks to a real backend for collections, orders, newsletter signups, and admin login.

## PHP backend setup (active local backend)

1. Install PHP 8.1 or newer and enable the `pdo_mysql` extension. Confirm with:

   php -v
   php -m | findstr pdo_mysql

2. Create a MySQL database and user. Example commands using the MySQL client:

   CREATE DATABASE sparkle_slay;
   CREATE USER 'sparkle_user'@'localhost' IDENTIFIED BY 'changeme';
   GRANT ALL PRIVILEGES ON sparkle_slay.* TO 'sparkle_user'@'localhost';
   FLUSH PRIVILEGES;

3. From the `server-php` folder, copy the environment template and fill in the values:

   Copy-Item .env.example .env

   Set `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `JWT_SECRET`. Do not reuse the example secret in production.

4. Run the migration. The database starts empty by design:

   php migrate.php

   This also creates the payment ledger used for EcoCash references and reports.

5. Start the PHP API from `server-php`:

   php -S localhost:4001 -t public public/index.php

   The API exposes routes under `/api`, including `/api/health` for a quick check.

## Node backend setup (alternative)

The Node/PostgreSQL backend remains in `server/`. Follow its own environment, migration, and startup instructions if you choose it instead.

## Frontend setup

The frontend is plain HTML, CSS, and JavaScript, so it just needs to be served as static files. From the project root:

   python -m http.server 5500

Then open http://localhost:5500 in your browser.

The file `config.js` holds the API URL and backend mode. The current PHP configuration uses `http://localhost:4001/api`.

## First time admin login

There is no admin account until you create one:

1. Open login.html in the browser.
2. Since no password exists yet, the page automatically shows the setup form.
3. Choose a password at least eight characters long and submit it.
4. You are logged in and redirected to admin.html, where you can add, edit, and remove collections.

From then on, login.html shows the normal login form instead of setup.

## Current notes

- The PHP database starts empty; add products through the admin panel after creating the first admin password.
- The cart uses local browser storage and submits the existing manual EcoCash order form.
- EcoCash checkout submissions create pending payment records. Verify or reject them from the Payments section of the admin workspace.
- The EcoCash merchant number is managed in Admin > Settings and shown on checkout. Weekly and monthly payment reports can be printed from Admin > Payments.
- Deployment: the frontend can go to a static host, while the PHP backend can run on Apache/shared hosting with MySQL.
