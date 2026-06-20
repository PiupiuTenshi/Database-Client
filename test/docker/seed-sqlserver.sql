-- Seed dữ liệu mẫu để thử SQL Server adapter (schema/table/view/FK/index).
IF DB_ID('app_db') IS NULL CREATE DATABASE app_db;
GO
USE app_db;
GO

CREATE TABLE dbo.users (
  id INT IDENTITY(1, 1) PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE,
  full_name NVARCHAR(255)
);
GO

CREATE TABLE dbo.orders (
  id INT IDENTITY(1, 1) PRIMARY KEY,
  user_id INT NOT NULL,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE
);
GO

CREATE INDEX orders_user_id_idx ON dbo.orders (user_id);
GO

CREATE VIEW dbo.user_order_counts AS
SELECT u.id, u.email, count(o.id) AS order_count
FROM dbo.users u
LEFT JOIN dbo.orders o ON o.user_id = u.id
GROUP BY u.id, u.email;
GO

INSERT INTO dbo.users (email, full_name) VALUES
  ('a@example.com', 'Alice'),
  ('b@example.com', 'Bob');
GO

INSERT INTO dbo.orders (user_id, total) VALUES
  (1, 19.99),
  (1, 5.00),
  (2, 100.00);
GO
