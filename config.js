// PHP backend base URL.
//
// LOCAL DEV: the PHP backend runs on port 4001 (`php -S localhost:4001 ...`).
//
// BEFORE DEPLOYING: change API_BASE to the deployed backend's HTTPS origin, e.g.
//   const API_BASE = "https://sparkleandslay.com/api";
// Leaving this as http://localhost:4001 in production breaks every request and
// causes mixed-content / "HTTP URL" warnings. See server-php/DEPLOYMENT.md.
const USE_BACKEND = true;

const API_BASE = "http://localhost:4001/api";
