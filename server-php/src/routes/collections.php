<?php

function collectionsList(): void
{
    if (!isset($_GET['search'])) {
        header('Cache-Control: public,max-age=60');
    }
    $db = getDb();

    // Archived (soft-deleted) products are hidden unless ?includeArchived=1,
    // which the admin panel uses to show and restore them.
    $includeArchived = isset($_GET['includeArchived']);
    $conditions = $includeArchived ? [] : ['deleted_at IS NULL'];
    $params = [];

    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $conditions[] = '(name LIKE :search OR description LIKE :search)';
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
        $params['search'] = '%' . $escaped . '%';
    }
    $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';

    $columns = 'id, name, description, image, video, price, stock_status, colors, sizes, rating_average, rating_count'
        . ($includeArchived ? ', deleted_at' : '');

    if (!isset($_GET['page'])) {
        $stmt = $db->prepare(
            "SELECT $columns FROM collections$where ORDER BY created_at DESC"
        );
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }

    [$page, $perPage, $offset] = paginationParams(24);

    $totalStmt = $db->prepare("SELECT COUNT(*) FROM collections$where");
    $totalStmt->execute($params);
    $total = (int) $totalStmt->fetchColumn();

    $stmt = $db->prepare(
        "SELECT $columns FROM collections$where ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    jsonResponse(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'perPage' => $perPage]);
}

function collectionsGetOne(string $id): void
{
    $db = getDb();
    $stmt = $db->prepare('SELECT * FROM collections WHERE id = :id AND deleted_at IS NULL');
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
    $colors = trim($body['colors'] ?? '');
    $sizes = trim($body['sizes'] ?? '');
    $ratingAverage = normalizeRatingAverage($body['rating_average'] ?? null);
    $ratingCount = max(0, (int) ($body['rating_count'] ?? 0));

    if ($name === '' || $description === '') {
        jsonResponse(['error' => 'Name and description are required.'], 400);
    }

    $db = getDb();
    $stmt = $db->prepare(
        'INSERT INTO collections (name, description, image, video, price, stock_status, colors, sizes, rating_average, rating_count)
         VALUES (:name, :description, :image, :video, :price, :stock_status, :colors, :sizes, :rating_average, :rating_count)'
    );
    $stmt->execute([
        'name' => $name,
        'description' => $description,
        'image' => $image,
        'video' => $video,
        'price' => $price,
        'stock_status' => $stockStatus ?: 'in_stock',
        'colors' => $colors,
        'sizes' => $sizes,
        'rating_average' => $ratingAverage,
        'rating_count' => $ratingCount,
    ]);

    $id = $db->lastInsertId();
    collectionsGetOne($id);
}

function collectionsUpdate(string $id): void
{
    requireAdmin();
    $body = getJsonBody();

    $db = getDb();
    $existingStmt = $db->prepare('SELECT * FROM collections WHERE id = :id AND deleted_at IS NULL');
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
    $colors = array_key_exists('colors', $body) ? trim((string) $body['colors']) : $existing['colors'];
    $sizes = array_key_exists('sizes', $body) ? trim((string) $body['sizes']) : $existing['sizes'];
    $ratingAverage = array_key_exists('rating_average', $body)
        ? normalizeRatingAverage($body['rating_average'])
        : $existing['rating_average'];
    $ratingCount = array_key_exists('rating_count', $body)
        ? max(0, (int) $body['rating_count'])
        : $existing['rating_count'];

    $stmt = $db->prepare(
        'UPDATE collections
         SET name = :name, description = :description, image = :image,
             video = :video, price = :price, stock_status = :stock_status,
             colors = :colors, sizes = :sizes, rating_average = :rating_average, rating_count = :rating_count
         WHERE id = :id'
    );
    $stmt->execute([
        'name' => $name,
        'description' => $description,
        'image' => $image,
        'video' => $video,
        'price' => $price,
        'stock_status' => $stockStatus,
        'colors' => $colors,
        'sizes' => $sizes,
        'rating_average' => $ratingAverage,
        'rating_count' => $ratingCount,
        'id' => $id,
    ]);

    collectionsGetOne($id);
}

function collectionsDelete(string $id): void
{
    requireAdmin();

    // Soft delete: the row stays in the database (so past orders keep their
    // reference and it can be restored) but drops out of every read path.
    $db = getDb();
    $stmt = $db->prepare('UPDATE collections SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL');
    $stmt->execute(['id' => $id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Collection not found.'], 404);
    }

    http_response_code(204);
    exit;
}

function collectionsRestore(string $id): void
{
    requireAdmin();

    $db = getDb();
    $stmt = $db->prepare('UPDATE collections SET deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL');
    $stmt->execute(['id' => $id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Archived collection not found.'], 404);
    }

    collectionsGetOne($id);
}
