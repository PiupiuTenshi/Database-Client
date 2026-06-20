-- Seed dữ liệu mẫu để thử PostgreSQL adapter (schema/table/view/FK/index).
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT
);

CREATE TABLE app.orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_id_idx ON app.orders (user_id);

CREATE VIEW app.user_order_counts AS
SELECT u.id, u.email, count(o.id) AS order_count
FROM app.users u
LEFT JOIN app.orders o ON o.user_id = u.id
GROUP BY u.id, u.email;

INSERT INTO app.users (email, full_name) VALUES
  ('a@example.com', 'Alice'),
  ('b@example.com', 'Bob');

INSERT INTO app.orders (user_id, total) VALUES
  (1, 19.99),
  (1, 5.00),
  (2, 100.00);
