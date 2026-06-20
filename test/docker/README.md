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
