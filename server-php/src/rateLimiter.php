<?php

/**
 * Returns the connecting client's IP address.
 *
 * REMOTE_ADDR is set by PHP's built-in server or Apache based on the actual
 * TCP connection, so it cannot be spoofed by a request header. If this app
 * ever sits behind a reverse proxy or load balancer, this needs to read a
 * trusted forwarded header set by that proxy instead. Never trust an
 * X-Forwarded-For header coming straight from the client, it is trivially
 * faked and would let an attacker reset their own rate limit at will.
 */
function getClientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Ends the request with 429 if too many attempts have been recorded for
 * this key within the given time window. Call this before doing any real
 * work, so a locked out caller never even reaches password checking.
 */
function rateLimitCheck(string $key, int $maxAttempts, int $windowSeconds): void
{
    $window = (int) $windowSeconds; // always developer supplied, safe to interpolate

    $db = getDb();
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS attempts FROM rate_limit_attempts
         WHERE rate_key = :key AND created_at > (NOW() - INTERVAL $window SECOND)"
    );
    $stmt->execute(['key' => $key]);
    $attempts = (int) ($stmt->fetch()['attempts'] ?? 0);

    if ($attempts >= $maxAttempts) {
        jsonResponse(['error' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
    }
}

/** Records one failed attempt for this key. */
function rateLimitRecordAttempt(string $key): void
{
    $stmt = getDb()->prepare('INSERT INTO rate_limit_attempts (rate_key) VALUES (:key)');
    $stmt->execute(['key' => $key]);
}

/** Wipes the failure history for this key, call this after a success. */
function rateLimitClear(string $key): void
{
    $stmt = getDb()->prepare('DELETE FROM rate_limit_attempts WHERE rate_key = :key');
    $stmt->execute(['key' => $key]);
}
