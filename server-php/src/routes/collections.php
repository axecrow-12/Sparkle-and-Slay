<?php

function collectionsList(): void
{
    $db = getDb();
    $rows = $db->query(
        'SELECT id, name, description, image, video, price, stock_status FROM collections ORDER BY created_at DESC'
    )->fetchAll();

    jsonResponse($rows);
}

function collectionsGetOne(string $id): void
{
    $db = getDb();
    $stmt = $db->prepare('SELECT * FROM collections WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(['error' => 'Collection not found.'], 404);
    }

    jsonResponse($row);
}

function collectionsCreate(): void
{
    requireAdmin();
    $body = getJsonBody();

    $name = trim($body['name'] ?? '');
    $description = trim($body['description'] ?? '');
    $image = trim($body['image'] ?? '');
    $video = trim($body['video'] ?? '');
    $price = $body['price'] ?? null;
    $stockStatus = $body['stock_status'] ?? 'in_stock';

    if ($name === '' || $description === '') {
        jsonResponse(['error' => 'Name and description are required.'], 400);
    }

    $db = getDb();
    $stmt = $db->prepare(
        'INSERT INTO collections (name, description, image, video, price, stock_status)
         VALUES (:name, :description, :image, :video, :price, :stock_status)'
    );
    $stmt->execute([
        'name' => $name,
        'description' => $description,
        'image' => $image,
        'video' => $video,
        'price' => $price,
        'stock_status' => $stockStatus ?: 'in_stock',
    ]);

    $id = $db->lastInsertId();
    collectionsGetOne($id);
}

function collectionsUpdate(string $id): void
{
    requireAdmin();
    $body = getJsonBody();

    $db = getDb();
    $existingStmt = $db->prepare('SELECT * FROM collections WHERE id = :id');
    $existingStmt->execute(['id' => $id]);
    $existing = $existingStmt->fetch();

    if (!$existing) {
        jsonResponse(['error' => 'Collection not found.'], 404);
    }

    $name = $body['name'] ?? $existing['name'];
    $description = $body['description'] ?? $existing['description'];
    $image = $body['image'] ?? $existing['image'];
    $video = $body['video'] ?? $existing['video'];
    $price = array_key_exists('price', $body) ? $body['price'] : $existing['price'];
    $stockStatus = $body['stock_status'] ?? $existing['stock_status'];

    $stmt = $db->prepare(
        'UPDATE collections
         SET name = :name, description = :description, image = :image,
             video = :video, price = :price, stock_status = :stock_status
         WHERE id = :id'
    );
    $stmt->execute([
        'name' => $name,
        'description' => $description,
        'image' => $image,
        'video' => $video,
        'price' => $price,
        'stock_status' => $stockStatus,
        'id' => $id,
    ]);

    collectionsGetOne($id);
}

function collectionsDelete(string $id): void
{
    requireAdmin();

    $db = getDb();
    $stmt = $db->prepare('DELETE FROM collections WHERE id = :id');
    $stmt->execute(['id' => $id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Collection not found.'], 404);
    }

    http_response_code(204);
    exit;
}
