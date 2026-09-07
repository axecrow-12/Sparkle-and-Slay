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
 * Reads page and perPage from the query string, clamped to sane bounds
 * so nobody can request perPage=999999 and defeat the point of paging.
 */
function paginationParams(int $defaultPerPage = 20, int $maxPerPage = 100): array
{
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = (int) ($_GET['perPage'] ?? $defaultPerPage);
    $perPage = max(1, min($maxPerPage, $perPage));
    $offset = ($page - 1) * $perPage;

    return [$page, $perPage, $offset];
}

/**
 * Clamps an admin-provided average rating to the valid 0-5 range, or
 * returns null when absent/invalid so it is stored as "no rating yet".
 */
function normalizeRatingAverage($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        return null;
    }

    return round(max(0, min(5, (float) $value)), 1);
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
