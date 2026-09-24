// PHP backend base URL.
//
// LOCAL DEV: the PHP backend runs on port 4001 (`php -S localhost:4001 ...`).
// EVERYWHERE ELSE: same-origin `/api` — this matches the cPanel layout where
// server-php/public's contents are reachable at <this site's domain>/api.
// See server-php/CPANEL_DEPLOY.md. If the API ever moves to a different
// domain or subdomain, replace the else-branch below with that HTTPS origin.
const USE_BACKEND = true;

const API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:4001/api"
  : `${window.location.origin}/api`;
