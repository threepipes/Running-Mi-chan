import type { EntityType, EntitySpec } from '../game/loaders/EventLoader';

/** マップエディタの編集データ(タイルグリッド + エンティティ)を保持する純ロジック。Phaser/DOM 非依存。 */
export class EditorState {
  readonly width: number;
  readonly height: number;
  private grid: number[][];
  private ents: EntitySpec[];

  constructor(width: number, height: number, chips?: number[][], entities?: EntitySpec[]) {
    this.width = width;
    this.height = height;
    // 内部グリッドは常に height×width に正規化する。
    // chips の次元が width/height と一致しなくても getTile/setTile が
    // undefined アクセスで落ちないようにするため。
    this.grid = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => chips?.[y]?.[x] ?? 0),
    );
    this.ents = entities ? entities.map((e) => ({ ...e })) : [];
  }

  static empty(width: number, height: number): EditorState {
    return new EditorState(width, height);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getTile(x: number, y: number): number {
    return this.inBounds(x, y) ? this.grid[y][x] : 0;
  }

  setTile(x: number, y: number, chip: number): void {
    if (this.inBounds(x, y)) this.grid[y][x] = chip;
  }

  entitiesAt(x: number, y: number): EntitySpec[] {
    return this.ents.filter((e) => e.tileX === x && e.tileY === y);
  }

  toggleEntity(type: EntityType, x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = this.ents.findIndex((e) => e.type === type && e.tileX === x && e.tileY === y);
    if (i >= 0) this.ents.splice(i, 1);
    else this.ents.push({ type, tileX: x, tileY: y });
  }

  get chips(): number[][] {
    return this.grid;
  }

  get entities(): readonly EntitySpec[] {
    return this.ents;
  }
}
