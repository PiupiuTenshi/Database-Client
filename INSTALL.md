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
3. Cài bằng dòng lệnh:

   ```powershell
   code --install-extension .\open-db-nexus-1.7.1.vsix
   ```

   Nếu terminal đang đứng ở thư mục cha chứa `vscode-db-client/`, dùng:

   ```powershell
   code --install-extension .\vscode-db-client\open-db-nexus-1.7.1.vsix
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

## Cập nhật lên bản mới (đã cài trước đó)

Extension này **chưa lên Marketplace** nên VS Code **không tự cập nhật**. Khi có bản mới, cài đè là xong — connection profile và mật khẩu **được giữ nguyên** (lưu ở `globalState` + `SecretStorage`, không bị mất khi update).

1. Tải file `.vsix` **bản mới** từ [Releases](https://github.com/PiupiuTenshi/Database-Client/releases/latest) (hoặc tự đóng gói lại bằng Cách 3 sau khi `git pull`).
2. Cài đè bản cũ:

   ```powershell
   code --install-extension .\open-db-nexus-1.7.1.vsix
   ```

   - VS Code tự thay phiên bản cũ bằng phiên bản trong file `.vsix`.
   - Nếu cài lại **cùng version** (hoặc version thấp hơn) và bị từ chối, thêm `--force`:

     ```powershell
     code --install-extension .\open-db-nexus-1.7.1.vsix --force
     ```

   - Hoặc dùng UI: **Extensions** → `...` → **Install from VSIX...** → chọn file mới.
3. **Reload Window** (`Ctrl+Shift+P` → *Developer: Reload Window*) hoặc khởi động lại VS Code để bản mới có hiệu lực.
4. Kiểm tra version đang chạy:

   ```powershell
   code --list-extensions --show-versions | Select-String open-db-nexus
   # ví dụ: piupiutenshi.open-db-nexus@1.7.1
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

> Hướng dẫn dùng chi tiết nằm trong `docs/13-usage-guide.md` của source (không kèm trong gói `.vsix`).
