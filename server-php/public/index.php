<?php

require __DIR__ . '/../src/env.php';
loadEnv(__DIR__ . '/../.env');

// APP_ENV controls how much PHP tells the browser when something breaks.
// Anywhere that is not explicitly local development is treated as
// production, fail-safe by default, rather than accidentally leaking
// stack traces because someone forgot to set this on a real host.
$appEnv = getenv('APP_ENV') ?: 'production';
if ($appEnv === 'local') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

require __DIR__ . '/../src/db.php';
require __DIR__ . '/../src/jwt.php';
require __DIR__ . '/../src/helpers.php';
require __DIR__ . '/../src/rateLimiter.php';
require __DIR__ . '/../src/routes/auth.php';
require __DIR__ . '/../src/routes/collections.php';
require __DIR__ . '/../src/routes/subscribe.php';
require __DIR__ . '/../src/routes/orders.php';
require __DIR__ . '/../src/routes/settings.php';
require __DIR__ . '/../src/upload.php';
require __DIR__ . '/../src/routes/payments.php';
require __DIR__ . '/../src/routes/ecocash.php';

$origin = getenv('FRONTEND_ORIGIN');
if ($origin) {
    header("Access-Control-Allow-Origin: $origin");
} elseif ($appEnv === 'local') {
    // Local dev without FRONTEND_ORIGIN configured, default to the port
    // the README's python -m http.server step uses, so setup still
    header('Access-Control-Allow-Origin: http://localhost:5500');
} else {
    // No trusted origin configured, and this is not local development.
    // Deliberately do not fall back to a wildcard here, that would let
    // any website on the internet make requests against this API using
    // a visitor's browser. Failing closed means cross-origin requests
    // get blocked by the browser until FRONTEND_ORIGIN is set properly,
    // which is loud and obvious in testing rather than a silent, quiet
    // security hole in production.
    error_log('FRONTEND_ORIGIN is not set. Refusing to allow cross origin requests until this is configured.');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage());
    jsonResponse(['error' => 'Something went wrong.'], 500);
});

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip a leading /api so routes below read the same as the Node version.
$path = preg_replace('#^/api#', '', rtrim($path, '/'));
if ($path === '') {
    $path = '/';
}

// Let the built-in server serve uploaded media files directly.
if (in_array($method, ['GET', 'HEAD'], true) && $path !== '/' && is_file(__DIR__ . $path)) {
    return false;
}

// --- Health check ---
if ($method === 'GET' && $path === '/health') {
    jsonResponse(['status' => 'ok']);
}

// --- Auth ---
if ($method === 'GET' && $path === '/auth/status') {
    authStatus();
}
if ($method === 'POST' && $path === '/auth/setup') {
    authSetup();
}
if ($method === 'POST' && $path === '/auth/login') {
    authLogin();
}
if ($method === 'PUT' && $path === '/auth/password') {
    authChangePassword();
}
if ($method === 'POST' && $path === '/uploads') {
    uploadMedia();
}

// --- Collections (and the /products alias) ---
if (preg_match('#^/(collections|products)$#', $path, $m)) {
    if ($method === 'GET') {
        collectionsList();
    }
    if ($method === 'POST') {
        collectionsCreate();
    }
}
if (preg_match('#^/(collections|products)/(\d+)$#', $path, $m)) {
    $id = $m[2];
    if ($method === 'GET') {
        collectionsGetOne($id);
    }
    if ($method === 'PUT') {
        collectionsUpdate($id);
    }
    if ($method === 'DELETE') {
        collectionsDelete($id);
    }
}

// --- Subscribe ---
if ($path === '/subscribe') {
    if ($method === 'POST') {
        subscribeCreate();
    }
    if ($method === 'GET') {
        subscribeList();
    }
}

// --- Orders ---
if ($path === '/orders') {
    if ($method === 'POST') {
        ordersCreate();
    }
    if ($method === 'GET') {
        ordersList();
    }
}
if ($method === 'POST' && $path === '/checkout') {
    ecocashCheckout();
}
if ($method === 'POST' && $path === '/ecocash/notify') {
    ecocashNotify();
}
if ($method === 'GET' && preg_match('#^/checkout/([a-f0-9]{64})$#', $path, $m)) {
    ecocashCheckoutStatus($m[1]);
}
if ($method === 'GET' && $path === '/orders/summary') {
    ordersSummary();
}
if ($method === 'GET' && $path === '/payments') {
    paymentsList();
}
if ($method === 'PUT' && preg_match('#^/payments/(\d+)/status$#', $path, $m)) {
    paymentsUpdateStatus($m[1]);
}
if ($method === 'GET' && $path === '/payments/report') {
    paymentsReport();
}

if ($path === '/settings') {
    if ($method === 'GET') {
        settingsGet();
    }
    if ($method === 'PUT') {
        settingsUpdate();
    }
}
if ($method === 'GET' && $path === '/settings/public') {
    settingsPublicGet();
}
if (preg_match('#^/orders/(\d+)/status$#', $path, $m)) {
    if ($method === 'PUT') {
        ordersUpdateStatus($m[1]);
    }
}

jsonResponse(['error' => 'Not found.'], 404);
