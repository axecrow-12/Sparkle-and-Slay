<?php

function subscribeCreate(): void
{
    $rateKey = 'subscribe:' . getClientIp();
    rateLimitCheck($rateKey, 5, 3600); // 5 signups per hour per IP
    rateLimitRecordAttempt($rateKey);

    $body = getJsonBody();
    $email = trim($body['email'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Please enter a valid email address.'], 400);
    }

    $db = getDb();
    $stmt = $db->prepare(
        'INSERT INTO subscribers (email) VALUES (:email) ON DUPLICATE KEY UPDATE email = email'
    );

    try {
        $stmt->execute(['email' => strtolower($email)]);
        jsonResponse(['message' => 'Subscribed.'], 201);
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Could not save subscription. Please try again.'], 500);
    }
}

function subscribeList(): void
{
    requireAdmin();

    $db = getDb();
    [$page, $perPage, $offset] = paginationParams(50);

    $total = (int) $db->query('SELECT COUNT(*) FROM subscribers')->fetchColumn();

    $stmt = $db->prepare('SELECT email, created_at FROM subscribers ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    jsonResponse(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'perPage' => $perPage]);
}
