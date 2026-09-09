<?php

use Dotenv\Dotenv;

function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    // Unsafe = also populates getenv()/putenv() (all callers use getenv()).
    // Immutable = never overwrites variables already set in the real environment.
    $dotenv = Dotenv::createUnsafeImmutable(dirname($path), basename($path));
    $dotenv->safeLoad();
}