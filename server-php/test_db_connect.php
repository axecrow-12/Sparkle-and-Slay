<?php
require __DIR__ . '/src/env.php';
loadEnv(__DIR__ . '/.env');
require __DIR__ . '/src/db.php';

echo "Connecting..." . PHP_EOL;
$start = microtime(true);

try {
    $db = getDb();
    $elapsed = round(microtime(true) - $start, 3);
    echo "Connected in {$elapsed}s" . PHP_EOL;
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . PHP_EOL;
}