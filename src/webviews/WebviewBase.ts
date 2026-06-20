/** Sinh nonce ngẫu nhiên cho Content Security Policy của webview. */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * Content-Security-Policy chặt cho webview:
 * - không load gì mặc định
 * - style/script chỉ chạy khi có nonce khớp
 * Không cho phép CDN, eval, inline script không nonce.
 */
export function buildCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `style-src ${cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${cspSource} data:`
  ].join("; ");
}
