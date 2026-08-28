<?php

require __DIR__ . '/src/env.php';
loadEnv(__DIR__ . '/.env');

require __DIR__ . '/src/db.php';

$db = getDb();
$migrationsDir = __DIR__ . '/migrations';
$files = glob($migrationsDir . '/*.sql');
sort($files);

foreach ($files as $file) {
    echo 'Running migration: ' . basename($file) . PHP_EOL;
    $sql = file_get_contents($file);

    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        $db->exec($statement);
    }
}

echo 'Migrations complete.' . PHP_EOL;
