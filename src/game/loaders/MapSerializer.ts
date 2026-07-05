import { SHEET_COLS, CHIP_COLS } from '../../config';

/** .map バイナリを chip id を変換せず生のまま読む(エディタ用)。parseMap は index へ変換するため別経路。 */
export function parseMapRaw(buffer: ArrayBuffer): { width: number; height: number; chips: number[][] } {
  const bytes = new Uint8Array(buffer);
  const height = bytes[0];
  const width = (bytes[1] << 8) | bytes[2];
  const chips: number[][] = [];
  let p = 3;
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(bytes[p++]);
    chips.push(row);
  }
  return { width, height, chips };
}

/** chipToIndex の逆写像。タイルセットのセル index から保存用 chip id を得る。index<0(空)は 0。 */
export function indexToChip(index: number, sheetCols = SHEET_COLS, chipCols = CHIP_COLS): number {
  if (index < 0) return 0;
  const col = index % sheetCols;
  const row = Math.floor(index / sheetCols);
  return row * chipCols + col;
}

/** タイルグリッド(chip id)を .map バイト列(ROW 1B / COL 2B BE / chip列)へ直列化する。 */
export function serializeMap(chips: number[][]): Uint8Array<ArrayBuffer> {
  const height = chips.length;
  const width = height > 0 ? chips[0].length : 0;
  const bytes = new Uint8Array(3 + height * width);
  bytes[0] = height & 0xff;
  bytes[1] = (width >> 8) & 0xff;
  bytes[2] = width & 0xff;
  let p = 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) bytes[p++] = chips[y][x] & 0xff;
  }
  return bytes;
}
