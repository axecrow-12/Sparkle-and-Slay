<?php

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string
{
    $padded = str_pad($data, strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + (4 - strlen($data) % 4), '=');
    return base64_decode(strtr($padded, '-_', '+/'));
}

function jwtSign(array $payload): string
{
    $secret = getenv('JWT_SECRET');
    $ttl = (int) (getenv('JWT_TTL_SECONDS') ?: 43200);

    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload['iat'] = time();
    $payload['exp'] = time() + $ttl;

    $segments = [
        base64UrlEncode(json_encode($header)),
        base64UrlEncode(json_encode($payload)),
    ];

    $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
    $segments[] = base64UrlEncode($signature);

    return implode('.', $segments);
}

/**
 * Returns the decoded payload array on success, or null if the token
 * is malformed, has a bad signature, or has expired.
 */
function jwtVerify(string $token): ?array
{
    $secret = getenv('JWT_SECRET');
    $parts = explode('.', $token);

    if (count($parts) !== 3) {
        return null;
    }

    [$headerB64, $payloadB64, $signatureB64] = $parts;

    $expectedSignature = hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true);
    $actualSignature = base64UrlDecode($signatureB64);

    if (!hash_equals($expectedSignature, $actualSignature)) {
        return null;
    }

    $payload = json_decode(base64UrlDecode($payloadB64), true);

    if (!is_array($payload) || !isset($payload['exp']) || time() > $payload['exp']) {
        return null;
    }

    return $payload;
}
