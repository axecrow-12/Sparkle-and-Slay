<?php

require __DIR__ . '/src/env.php';
loadEnv(__DIR__ . '/.env');

require __DIR__ . '/src/db.php';

$db = getDb();
$migrationsDir = __DIR__ . '/migrations';
$db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
$applied = $db->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
$files = glob($migrationsDir . '/*.sql');
sort($files);

foreach ($files as $file) {
    $filename = basename($file);
    if (in_array($filename, $applied, true)) {
        echo 'Skipping migration: ' . $filename . PHP_EOL;
        continue;
    }
    echo 'Running migration: ' . $filename . PHP_EOL;
    $sql = file_get_contents($file);

    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        $db->exec($statement);
    }
    $record = $db->prepare('INSERT INTO schema_migrations (filename) VALUES (:filename)');
    $record->execute(['filename' => $filename]);
}

echo 'Migrations complete.' . PHP_EOL;
