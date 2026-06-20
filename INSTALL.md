# Cài đặt & chạy Open DB Nexus trong VS Code

Hai cách dùng extension: **chạy từ source (F5)** để phát triển, hoặc **cài bằng file `.vsix`** để dùng như extension thật.

## Yêu cầu

- VS Code ≥ 1.90
- Node.js 20+ và npm
- (Tùy chọn) Docker — để chạy DB test local trong [test/docker/](test/docker/README.md)

---

## Cách 1 — Chạy từ source (Extension Development Host)

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
3. Mở **Open DB Nexus** ở Activity Bar (icon 🛢️) để bắt đầu.

Mỗi lần sửa code, bấm **Ctrl+R** trong cửa sổ Dev Host để nạp lại (hoặc dừng/F5 lại).

---

## Cách 2 — Cài bằng file `.vsix`

Dùng khi muốn cài vào VS Code thật (không cần mở source).

### Bước 1: Tạo file `.vsix`

```bash
cd vscode-db-client
npm run package:vsix
# -> tạo open-db-nexus-<version>.vsix
```

### Bước 2: Cài vào VS Code

Bằng dòng lệnh:

```bash
code --install-extension open-db-nexus-1.1.0.vsix
```

Hoặc trong VS Code UI:

1. Mở tab **Extensions** (`Ctrl+Shift+X`).
2. Bấm menu `...` ở góc trên phải → **Install from VSIX...**
3. Chọn file `open-db-nexus-1.1.0.vsix`.

> **Lưu ý native module với `.vsix`:** prebuilt `better-sqlite3` trong gói là cho
> Node chuẩn. Nếu SQLite báo lỗi ABI khi chạy trong VS Code, rebuild rồi đóng gói lại:
>
> ```bash
> npx @electron/rebuild -f -w better-sqlite3
> npm run package:vsix
> ```

### Gỡ cài đặt

```bash
code --uninstall-extension piupiutenshi.open-db-nexus
```

---

## Kiểm tra nhanh sau khi cài

1. Mở **Open DB Nexus** ở Activity Bar.
2. **＋ Add Connection** → chọn SQLite, File Path trỏ tới một file `.sqlite` (hoặc `:memory:`).
3. **Test Connection** → thấy "Connected".
4. Mở rộng connection để xem Tables/Columns; chuột phải bảng → **Open Table Data**.

Hướng dẫn dùng chi tiết: [docs/13-usage-guide.md](docs/13-usage-guide.md).
