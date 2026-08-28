# Agent Instructions

## Terminal Environment

- Use PowerShell commands from the repository root unless a command below names a backend directory.
- The active local backend is PHP/MySQL in `server-php`; the Node/PostgreSQL backend in `server` is an alternative.
- Do not print, commit, or expose values from `.env` files. The root `.env` is unused; PHP loads `server-php/.env` and Node loads `server/.env`.
- Before changing startup or API behavior, read [README.md](README.md) and the relevant backend README.

### Frontend and PHP Backend

Use separate terminals:

```powershell
Set-Location server-php
Copy-Item .env.example .env # first setup only; fill in DB_* and JWT_SECRET
php migrate.php             # first setup or after schema changes
php -S localhost:4001 -t public public/index.php
```

In another terminal from the repository root:

```powershell
python -m http.server 5500
```

The frontend uses `http://localhost:4001/api`. Verify the PHP API with:

```powershell
Invoke-RestMethod http://localhost:4001/api/health
```

PHP requires version 8.1 or newer, `pdo_mysql`, and an existing MySQL/MariaDB database. See [server-php/README.md](server-php/README.md) for database setup and hosting details.

### Optional Node Backend

From `server`:

```powershell
npm ci
npm run migrate # first setup or after schema changes
npm start       # port 4000
```

Use `npm run dev` for watch mode. Node requires PostgreSQL and its own `server/.env`; its frontend URL is not selected until `config.js` is changed to `http://localhost:4000/api`. Verify it with:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

There is no automated test script in either backend. Prefer the health endpoint plus focused manual/API checks after server changes.