import type { DbTreeNode } from "./DbTreeNode";
import { ErrorNode } from "./ErrorNode";
import { InfoNode } from "./InfoNode";

/** Chạy loader, bắt lỗi -> ErrorNode, list rỗng -> InfoNode tùy chọn. */
export async function safeChildren(
  loader: () => Promise<DbTreeNode[]>,
  emptyLabel?: string
): Promise<DbTreeNode[]> {
  try {
    const children = await loader();
    if (children.length === 0 && emptyLabel) {
      return [new InfoNode(emptyLabel)];
    }
    return children;
  } catch (error) {
    return [new ErrorNode(error instanceof Error ? error.message : String(error))];
  }
}
