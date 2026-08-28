# Sparkle and Slay

An online boutique website. The frontend is plain HTML, CSS, and JavaScript. There are two backend options, pick one:

- server, a Node and Express app using PostgreSQL. Setup steps are below.
- server-php, a plain PHP app using MySQL, built for shared hosting with no Composer step required. See server-php/README.md for full setup and how it maps to the Node version.

Either backend exposes the same routes, so the frontend does not care which one you run. You only need to point config.js at whichever one you choose.

## What is in this project

- Static frontend: index.html, collection.html, admin.html, login.html, contact.html, styles.css, collections.js, admin.js, config.js
- server: the Node and Express backend using PostgreSQL
- server-php: the PHP backend using MySQL, no Composer dependencies

The frontend used to store everything in the browser using localStorage. It now talks to a real backend for collections, orders, newsletter signups, and admin login.

## Node backend setup

1. Install PostgreSQL if you do not already have it running.
2. Create a database and a user for the app. Example commands using psql:

   CREATE USER sparkle_user WITH PASSWORD 'changeme';
   CREATE DATABASE sparkle_slay OWNER sparkle_user;

3. From the server folder, copy the example environment file and fill in your own values:

   cp .env.example .env

   Set DATABASE_URL to match the user and database you created, and set JWT_SECRET to a long random string. Do not reuse the example values in production.

4. Install dependencies and run the migration:

   npm install
   npm run migrate

5. Start the API:

   npm start

   The API listens on port 4000 by default and exposes routes under /api, including /api/health for a quick check.

## Frontend setup

The frontend is plain HTML, CSS, and JavaScript, so it just needs to be served as static files. From the project root:

   python3 -m http.server 5500

Then open http://localhost:5500 in your browser.

The file config.js holds the API_BASE value the frontend uses to reach the backend. Update it if your backend runs somewhere other than http://localhost:4000/api.

## First time admin login

There is no admin account until you create one:

1. Open login.html in the browser.
2. Since no password exists yet, the page automatically shows the setup form.
3. Choose a password at least eight characters long and submit it.
4. You are logged in and redirected to admin.html, where you can add, edit, and remove collections.

From then on, login.html shows the normal login form instead of setup.

## What still needs attention

- The photos and videos folders referenced across the pages are not included in this project yet and will be added once the marketing team uploads the real assets.
- Cart and checkout beyond the manual Ecocash order form, product detail pages, and single page style routing are not built yet.
- Deployment: the frontend can go to a static host such as Vercel or Netlify. The Node backend needs a host that can run Node and connect to a PostgreSQL database. The PHP backend in server-php is built for ordinary shared hosting with Apache and MySQL, which is often the cheaper and simpler option if you are not already paying for a Node friendly host.
