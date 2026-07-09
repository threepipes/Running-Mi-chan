/**
 * バイト列を鍵(UTF-8)で繰り返しXORする。XORは対称なので、同じ鍵での再適用で元に戻る。
 */
export function xorBytes(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  // 空鍵はXORが素通し(入力=出力)になり無意味なため、設定ミスに早く気付けるよう例外にする。
  if (keyBytes.length === 0) {
    throw new Error('xorBytes: key must not be empty');
  }
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}
