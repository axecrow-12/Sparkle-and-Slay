<?php

function authStatus(): void
{
    $db = getDb();
    $count = $db->query('SELECT id FROM admin_users LIMIT 1')->fetch();
    jsonResponse(['hasPassword' => $count !== false]);
}

function authSetup(): void
{
    $body = getJsonBody();
    $password = $body['password'] ?? '';

    if (strlen($password) < 8) {
        jsonResponse(['error' => 'Password must be at least 8 characters.'], 400);
    }

    $db = getDb();
    $existing = $db->query('SELECT id FROM admin_users LIMIT 1')->fetch();

    if ($existing !== false) {
        jsonResponse(['error' => 'Admin password already set. Use login instead.'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $db->prepare('INSERT INTO admin_users (password_hash) VALUES (:hash)');
    $stmt->execute(['hash' => $hash]);

    $token = jwtSign(['role' => 'admin']);
    jsonResponse(['token' => $token], 201);
}

function authLogin(): void
{
    $body = getJsonBody();
    $password = $body['password'] ?? '';

    if ($password === '') {
        jsonResponse(['error' => 'Password is required.'], 400);
    }

    $db = getDb();
    $row = $db->query('SELECT password_hash FROM admin_users ORDER BY id LIMIT 1')->fetch();

    if ($row === false) {
        jsonResponse(['error' => 'No admin password set yet.'], 404);
    }

    if (!password_verify($password, $row['password_hash'])) {
        jsonResponse(['error' => 'Invalid password.'], 401);
    }

    $token = jwtSign(['role' => 'admin']);
    jsonResponse(['token' => $token]);
}

function authChangePassword(): void
{
    requireAdmin();
    $body = getJsonBody();
    $current = (string) ($body['currentPassword'] ?? '');
    $next = (string) ($body['newPassword'] ?? '');
    if (strlen($next) < 8) {
        jsonResponse(['error' => 'New password must be at least 8 characters.'], 400);
    }
    $db = getDb();
    $row = $db->query('SELECT id, password_hash FROM admin_users ORDER BY id LIMIT 1')->fetch();
    if (!$row || !password_verify($current, $row['password_hash'])) {
        jsonResponse(['error' => 'Current password is incorrect.'], 401);
    }
    $stmt = $db->prepare('UPDATE admin_users SET password_hash = :hash WHERE id = :id');
    $stmt->execute(['hash' => password_hash($next, PASSWORD_BCRYPT, ['cost' => 12]), 'id' => $row['id']]);
    jsonResponse(['token' => jwtSign(['role' => 'admin'])]);
}
