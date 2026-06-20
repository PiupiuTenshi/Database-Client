export const EXTENSION_DISPLAY_NAME = "Open DB Nexus";

/** View container ở Activity Bar. Trùng với contributes.viewsContainers trong package.json. */
export const VIEW_CONTAINER_ID = "openDbNexus";

/** Id các TreeView. Trùng với contributes.views trong package.json. */
export const VIEWS = {
  connections: "openDbNexus.connections"
} as const;

/** Command id theo namespace openDbNexus.*. Trùng với contributes.commands. */
export const COMMANDS = {
  helloWorld: "openDbNexus.helloWorld",
  addConnection: "openDbNexus.addConnection",
  refreshConnections: "openDbNexus.refreshConnections",
  removeConnection: "openDbNexus.removeConnection"
} as const;

/** contextValue gắn lên TreeItem để điều khiển hiển thị context menu (when: viewItem == ...). */
export const CONTEXT_VALUES = {
  connection: "connection",
  info: "info"
} as const;
