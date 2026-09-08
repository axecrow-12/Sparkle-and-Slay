<?php

use Dotenv\Dotenv;

function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    $dotenv = Dotenv::createImmutable(dirname($path), basename($path));
    $values = $dotenv->load();

    foreach ($values as $key => $value) {
        putenv("$key=$value");
    }
}