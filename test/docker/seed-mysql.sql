-- Seed dữ liệu mẫu để thử MySQL adapter (table/view/FK/index).
USE app_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX orders_user_id_idx ON orders (user_id);

CREATE VIEW user_order_counts AS
SELECT u.id, u.email, count(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.email;

INSERT INTO users (email, full_name) VALUES
  ('a@example.com', 'Alice'),
  ('b@example.com', 'Bob');

INSERT INTO orders (user_id, total) VALUES
  (1, 19.99),
  (1, 5.00),
  (2, 100.00);
