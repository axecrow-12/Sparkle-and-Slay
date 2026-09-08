<?php

use FastRoute\RouteCollector;
use function FastRoute\simpleDispatcher;

require __DIR__ . '/../vendor/autoload.php';
loadEnv(__DIR__ . '/../.env');


$appEnv = getenv('APP_ENV') ?: 'production';
if ($appEnv === 'local') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

$origin = getenv('FRONTEND_ORIGIN');
if ($origin) {
    header("Access-Control-Allow-Origin: $origin");
} elseif ($appEnv === 'local') {
    // Local dev without FRONTEND_ORIGIN configured, default to the port
    // the README's python -m http.server step uses, so setup still
    header('Access-Control-Allow-Origin: http://localhost:5500');
} else {
    //Work to be done ( Before Deployment )- add reminder to phone
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

// set_exception_handler only catches things that get thrown. A genuine
// PHP fatal error (a TypeError that somehow isn't caught, memory
// exhaustion, a broken requirement) skips that entirely and, with
// display_errors off, previously meant the client got back nothing at
// all, exactly the silent, blank failure that took an entire session to
// track down earlier. This catches that category specifically.
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error === null) {
        return; // clean shutdown, nothing to do
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR];
    if (!in_array($error['type'], $fatalTypes, true)) {
        return; // just a warning or notice, not what killed the request
    }

    error_log("Fatal error: {$error['message']} in {$error['file']}:{$error['line']}");

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Something went wrong.']);
    }
});

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip a leading /api so routes below read the same as the Node version.
$path = preg_replace('#^/api#', '', rtrim($path, '/'));
if ($path === '') {
    $path = '/';
}


if (in_array($method, ['GET', 'HEAD'], true) && $path !== '/' && is_file(__DIR__ . $path)) {
    return false;
}

$dispatcher = simpleDispatcher(function (RouteCollector $r) {
    $r->addRoute('GET', '/health', function () {
        jsonResponse(['status' => 'ok']);
    });

    $r->addRoute('GET', '/auth/status', 'authStatus');
    $r->addRoute('POST', '/auth/setup', 'authSetup');
    $r->addRoute('POST', '/auth/login', 'authLogin');
    $r->addRoute('PUT', '/auth/password', 'authChangePassword');
    $r->addRoute('POST', '/uploads', 'uploadMedia');

    // /products stays as a plain alias of /collections, same handlers,
    // exactly matching the original preg_match('#^/(collections|products)#')
    foreach (['/collections', '/products'] as $base) {
        $r->addRoute('GET', $base, 'collectionsList');
        $r->addRoute('POST', $base, 'collectionsCreate');
        $r->addRoute('GET', "$base/{id:\d+}", 'collectionsGetOne');
        $r->addRoute('PUT', "$base/{id:\d+}", 'collectionsUpdate');
        $r->addRoute('DELETE', "$base/{id:\d+}", 'collectionsDelete');
    }

    $r->addRoute('POST', '/subscribe', 'subscribeCreate');
    $r->addRoute('GET', '/subscribe', 'subscribeList');

    $r->addRoute('POST', '/orders', 'ordersCreate');
    $r->addRoute('GET', '/orders', 'ordersList');
    $r->addRoute('POST', '/checkout', 'ecocashCheckout');
    $r->addRoute('POST', '/ecocash/notify', 'ecocashNotify');
    $r->addRoute('GET', '/checkout/{token:[a-f0-9]{64}}', 'ecocashCheckoutStatus');
    $r->addRoute('GET', '/orders/summary', 'ordersSummary');
    $r->addRoute('GET', '/payments', 'paymentsList');
    $r->addRoute('PUT', '/payments/{id:\d+}/status', 'paymentsUpdateStatus');
    $r->addRoute('GET', '/payments/report', 'paymentsReport');

    $r->addRoute('GET', '/settings', 'settingsGet');
    $r->addRoute('PUT', '/settings', 'settingsUpdate');
    $r->addRoute('GET', '/settings/public', 'settingsPublicGet');

    $r->addRoute('PUT', '/orders/{id:\d+}/status', 'ordersUpdateStatus');
});

$routeInfo = $dispatcher->dispatch($method, $path);

switch ($routeInfo[0]) {
    case FastRoute\Dispatcher::FOUND:
        $handler = $routeInfo[1];
        $handler(...array_values($routeInfo[2]));
        break;

    case FastRoute\Dispatcher::METHOD_NOT_ALLOWED:
    case FastRoute\Dispatcher::NOT_FOUND:
    default:
        jsonResponse(['error' => 'Not found.'], 404);
        break;
}