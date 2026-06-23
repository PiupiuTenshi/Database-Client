# 03 — VS Code Extension Design

## 1. Extension Manifest

File:

```txt
package.json
```

Các phần quan trọng:

```json
{
  "name": "open-db-nexus",
  "displayName": "Open DB Nexus",
  "description": "Multi-database client and dependency graph explorer for VS Code.",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": ["Other", "Data Science"],
  "activationEvents": [
    "onView:openDbNexus.connections",
    "onCommand:openDbNexus.addConnection",
    "onCommand:openDbNexus.openQuery"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "openDbNexus",
          "title": "Open DB Nexus",
          "icon": "resources/db-nexus.svg"
        }
      ]
    },
    "views": {
      "openDbNexus": [
        {
          "id": "openDbNexus.connections",
          "name": "Connections"
        },
        {
          "id": "openDbNexus.dependencies",
          "name": "Dependencies"
        }
      ]
    },
    "commands": [
      {
        "command": "openDbNexus.addConnection",
        "title": "Open DB Nexus: Add Connection"
      },
      {
        "command": "openDbNexus.openQuery",
        "title": "Open DB Nexus: Open Query Editor"
      },
      {
        "command": "openDbNexus.openDependencyGraph",
        "title": "Open DB Nexus: Open Dependency Graph"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "openDbNexus.addConnection",
          "when": "view == openDbNexus.connections",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "openDbNexus.openQuery",
          "when": "view == openDbNexus.connections && viewItem == connection",
          "group": "inline"
        },
        {
          "command": "openDbNexus.openDependencyGraph",
          "when": "view == openDbNexus.connections && viewItem == table",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Open DB Nexus",
      "properties": {
        "openDbNexus.schemaCacheTtlSeconds": {
          "type": "number",
          "default": 300,
          "description": "Schema cache TTL in seconds."
        },
        "openDbNexus.query.maxRows": {
          "type": "number",
          "default": 1000,
          "description": "Maximum rows fetched by default."
        }
      }
    }
  }
}
```

## 2. Activity Bar

Extension nên có một icon riêng ở Activity Bar:

```txt
Open DB Nexus
├── Connections
└── Dependencies
```

Lý do:

- Người dùng dễ tìm.
- Không trộn với Explorer mặc định.
- Context menu rõ ràng.

## 3. Tree View

TreeView phù hợp cho Database Explorer vì:

- Dữ liệu dạng phân cấp.
- Có thể lazy load.
- Có context menu.
- Có refresh item.
- Giao diện giống VS Code.

Cấu trúc node:

```txt
ConnectionNode
└── DatabaseNode
    └── SchemaNode
        ├── TablesFolderNode
        │   └── TableNode
        │       ├── ColumnsFolderNode
        │       │   └── ColumnNode
        │       ├── IndexesFolderNode
        │       └── ForeignKeysFolderNode
        ├── ViewsFolderNode
        ├── ProceduresFolderNode
        └── FunctionsFolderNode
```

## 4. TreeDataProvider Skeleton

```ts
export class DatabaseTreeProvider implements vscode.TreeDataProvider<DbTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    DbTreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly schemaService: SchemaService
  ) {}

  refresh(node?: DbTreeNode) {
    this.onDidChangeTreeDataEmitter.fire(node);
  }

  getTreeItem(element: DbTreeNode): vscode.TreeItem {
    return element.toTreeItem();
  }

  async getChildren(element?: DbTreeNode): Promise<DbTreeNode[]> {
    if (!element) {
      const profiles = await this.connectionService.listProfiles();
      return profiles.map((profile) => new ConnectionNode(profile));
    }

    return element.getChildren({
      connectionService: this.connectionService,
      schemaService: this.schemaService
    });
  }
}
```

## 5. Webview dùng khi nào?

Dùng Webview cho các màn hình cần UI phức tạp:

- Connection form.
- Query result grid.
- Table viewer.
- Dependency graph.
- ERD light view.

Không nên dùng Webview cho mọi thứ. TreeView vẫn nên dùng API native của VS Code.

## 6. Webview Message Contract

Extension host gửi data:

```ts
webview.postMessage({
  type: "graph:init",
  payload: {
    nodes,
    edges,
    options
  }
});
```

Webview gửi action:

```ts
vscode.postMessage({
  type: "graph:openTable",
  payload: {
    connectionId,
    objectRef
  }
});
```

Chuẩn message:

```ts
type WebviewMessage<T = unknown> = {
  type: string;
  requestId?: string;
  payload?: T;
};
```

## 7. Webview Security

Cần:

- Dùng Content Security Policy.
- Không inline script nếu có thể.
- Chỉ load resource qua `webview.asWebviewUri`.
- Không truyền secret/password vào webview.
- Validate tất cả message từ webview.
- Không cho webview tự gọi database.

Ví dụ CSP:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
/>
```

## 8. SQL Editor

Khi user chọn `Open Query`:

- Tạo untitled document language `sql`.
- Gắn connectionId vào internal map.
- Status bar hiển thị connection đang bind.
- `Ctrl+Enter` chạy selected/current query.

Thiết kế:

```ts
type BoundSqlDocument = {
  documentUri: string;
  connectionId: string;
  database?: string;
  schema?: string;
};
```

## 9. Status Bar

Status bar nên hiển thị:

```txt
$(database) local-postgres / public
```

Click vào status bar:

- Change connection.
- Change database.
- Change schema.

## 10. Context Menu

### Connection node

- Open Query.
- Refresh.
- Edit Connection.
- Test Connection.
- Disconnect.
- Delete.

### Table node

- Open Table Data.
- Open DDL.
- Open Dependency Graph.
- Copy Full Name.
- Export Data.
- Generate SELECT.
- Generate INSERT template.

### Column node

- Copy Column Name.
- Search Usage.
- Add to Query.

## 11. Keybinding gợi ý

```json
[
  {
    "command": "openDbNexus.runCurrentQuery",
    "key": "ctrl+enter",
    "when": "editorTextFocus && resourceLangId == sql"
  },
  {
    "command": "openDbNexus.runAllQueries",
    "key": "ctrl+shift+enter",
    "when": "editorTextFocus && resourceLangId == sql"
  }
]
```

## 12. UX tối thiểu phải có

- Loading state.
- Empty state.
- Error message rõ ràng.
- Retry button.
- Refresh button.
- Copy error detail.
- Mask secret trong UI/log.
- Confirm trước khi delete connection hoặc delete row.
- Warning khi chạy query không có WHERE với UPDATE/DELETE.
