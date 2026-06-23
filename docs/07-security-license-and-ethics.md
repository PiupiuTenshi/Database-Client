# 07 — Security, License and Ethics

## 1. Nguyên tắc quan trọng

Dự án này phải là extension mới, không phải bản crack của extension khác.

Không được:

- Reverse engineering extension trả phí để gỡ giới hạn.
- Copy source code proprietary.
- Copy icon, logo, asset, tên thương mại.
- Copy telemetry endpoint hoặc license logic.
- Patch file `.vsix` của extension khác.
- Hướng dẫn bypass subscription/free trial.

Được phép:

- Học cách VS Code extension hoạt động từ tài liệu chính thức.
- Xây UI và chức năng tương tự bằng code của mình.
- Dùng thư viện open-source đúng license.
- Thiết kế sản phẩm “không giới hạn connection” nếu chính extension của mình không áp đặt giới hạn đó.

### Trạng thái triển khai (v1.1.0)

- ✅ Connection password dùng VS Code SecretStorage; profile không lưu password.
- ✅ Log service dùng masking; webview dùng CSP + nonce và không nhận connection secret.
- ✅ `LICENSE`, `SECURITY.md` và `THIRD_PARTY_NOTICES.md` đã có trong release `v1.0.0`.
- 🟡 Connection production hiện icon cảnh báo; production guard đầy đủ (confirm write, type tên DB, policy disable write/export) là phase `v1.2.0+`.

## 2. Threat Model

Extension database client rất nhạy cảm vì có thể chạm vào:

- Password database.
- SSH key.
- Production database.
- Query history có dữ liệu thật.
- Export file chứa PII.
- Connection string cloud.
- Schema nội bộ công ty.

## 3. Secret Storage

Password/token phải lưu bằng VS Code SecretStorage, không lưu plaintext trong settings JSON.

Sai:

```json
{
  "password": "RootPassword_123!"
}
```

Đúng:

```ts
await context.secrets.store(secretKey, password);
const password = await context.secrets.get(secretKey);
```

Connection profile chỉ lưu metadata không nhạy cảm:

```json
{
  "id": "local-postgres",
  "name": "Local PostgreSQL",
  "host": "localhost",
  "port": 5432,
  "username": "postgres",
  "database": "app_db"
}
```

## 4. Log Masking

Không log:

- Password.
- Token.
- Full connection string có password.
- SSH private key.
- Query result nhạy cảm.

Mask function:

```ts
function maskSecret(value: string) {
  if (!value) return value;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
```

## 5. Query Safety

Extension không nên chặn hoàn toàn SQL nguy hiểm vì đây là database client. Nhưng nên cảnh báo.

Cảnh báo cho:

- `DROP DATABASE`
- `DROP TABLE`
- `TRUNCATE`
- `DELETE` không `WHERE`
- `UPDATE` không `WHERE`
- Query chạy trên connection có tag `production`

Connection profile có thể có flag:

```ts
environment: "local" | "dev" | "staging" | "production";
```

Nếu là production:

```txt
Require confirmation before write query.
```

## 6. Webview Security

Webview không được giữ secret.

Nguyên tắc:

- Webview chỉ render UI.
- Extension host giữ connection/session.
- Webview gửi action.
- Extension host validate action.
- Dùng Content Security Policy.
- Không `eval`.
- Không inline script nếu không có nonce.
- Không load CDN tùy tiện.

## 7. Dependency Security

Vì extension chạy trong máy developer, dependency độc hại rất nguy hiểm.

Cần:

```bash
npm audit
npm outdated
npm ls
```

Quy trình:

- Ưu tiên package phổ biến, license rõ.
- Pin version quan trọng.
- Dùng lockfile.
- Không thêm package lạ chỉ để làm việc nhỏ.
- Review package có postinstall script.
- Tách webview bundle để kiểm soát dependency.

## 8. License Check

Trước khi dùng package, kiểm tra:

- MIT
- Apache-2.0
- BSD
- ISC

Cẩn thận với:

- GPL/AGPL nếu không muốn bị ràng buộc mở source toàn bộ theo điều kiện license.
- Package không có license.
- Package deprecated.

Tạo file:

```txt
THIRD_PARTY_NOTICES.md
```

Ghi:

```md
# Third-party Notices

## mysql2

License: MIT
Usage: MySQL/MariaDB adapter

## pg

License: MIT
Usage: PostgreSQL adapter
```

## 9. Telemetry

MVP nên mặc định không telemetry.

Nếu sau này có telemetry:

- Opt-in hoặc tôn trọng setting VS Code telemetry.
- Không gửi SQL.
- Không gửi schema/table name.
- Không gửi hostname/database name.
- Chỉ gửi event tổng quát như feature usage.
- Có setting tắt telemetry.

## 10. Data Privacy

Không upload:

- Query text.
- Query result.
- Schema.
- Connection config.
- Error detail có thể chứa hostname/user.

Nếu cần AI feature sau này, phải hỏi user rõ trước khi gửi dữ liệu ra ngoài.

## 11. Production Guard

Connection có thể set:

```ts
type Environment = "local" | "dev" | "staging" | "production";
```

Production guard:

- Badge đỏ ở status bar.
- Confirm khi chạy write query.
- Require typing database name để drop/truncate.
- Disable edit row mặc định.
- Disable export mặc định nếu user bật policy.

## 12. Permission Model nội bộ

Extension local không có RBAC thật, nhưng có thể có policy:

```json
{
  "openDbNexus.policy.disableWriteOnProduction": true,
  "openDbNexus.policy.disableExportOnProduction": false,
  "openDbNexus.policy.maxRows": 10000
}
```

## 13. Ethical Positioning trong README

Nên ghi rõ:

```md
Open DB Nexus is an original open-source database client extension for VS Code.
It is not affiliated with, derived from, or intended to bypass licensing of any existing database client extension.
```

## 14. Checklist trước khi release

- [ ] Không lưu password plaintext.
- [ ] Không log secret.
- [ ] Không dùng asset của extension khác.
- [ ] Có LICENSE.
- [ ] Có THIRD_PARTY_NOTICES.md.
- [ ] Có SECURITY.md.
- [ ] Có setting tắt telemetry nếu có telemetry.
- [ ] Có warning query nguy hiểm.
- [ ] Có test cho secret storage.
- [ ] Có audit dependency.
- [ ] Có review CSP webview.
