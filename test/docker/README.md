# Local test databases

Các DB này chỉ dùng để **thử adapter thủ công** trong Extension Development Host.
CI không cần chúng — adapter test mock driver.

## All-in-one adapter lab

Start all container-backed databases:

```bash
docker compose -f test/docker/docker-compose.all.yml up -d
```

Stop and clean volumes:

```bash
docker compose -f test/docker/docker-compose.all.yml down -v
```

SQL Server needs a manual seed after the container is healthy:

```bash
docker exec -i open-db-nexus-mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Strong!Passw0rd' -C -No < test/docker/seed-sqlserver.sql
```

Connection matrix:

| Adapter | Host / file | Port | Username | Password | Database |
| ------- | ----------- | ---- | -------- | -------- | -------- |
| PostgreSQL | localhost | 5432 | postgres | postgres | app_db |
| MySQL | localhost | 3306 | root | mysql | app_db |
| MariaDB | localhost | 3307 | root | mariadb | app_db |
| SQL Server | localhost | 1433 | sa | Strong!Passw0rd | app_db |
| MongoDB | localhost | 27017 | root | mongo | app_db |
| Redis | localhost | 6379 | | | |
| SQLite | local `.sqlite` file | | | | |
| DuckDB | local `.duckdb` file | | | | |

Notes:

- Oracle is not included in the all-in-one lab because the official container image is large and usually requires Oracle registry/license setup.
- Cloud/HTTP-compatible adapters need real service endpoints, so they are not started by this local Docker lab.
- If a tree stays on loading, first check container health with `docker ps`, then run **Test Connection** from the connection context menu.

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

## Redis

```bash
docker compose -f test/docker/docker-compose.redis.yml up -d   # khởi động
docker compose -f test/docker/docker-compose.redis.yml down -v # xóa sạch
```

Tạo connection với Database = **Redis**, Host `localhost`, Port `6379`.
Redis là key-value: dùng **Query Editor** để chạy lệnh (vd `SET foo bar`, `GET foo`,
`KEYS *`); cây sẽ liệt kê keys dưới mục "Tables". Các tính năng SQL (table viewer
phân trang, dependency graph) không áp dụng cho Redis.
