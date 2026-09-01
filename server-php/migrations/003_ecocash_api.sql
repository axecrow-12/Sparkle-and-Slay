ALTER TABLE payments
  ADD COLUMN provider VARCHAR(40) NULL AFTER method,
  ADD COLUMN client_correlation VARCHAR(120) NULL AFTER reference,
  ADD COLUMN provider_reference VARCHAR(120) NULL AFTER client_correlation,
  ADD COLUMN provider_status VARCHAR(80) NULL AFTER status,
  ADD COLUMN provider_response JSON NULL AFTER provider_status,
  ADD COLUMN checkout_token_hash CHAR(64) NULL,
  ADD COLUMN idempotency_key VARCHAR(120) NULL,
  ADD COLUMN completed_at DATETIME NULL,
  ADD UNIQUE KEY uq_payment_client_correlation (client_correlation),
  ADD UNIQUE KEY uq_payment_idempotency (idempotency_key),
  ADD UNIQUE KEY uq_payment_checkout_token (checkout_token_hash);