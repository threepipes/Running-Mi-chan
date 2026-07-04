import { SHEET_COLS, CHIP_COLS } from '../../config';

export interface ParsedMap {
  width: number;
  height: number;
  data: number[][];
}

/** 元チップID を Phaser タイルセット(map.png=SHEET_COLS列)のインデックスに変換する */
export function chipToIndex(chip: number, sheetCols = SHEET_COLS, chipCols = CHIP_COLS): number {
  if (chip === 0) return -1;
  const col = chip % chipCols;
  const row = Math.floor(chip / chipCols);
  return row * sheetCols + col;
}

/** .map バイナリ(row:1byte, col:2byte BE, 続いて row*col の chip id)をパースする */
export function parseMap(buffer: ArrayBuffer): ParsedMap {
  const bytes = new Uint8Array(buffer);
  const height = bytes[0];
  const width = (bytes[1] << 8) | bytes[2];
  const data: number[][] = [];
  let p = 3;
  for (let y = 0; y < height; y++) {
    const rowArr: number[] = [];
    for (let x = 0; x < width; x++) {
      rowArr.push(chipToIndex(bytes[p++]));
    }
    data.push(rowArr);
  }
  return { width, height, data };
}
