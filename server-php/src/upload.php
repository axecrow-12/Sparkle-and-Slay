<?php

function uploadMedia(): void
{
    requireAdmin();
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'A valid media file is required.'], 400);
    }
    $file = $_FILES['file'];
    $maxBytes = 20 * 1024 * 1024;
    if ($file['size'] > $maxBytes) {
        jsonResponse(['error' => 'Media files must be 20 MB or smaller.'], 400);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
        'video/mp4' => 'mp4', 'video/webm' => 'webm',
    ];
    if (!isset($types[$mime])) {
        jsonResponse(['error' => 'Only JPG, PNG, WEBP, MP4, and WEBM files are allowed.'], 400);
    }
    $directory = __DIR__ . '/../public/uploads';
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        jsonResponse(['error' => 'Upload storage is not available.'], 500);
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $types[$mime];
    if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
        jsonResponse(['error' => 'Could not save uploaded media.'], 500);
    }
    jsonResponse(['path' => '/uploads/' . $filename], 201);
}