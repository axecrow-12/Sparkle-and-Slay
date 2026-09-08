<?php

use Dotenv\Dotenv;

/**
 * Kept this function name and signature exactly the same as before, so
 * every existing call site (public/index.php, migrate.php, test
 * scripts) needs zero changes. Internally it now uses phpdotenv instead
 * of the hand-rolled parser, which handles quoted values, comments, and
 * multi-line values correctly, edge cases the old version silently got
 * wrong rather than erroring on.
 */
function loadEnv(string $path): void
{
    $dir = dirname($path);
    $file = basename($path);

    if (!file_exists($path)) {
        return; // matches the old behavior, missing .env does not crash
    }

    $dotenv = Dotenv::createImmutable($dir, $file);
    $dotenv->load();
}