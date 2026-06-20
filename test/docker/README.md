# Local test databases

Các DB này chỉ dùng để **thử adapter thủ công** trong Extension Development Host.
CI không cần chúng — adapter test mock driver.

## PostgreSQL

```bash
docker compose -f test/docker/docker-compose.postgres.yml up -d   # khởi động
docker compose -f test/docker/docker-compose.postgres.yml down -v # xóa sạch
```

Tạo connection trong extension với:

| Field    | Value      |
| -------- | ---------- |
| Database | PostgreSQL |
| Host     | localhost  |
| Port     | 5432       |
| Username | postgres   |
| Password | postgres   |
| Database | app_db     |

Seed (`seed.sql`) tạo schema `app` với `users`, `orders` (có FK + index) và view
`user_order_counts` để kiểm tra schema explorer và dependency graph.

## MySQL

```bash
docker compose -f test/docker/docker-compose.mysql.yml up -d   # khởi động
docker compose -f test/docker/docker-compose.mysql.yml down -v # xóa sạch
```

Tạo connection trong extension với:

| Field    | Value     |
| -------- | --------- |
| Database | MySQL     |
| Host     | localhost |
| Port     | 3306      |
| Username | root      |
| Password | mysql     |
| Database | app_db    |

Seed (`seed-mysql.sql`) tạo `users`, `orders` (FK + index) và view `user_order_counts`.

## SQL Server

```bash
docker compose -f test/docker/docker-compose.sqlserver.yml up -d   # khởi động
# Sau khi healthy, nạp seed:
docker exec -i open-db-nexus-mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Strong!Passw0rd' -C -No < test/docker/seed-sqlserver.sql
docker compose -f test/docker/docker-compose.sqlserver.yml down -v # xóa sạch
```

Tạo connection trong extension với:

| Field    | Value           |
| -------- | --------------- |
| Database | SQL Server      |
| Host     | localhost       |
| Port     | 1433            |
| Username | sa              |
| Password | Strong!Passw0rd |
| Database | app_db          |

Adapter mặc định bật `trustServerCertificate` để chấp nhận cert tự ký của Docker.
