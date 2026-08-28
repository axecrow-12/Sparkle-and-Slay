<?php

function subscribeCreate(): void
{
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
    $rows = $db->query('SELECT email, created_at FROM subscribers ORDER BY created_at DESC')->fetchAll();
    jsonResponse($rows);
}
