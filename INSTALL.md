# Cài đặt & chạy Open DB Nexus trong VS Code

Ba cách dùng extension: **tải `.vsix` từ GitHub Releases** (dễ nhất), **chạy từ source (F5)** để phát triển, hoặc **tự đóng gói `.vsix`** từ source.

## Yêu cầu

- VS Code ≥ 1.90
- Node.js 20+ và npm (chỉ cần nếu chạy từ source / tự đóng gói)
- GitHub CLI `gh` (chỉ cần nếu muốn push/tag/release trên GitHub)
- (Tùy chọn) Docker — để chạy DB test local trong `test/docker/`

---

## Cách 1 — Cài từ GitHub Releases (khuyến nghị cho người dùng)

1. Vào trang **Releases**: <https://github.com/PiupiuTenshi/Database-Client/releases/latest>
2. Tải file `open-db-nexus-<version>.vsix` ở mục **Assets**.
3. Cài bằng dòng lệnh nếu muốn:

   ```powershell
   code --install-extension .\open-db-nexus-<version>.vsix
   ```

   Nếu terminal đang đứng ở thư mục cha chứa `vscode-db-client/`, dùng:

   ```powershell
   code --install-extension .\vscode-db-client\open-db-nexus-<version>.vsix
   ```

   Hoặc trong VS Code UI: tab **Extensions** (`Ctrl+Shift+X`) → menu `...` góc trên phải → **Install from VSIX...** → chọn file.
4. **Reload Window** (`Ctrl+Shift+P` → *Developer: Reload Window*) nếu được nhắc.
5. Mở **Open DB Nexus** ở Activity Bar (icon 🛢️) để bắt đầu.

---

## Cách 2 — Chạy từ source (Extension Development Host)

Dùng khi bạn muốn sửa code và thử ngay.

```bash
cd vscode-db-client
npm install
```

> **Native module:** `better-sqlite3` là native. Nếu mở extension gặp lỗi
> `NODE_MODULE_VERSION mismatch`, rebuild cho Electron của VS Code:
>
> ```bash
> npx @electron/rebuild -f -w better-sqlite3
> ```

Rồi:

1. Mở thư mục `vscode-db-client/` trong VS Code.
2. Nhấn **F5** → một cửa sổ **Extension Development Host** mở ra với extension đã nạp.
3. Mở **Open DB Nexus** ở Activity Bar để bắt đầu.

Mỗi lần sửa code, bấm **Ctrl+R** trong cửa sổ Dev Host để nạp lại (hoặc dừng/F5 lại).

---

## Cách 3 — Tự đóng gói `.vsix` từ source

```bash
cd vscode-db-client
npm run package:vsix
# -> tạo open-db-nexus-<version>.vsix (đọc version từ package.json)
```

Rồi cài như Cách 1, bước 3.

> **Lưu ý native module với `.vsix`:** prebuilt `better-sqlite3` trong gói là cho
> Node chuẩn. Nếu SQLite báo lỗi ABI khi chạy trong VS Code, rebuild rồi đóng gói lại:
>
> ```bash
> npx @electron/rebuild -f -w better-sqlite3
> npm run package:vsix
> ```

---

## Cập nhật lên bản mới bằng giao diện

Từ bản mới, Open DB Nexus có luồng update ngay trong VS Code, không cần tự gõ PowerShell cho mỗi lần cập nhật.

### Cách khuyến nghị

1. Mở view **Open DB Nexus** ở Activity Bar.
2. Bấm nút **Check for Updates** (icon cloud download) trên title của view **Connections**.
3. Nếu có bản mới trên GitHub Releases, chọn **Install Update**.
4. Extension sẽ tải file `.vsix`, mở luồng cài đặt của VS Code, rồi hỏi **Reload Window**.

Bạn cũng có thể mở Command Palette (`Ctrl+Shift+P`) và chạy:

```txt
Open DB Nexus: Check for Updates
```

### Tự kiểm tra khi mở VS Code

Mặc định extension tự kiểm tra GitHub Releases mỗi 24 giờ khi VS Code khởi động. Có thể chỉnh trong Settings:

- `openDbNexus.updates.autoCheckOnStartup`: bật/tắt tự check update.
- `openDbNexus.updates.checkIntervalHours`: số giờ tối thiểu giữa hai lần tự check.

Connection profile và mật khẩu **được giữ nguyên** khi update (metadata lưu ở `globalState`, mật khẩu lưu ở VS Code `SecretStorage`).

### Cài đè thủ công nếu cần

Nếu update tự động bị chặn bởi mạng/proxy hoặc chính sách VS Code, tải file `.vsix` bản mới từ [Releases](https://github.com/PiupiuTenshi/Database-Client/releases/latest), rồi cài bằng UI:

**Extensions** → menu `...` → **Install from VSIX...** → chọn file mới.

Hoặc cài bằng CLI:

   ```powershell
   code --install-extension .\open-db-nexus-<version>.vsix
   ```

   - VS Code tự thay phiên bản cũ bằng phiên bản trong file `.vsix`.
   - Nếu cài lại **cùng version** (hoặc version thấp hơn) và bị từ chối, thêm `--force`:

     ```powershell
     code --install-extension .\open-db-nexus-<version>.vsix --force
     ```

Kiểm tra version đang chạy:

   ```powershell
   code --list-extensions --show-versions | Select-String open-db-nexus
   # ví dụ: piupiutenshi.open-db-nexus@1.13.1
   ```

   Hoặc xem ở tab Extensions, mục **Open DB Nexus** sẽ hiển thị số phiên bản.

> Không cần gỡ bản cũ trước khi update; cài đè là đủ. Nếu muốn cài sạch hoàn toàn,
> gỡ rồi cài lại (xem mục dưới) — nhưng profile/secret vẫn được giữ vì lưu theo
> publisher id `piupiutenshi.open-db-nexus`.

## GitHub CLI cho commit/push/release

Nếu máy chưa có `gh`, cài nhanh trên Windows:

```powershell
winget install --id GitHub.cli
gh auth login
gh auth status
```

Quy trình phase/release đầy đủ nằm trong `docs/11-phases-github-versioning.md`.

### Gỡ cài đặt

```bash
code --uninstall-extension piupiutenshi.open-db-nexus
```

---

## Kiểm tra nhanh sau khi cài

1. Mở **Open DB Nexus** ở Activity Bar.
2. **＋ Add Connection** → chọn SQLite, File Path trỏ tới một file `.sqlite` (hoặc `:memory:`).
3. **Test Connection** → thấy "Connected".
4. Mở rộng connection để xem Tables/Columns; chuột phải bảng → **Open Table (Data & Properties)**.

### Nếu mở rộng database bị `Loading...` lâu

Tree schema có timeout qua setting `openDbNexus.metadata.loadTimeoutSeconds` (mặc định 15 giây). Nếu DB ở xa, cold start hoặc có metadata lớn, tăng lên 30-60 giây trong Settings. Nếu vẫn timeout, kiểm tra host/port, VPN/proxy, container Docker, quyền đọc schema/catalog và thử **Test Connection** trước khi mở tree.

> Hướng dẫn dùng chi tiết nằm trong `docs/13-usage-guide.md` của source (không kèm trong gói `.vsix`).
