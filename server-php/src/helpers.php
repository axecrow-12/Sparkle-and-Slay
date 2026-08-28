<?php

function jsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Reads the Bearer token from the Authorization header, verifies it,
 * and returns the decoded payload. Ends the request with 401 if
 * the token is missing or invalid.
 */
function requireAdmin(): array
{
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        jsonResponse(['error' => 'Missing admin token.'], 401);
    }

    $token = substr($authHeader, 7);
    $payload = jwtVerify($token);

    if ($payload === null) {
        jsonResponse(['error' => 'Invalid or expired token.'], 401);
    }

    return $payload;
}
