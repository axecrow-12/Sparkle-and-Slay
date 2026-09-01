CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rate_key VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rate_key_created (rate_key, created_at)
) ENGINE=InnoDB;
