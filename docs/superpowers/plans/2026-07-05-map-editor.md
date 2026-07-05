# マップエディタ(スタンドアロン版 v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本ゲーム用の `.map`/`.evt` を編集できるスタンドアロンのマップエディタ(`editor.html`)を作る。

**Architecture:** 編集データは純ロジックの `EditorState` に集約。地図描画/入力は Phaser の `EditorScene`、ツールUIは DOM の `EditorUI`、入出力は `MapSerializer`/`EventSerializer`。将来 `EditorScene` をゲームの Scene に登録するだけで統合できる構成。

**Tech Stack:** TypeScript / Phaser 3.90 / Vite 5(マルチページ) / Vitest。

## Global Constraints

- Phaser は `^3.90`(3系固定。Phaser 4 は API 非互換のため上げない)。
- コード内コメントは日本語(既存コードに合わせる)。
- 既存モジュールを再利用: `chipToIndex`/`parseMap`(`src/game/loaders/MapLoader.ts`)、`parseEvents`・型 `EntityType`/`EntitySpec`(`src/game/loaders/EventLoader.ts`)。
- データ形式(厳守):
  - `.map` バイナリ = `ROW(1byte)` / `COL(2byte big-endian)` / `row×col の chip id(各1byte)`。chip 0 = 空。
  - `.evt` CSV = 1行 `TYPE,tileX,tileY`(TYPE ∈ `ENEMY,NEEDLE,SPRING,GATE,STAR`)。
- 定数は `src/config.ts` を参照: `TILE_SIZE=32`, `SHEET_COLS=5`, `CHIP_COLS=16`。
- 開発専用フックは `import.meta.env.DEV` ガード下に置く(本番ビルドで除去)。
- main へ直接 commit/push しない。ブランチ `feat/map-editor` で作業し PR。
- テストは Vitest(`test/` 配下、`import { describe, it, expect } from 'vitest'`)。純ロジックは TDD。Phaser/DOM は typecheck+build+Playwright で検証。

---

## File Structure

- `src/editor/EditorState.ts` — 編集データ(タイルグリッド + エンティティ)を保持する純ロジック。
- `src/game/loaders/MapSerializer.ts` — `parseMapRaw`(chip 保持読込)・`indexToChip`(逆写像)・`serializeMap`(状態→.mapバイト)。
- `src/game/loaders/EventSerializer.ts` — `serializeEvents`(エンティティ→.evt CSV)。
- `src/editor/EditorScene.ts` — Phaser Scene。地図描画・ペイント・エンティティ配置/削除・グリッド・カーソル・カメラ操作。
- `src/editor/ui/EditorUI.ts` — DOMツールバー(パレット/ツール/新規/読込/保存)。
- `src/editor/standalone.ts` — スタンドアロン起動(Phaser.Game + EditorScene を作り EditorUI を配線)。
- `editor.html` — 2つ目の Vite エントリ。
- `vite.config.ts` — マルチページ化(`index.html` + `editor.html`)。
- テスト: `test/EditorState.test.ts` / `test/MapSerializer.test.ts` / `test/EventSerializer.test.ts`。

---

### Task 1: EditorState(純ロジック)

**Files:**
- Create: `src/editor/EditorState.ts`
- Test: `test/EditorState.test.ts`

**Interfaces:**
- Consumes: `EntityType`, `EntitySpec`(`src/game/loaders/EventLoader.ts`)。`EntitySpec = { type: EntityType; tileX: number; tileY: number }`。
- Produces:
  - `class EditorState`
    - `constructor(width: number, height: number, chips?: number[][], entities?: EntitySpec[])`
    - `static empty(width: number, height: number): EditorState`
    - `readonly width: number; readonly height: number`
    - `getTile(x: number, y: number): number`(境界外は 0)
    - `setTile(x: number, y: number, chip: number): void`(境界外は無視)
    - `entitiesAt(x: number, y: number): EntitySpec[]`
    - `toggleEntity(type: EntityType, x: number, y: number): void`(同種があれば削除、無ければ追加)
    - `get chips(): number[][]`(内部配列への参照)
    - `get entities(): readonly EntitySpec[]`

- [ ] **Step 1: 失敗するテストを書く**

`test/EditorState.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';

describe('EditorState', () => {
  it('empty は全セル 0・エンティティ空', () => {
    const s = EditorState.empty(3, 2);
    expect(s.width).toBe(3);
    expect(s.height).toBe(2);
    expect(s.getTile(0, 0)).toBe(0);
    expect(s.getTile(2, 1)).toBe(0);
    expect(s.entities.length).toBe(0);
  });

  it('setTile/getTile が読み書きでき、境界外は無視/0', () => {
    const s = EditorState.empty(3, 2);
    s.setTile(1, 1, 17);
    expect(s.getTile(1, 1)).toBe(17);
    s.setTile(9, 9, 5); // 境界外: 無視
    expect(s.getTile(9, 9)).toBe(0);
  });

  it('toggleEntity は同座標同種でトグル(追加→削除)', () => {
    const s = EditorState.empty(3, 2);
    s.toggleEntity('ENEMY', 2, 1);
    expect(s.entitiesAt(2, 1)).toEqual([{ type: 'ENEMY', tileX: 2, tileY: 1 }]);
    s.toggleEntity('ENEMY', 2, 1); // 同種再クリックで削除
    expect(s.entitiesAt(2, 1)).toEqual([]);
  });

  it('コンストラクタは chips/entities を保持する', () => {
    const s = new EditorState(2, 1, [[1, 2]], [{ type: 'SPRING', tileX: 0, tileY: 0 }]);
    expect(s.getTile(1, 0)).toBe(2);
    expect(s.entities.length).toBe(1);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run test/EditorState.test.ts`
Expected: FAIL(`EditorState` が存在しない)

- [ ] **Step 3: 最小実装を書く**

`src/editor/EditorState.ts`:
```ts
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
    this.grid = chips
      ? chips.map((row) => row.slice())
      : Array.from({ length: height }, () => new Array<number>(width).fill(0));
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run test/EditorState.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 5: コミット**

```bash
git add src/editor/EditorState.ts test/EditorState.test.ts
git commit -m "feat(editor): 編集データを保持する EditorState(純ロジック)を追加"
```

---

### Task 2: MapSerializer(parseMapRaw / indexToChip / serializeMap)

**Files:**
- Create: `src/game/loaders/MapSerializer.ts`
- Test: `test/MapSerializer.test.ts`

**Interfaces:**
- Consumes: `SHEET_COLS`, `CHIP_COLS`(`src/config.ts`)。`chipToIndex`(`src/game/loaders/MapLoader.ts`、往復検証用)。
- Produces:
  - `parseMapRaw(buffer: ArrayBuffer): { width: number; height: number; chips: number[][] }`(chip を変換せず生のまま返す)
  - `indexToChip(index: number, sheetCols?: number, chipCols?: number): number`(`chipToIndex` の逆。`index < 0` は 0)
  - `serializeMap(chips: number[][]): Uint8Array`(`ROW(1B)/COL(2B BE)/chip列`)

- [ ] **Step 1: 失敗するテストを書く**

`test/MapSerializer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseMapRaw, indexToChip, serializeMap } from '../src/game/loaders/MapSerializer';
import { chipToIndex } from '../src/game/loaders/MapLoader';

describe('serializeMap / parseMapRaw', () => {
  it('chips を .map バイト列へ直列化し、読み戻すと一致する(往復)', () => {
    const chips = [
      [0, 1, 17],
      [4, 0, 2],
    ];
    const bytes = serializeMap(chips);
    // ROW=2, COL=3(0x00,0x03), 本体 0,1,17,4,0,2
    expect(Array.from(bytes)).toEqual([2, 0x00, 0x03, 0, 1, 17, 4, 0, 2]);
    const raw = parseMapRaw(bytes.buffer);
    expect(raw.height).toBe(2);
    expect(raw.width).toBe(3);
    expect(raw.chips).toEqual(chips);
  });
});

describe('indexToChip', () => {
  it('負のindex(空)は chip 0', () => {
    expect(indexToChip(-1)).toBe(0);
  });
  it('chipToIndex の逆写像になっている', () => {
    expect(indexToChip(1)).toBe(1);
    expect(indexToChip(6)).toBe(17);
    // 逆変換の一貫性
    expect(chipToIndex(indexToChip(6))).toBe(6);
    expect(chipToIndex(indexToChip(1))).toBe(1);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run test/MapSerializer.test.ts`
Expected: FAIL(`MapSerializer` が存在しない)

- [ ] **Step 3: 最小実装を書く**

`src/game/loaders/MapSerializer.ts`:
```ts
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
export function serializeMap(chips: number[][]): Uint8Array {
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run test/MapSerializer.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: コミット**

```bash
git add src/game/loaders/MapSerializer.ts test/MapSerializer.test.ts
git commit -m "feat(editor): .map の生読込 parseMapRaw と直列化 serializeMap/indexToChip を追加"
```

---

### Task 3: EventSerializer(serializeEvents)

**Files:**
- Create: `src/game/loaders/EventSerializer.ts`
- Test: `test/EventSerializer.test.ts`

**Interfaces:**
- Consumes: `EntitySpec`, `parseEvents`(`src/game/loaders/EventLoader.ts`)。
- Produces: `serializeEvents(entities: readonly EntitySpec[]): string`(1行 `TYPE,tileX,tileY`、末尾改行あり)

- [ ] **Step 1: 失敗するテストを書く**

`test/EventSerializer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { serializeEvents } from '../src/game/loaders/EventSerializer';
import { parseEvents } from '../src/game/loaders/EventLoader';

describe('serializeEvents', () => {
  it('エンティティを CSV へ直列化する', () => {
    const csv = serializeEvents([
      { type: 'ENEMY', tileX: 3, tileY: 4 },
      { type: 'SPRING', tileX: 5, tileY: 6 },
    ]);
    expect(csv).toBe('ENEMY,3,4\nSPRING,5,6\n');
  });

  it('parseEvents と往復一致する', () => {
    const list = [
      { type: 'GATE' as const, tileX: 1, tileY: 2 },
      { type: 'STAR' as const, tileX: 7, tileY: 8 },
    ];
    expect(parseEvents(serializeEvents(list))).toEqual(list);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run test/EventSerializer.test.ts`
Expected: FAIL(`EventSerializer` が存在しない)

- [ ] **Step 3: 最小実装を書く**

`src/game/loaders/EventSerializer.ts`:
```ts
import type { EntitySpec } from './EventLoader';

/** エンティティ配列を .evt CSV(1行 TYPE,tileX,tileY)へ直列化する。parseEvents の逆。 */
export function serializeEvents(entities: readonly EntitySpec[]): string {
  return entities.map((e) => `${e.type},${e.tileX},${e.tileY}`).join('\n') + '\n';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run test/EventSerializer.test.ts`
Expected: PASS(2 tests)

- [ ] **Step 5: コミット**

```bash
git add src/game/loaders/EventSerializer.ts test/EventSerializer.test.ts
git commit -m "feat(editor): エンティティを .evt へ直列化する serializeEvents を追加"
```

---

### Task 4: Vite マルチページ + editor.html + EditorScene 骨組み + standalone 起動

**Files:**
- Modify: `vite.config.ts`
- Create: `editor.html`
- Create: `src/editor/EditorScene.ts`
- Create: `src/editor/standalone.ts`

**Interfaces:**
- Consumes: `EditorState`(Task 1)、`chipToIndex`(MapLoader)、`TILE_SIZE`(config)。
- Produces:
  - `type EditorTool = 'tile' | EntityType`(`src/editor/EditorScene.ts` から export)
  - `class EditorScene extends Phaser.Scene`
    - `state: EditorState`(現在の編集状態。既定は `EditorState.empty(100, 30)`)
    - `onReady?: (scene: EditorScene) => void`(create 完了時に呼ばれる。standalone が UI 配線に使う)
    - `loadState(state: EditorState): void`(状態を差し替えて全再描画)
    - `setTool(tool: EditorTool): void`
    - `setSelectedChip(chip: number): void`
  - `EDITOR_VIEW_W = 960`, `EDITOR_VIEW_H = 640`(export 定数)

この Task の成果物: `editor.html` を開くと、100×30 の空マップがグリッド付きで描画され、横スクロール/パンできる。

- [ ] **Step 1: vite.config.ts をマルチページ化**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // GitHub Pages(project pages)でも相対参照で動くように
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
});
```

- [ ] **Step 2: editor.html を作成**

`editor.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RunAction マップエディタ</title>
    <style>
      html, body { margin: 0; padding: 0; background: #1e1e1e; color: #eee; font-family: sans-serif; }
      #editor-root { display: flex; flex-direction: column; height: 100vh; }
      #editor-toolbar { padding: 6px 10px; background: #2b2b2b; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      #editor-body { display: flex; flex: 1; min-height: 0; }
      #editor-palette { width: 180px; overflow-y: auto; background: #222; padding: 6px; }
      #editor-canvas { flex: 1; overflow: hidden; }
      button, select, input { font-size: 13px; }
      .tool-btn.active, .tile-swatch.active { outline: 2px solid #4da3ff; }
    </style>
  </head>
  <body>
    <div id="editor-root">
      <div id="editor-toolbar"></div>
      <div id="editor-body">
        <div id="editor-palette"></div>
        <div id="editor-canvas"></div>
      </div>
    </div>
    <script type="module" src="/src/editor/standalone.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: EditorScene 骨組みを作成(描画・グリッド・カメラ)**

`src/editor/EditorScene.ts`:
```ts
import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { chipToIndex } from '../game/loaders/MapLoader';
import { EditorState } from './EditorState';
import type { EntityType } from '../game/loaders/EventLoader';

export const EDITOR_VIEW_W = 960;
export const EDITOR_VIEW_H = 640;

export type EditorTool = 'tile' | EntityType;

// エンティティ表示スタイル(色 + 1文字ラベル)
const ENTITY_STYLE: Record<EntityType, { color: number; label: string }> = {
  ENEMY: { color: 0xe74c3c, label: '敵' },
  NEEDLE: { color: 0x95a5a6, label: '針' },
  SPRING: { color: 0x27ae60, label: 'バ' },
  GATE: { color: 0x2980b9, label: '門' },
  STAR: { color: 0xf1c40f, label: '★' },
};

export class EditorScene extends Phaser.Scene {
  state: EditorState = EditorState.empty(100, 30);
  onReady?: (scene: EditorScene) => void;

  private tool: EditorTool = 'tile';
  private selectedChip = 1;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private entityLayer!: Phaser.GameObjects.Container;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Editor');
  }

  preload(): void {
    this.load.image('mapTiles', 'assets/map.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#5c94fc');
    this.buildMap();
    this.gridGfx = this.add.graphics().setDepth(20);
    this.entityLayer = this.add.container(0, 0).setDepth(10);
    this.cursor = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0.25)
      .setOrigin(0, 0)
      .setDepth(30);
    this.renderAll();
    this.setupInput();

    if (import.meta.env.DEV) {
      (window as unknown as { __editor?: EditorScene }).__editor = this;
    }
    this.onReady?.(this);
  }

  // 現在の state からタイルマップ(空レイヤ)を作り直す
  private buildMap(): void {
    this.map?.destroy();
    this.map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: this.state.width,
      height: this.state.height,
    });
    const tiles = this.map.addTilesetImage('mapTiles')!;
    this.layer = this.map.createBlankLayer('main', tiles)!;
    this.cameras.main.setBounds(0, 0, this.state.width * TILE_SIZE, this.state.height * TILE_SIZE);
  }

  loadState(state: EditorState): void {
    this.state = state;
    this.buildMap();
    this.renderAll();
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
  }

  setSelectedChip(chip: number): void {
    this.selectedChip = chip;
    this.tool = 'tile';
  }

  // 全タイル/エンティティ/グリッドを描画し直す
  private renderAll(): void {
    for (let y = 0; y < this.state.height; y++) {
      for (let x = 0; x < this.state.width; x++) this.drawTile(x, y);
    }
    this.renderEntities();
    this.drawGrid();
  }

  private drawTile(x: number, y: number): void {
    const index = chipToIndex(this.state.getTile(x, y));
    if (index < 0) this.layer.removeTileAt(x, y);
    else this.layer.putTileAt(index, x, y);
  }

  private renderEntities(): void {
    this.entityLayer.removeAll(true);
    for (const e of this.state.entities) {
      const st = ENTITY_STYLE[e.type];
      const px = e.tileX * TILE_SIZE;
      const py = e.tileY * TILE_SIZE;
      const rect = this.add
        .rectangle(px, py, TILE_SIZE, TILE_SIZE, st.color, 0.85)
        .setOrigin(0, 0);
      const label = this.add
        .text(px + TILE_SIZE / 2, py + TILE_SIZE / 2, st.label, { fontSize: '16px', color: '#fff' })
        .setOrigin(0.5);
      this.entityLayer.add([rect, label]);
    }
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x000000, 0.15);
    const w = this.state.width * TILE_SIZE;
    const h = this.state.height * TILE_SIZE;
    for (let x = 0; x <= this.state.width; x++) {
      this.gridGfx.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, h);
    }
    for (let y = 0; y <= this.state.height; y++) {
      this.gridGfx.lineBetween(0, y * TILE_SIZE, w, y * TILE_SIZE);
    }
  }

  private setupInput(): void {
    // マウスホイールで横スクロール
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.cameras.main.scrollX += dy;
      },
    );
    // スペース押下 + ドラッグでパン
    const space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX;
      const wy = p.worldY;
      this.cursor.setPosition(Math.floor(wx / TILE_SIZE) * TILE_SIZE, Math.floor(wy / TILE_SIZE) * TILE_SIZE);
      if (space.isDown && p.isDown) {
        this.cameras.main.scrollX -= (p.x - p.prevPosition.x);
        this.cameras.main.scrollY -= (p.y - p.prevPosition.y);
        return;
      }
      if (p.isDown && this.tool === 'tile') this.paintAt(p);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (space.isDown) return; // パン中は編集しない
      this.editAt(p);
    });
  }

  // ポインタ位置のタイル座標に対して、現在ツールの編集を適用
  private editAt(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.tool === 'tile') {
      this.paintAt(p);
    } else {
      this.state.toggleEntity(this.tool, tx, ty);
      this.renderEntities();
    }
  }

  private paintAt(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.state.getTile(tx, ty) === this.selectedChip) return;
    this.state.setTile(tx, ty, this.selectedChip);
    this.drawTile(tx, ty);
  }
}
```

- [ ] **Step 4: standalone.ts を作成(Phaser.Game 起動)**

`src/editor/standalone.ts`:
```ts
import Phaser from 'phaser';
import { EditorScene, EDITOR_VIEW_W, EDITOR_VIEW_H } from './EditorScene';

const scene = new EditorScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'editor-canvas',
  width: EDITOR_VIEW_W,
  height: EDITOR_VIEW_H,
  backgroundColor: '#5c94fc',
  scene: [scene],
});

if (import.meta.env.DEV) {
  (window as unknown as { __editorGame?: Phaser.Game }).__editorGame = game;
}
```

- [ ] **Step 5: 型チェックとビルド**

Run: `npx tsc --noEmit && npm run build`
Expected: エラーなし。`dist/editor.html` が生成される。

- [ ] **Step 6: Playwright で描画を確認**

`npm run dev` を起動し、`http://localhost:<port>/editor.html` を開く。ブラウザで:
```js
// window.__editor が存在し、空マップが構築されている
() => ({ hasEditor: !!window.__editor, w: window.__editor.state.width, h: window.__editor.state.height })
```
Expected: `{ hasEditor: true, w: 100, h: 30 }`。スクリーンショットでグリッドと青背景が見えること。

- [ ] **Step 7: コミット**

```bash
git add vite.config.ts editor.html src/editor/EditorScene.ts src/editor/standalone.ts
git commit -m "feat(editor): editor.html(2つ目のViteエントリ)とEditorScene骨組み・グリッド・カメラを追加"
```

---

### Task 5: 編集操作の結合確認(ペイント/エンティティ配置)

**Files:**
- Modify: `src/editor/EditorScene.ts`(必要なら微修正のみ。主に検証)

**Interfaces:**
- Consumes: Task 4 の `EditorScene`(`setTool`/`setSelectedChip`/`state`)。
- Produces: なし(既存メソッドの挙動を Playwright で保証)。

この Task は Task 4 で実装済みの入力ロジックを実挙動で検証し、必要な不具合のみ修正する。

- [ ] **Step 1: Playwright でタイルペイントを確認**

`npm run dev` → `/editor.html`。ブラウザで:
```js
() => {
  const e = window.__editor;
  e.setSelectedChip(1);          // タイルツール + chip 1
  // ワールド座標(タイル 2,3)を直接編集する内部経路を叩く代わりに state で検証
  e.state.setTile(2, 3, 1);
  return e.state.getTile(2, 3);  // 1 期待
}
```
Expected: `1`。

- [ ] **Step 2: Playwright でエンティティ配置/削除(トグル)を確認**

```js
() => {
  const e = window.__editor;
  e.setTool('SPRING');
  e.state.toggleEntity('SPRING', 5, 5);
  const after1 = e.state.entitiesAt(5, 5).length; // 1
  e.state.toggleEntity('SPRING', 5, 5);
  const after2 = e.state.entitiesAt(5, 5).length; // 0
  return { after1, after2 };
}
```
Expected: `{ after1: 1, after2: 0 }`。

- [ ] **Step 3: ポインタ操作の実発火を確認(任意・目視)**

エディタ上でマウス左ドラッグしてタイルが塗れること、ホイールで横スクロール、スペース+ドラッグでパンできることを目視確認。問題があれば `setupInput`/`editAt`/`paintAt` を修正。

- [ ] **Step 4: 型チェック・テスト・ビルド**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: すべて成功。

- [ ] **Step 5: コミット(修正があった場合のみ)**

```bash
git add src/editor/EditorScene.ts
git commit -m "fix(editor): 編集操作(ペイント/エンティティ配置)の不具合を修正"
```
(修正が無ければコミットはスキップし、次の Task へ)

---

### Task 6: EditorUI(DOMツールバー・パレット・新規/読込/保存)

**Files:**
- Create: `src/editor/ui/EditorUI.ts`
- Modify: `src/editor/standalone.ts`(UI 配線を追加)

**Interfaces:**
- Consumes:
  - `EditorScene`(`setTool`/`setSelectedChip`/`loadState`/`state`)
  - `EditorState`(Task 1)
  - `parseMapRaw`, `serializeMap`, `indexToChip`(Task 2)
  - `serializeEvents`(Task 3)
  - `parseEvents`(EventLoader)
  - `STAGES`(`src/game/stages.ts`)
  - `TILE_SIZE`, `SHEET_COLS`(config)
- Produces: `class EditorUI { constructor(scene: EditorScene, toolbar: HTMLElement, palette: HTMLElement) }`

- [ ] **Step 1: EditorUI を実装**

`src/editor/ui/EditorUI.ts`:
```ts
import { TILE_SIZE, SHEET_COLS } from '../../config';
import { STAGES } from '../../game/stages';
import { EditorState } from '../EditorState';
import { EditorScene } from '../EditorScene';
import type { EntityType } from '../../game/loaders/EventLoader';
import { parseEvents } from '../../game/loaders/EventLoader';
import { parseMapRaw, serializeMap, indexToChip } from '../../game/loaders/MapSerializer';
import { serializeEvents } from '../../game/loaders/EventSerializer';

const ENTITY_TYPES: EntityType[] = ['ENEMY', 'NEEDLE', 'SPRING', 'GATE', 'STAR'];
const ENTITY_LABEL: Record<EntityType, string> = {
  ENEMY: '敵', NEEDLE: '針', SPRING: 'バネ', GATE: 'ゲート', STAR: 'スター',
};

/** マップエディタの DOM ツールUI。EditorScene とはメソッド呼び出しで疎結合。 */
export class EditorUI {
  private scene: EditorScene;

  constructor(scene: EditorScene, toolbar: HTMLElement, palette: HTMLElement) {
    this.scene = scene;
    this.buildToolbar(toolbar);
    this.buildPalette(palette);
  }

  private buildToolbar(bar: HTMLElement): void {
    // 新規(幅・高さ入力)
    const wInput = this.numberInput(100);
    const hInput = this.numberInput(30);
    const newBtn = this.button('新規', () => {
      const w = parseInt(wInput.value, 10) || 100;
      const h = parseInt(hInput.value, 10) || 30;
      this.scene.loadState(EditorState.empty(w, h));
    });

    // 既存ステージ読込
    const stageSel = document.createElement('select');
    stageSel.appendChild(new Option('— 既存ステージ —', ''));
    STAGES.forEach((s, i) => stageSel.appendChild(new Option(s.name, String(i))));
    stageSel.addEventListener('change', () => {
      const i = parseInt(stageSel.value, 10);
      if (!Number.isNaN(i)) this.loadStage(STAGES[i].mapFile, STAGES[i].eventFile);
      stageSel.value = '';
    });

    // ファイル読込(.map / .evt)
    const mapFile = this.fileInput('.map');
    const evtFile = this.fileInput('.evt');
    const loadBtn = this.button('ファイル読込', () => this.loadFromFiles(mapFile, evtFile));

    // 保存
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = 'map';
    nameInput.size = 8;
    const saveBtn = this.button('保存', () => this.save(nameInput.value || 'map'));

    // ツール(タイル/各エンティティ)
    const tileBtn = this.toolButton('タイル', () => this.scene.setTool('tile'));
    tileBtn.classList.add('active');
    const toolBtns = [tileBtn];
    for (const t of ENTITY_TYPES) {
      toolBtns.push(this.toolButton(ENTITY_LABEL[t], () => this.scene.setTool(t)));
    }
    // ツールボタンの active 表示切替
    toolBtns.forEach((b) =>
      b.addEventListener('click', () => {
        toolBtns.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      }),
    );

    bar.append(
      newBtn, this.text('幅'), wInput, this.text('高'), hInput,
      stageSel, mapFile, evtFile, loadBtn, nameInput, saveBtn,
      this.text('｜ツール:'), ...toolBtns,
    );
  }

  // map.png を読み、各タイルセルをパレット swatch として並べる
  private buildPalette(palette: HTMLElement): void {
    const img = new Image();
    img.src = 'assets/map.png';
    img.onload = () => {
      const rows = Math.floor(img.naturalHeight / TILE_SIZE);
      const total = SHEET_COLS * rows;
      // 消しゴム(空き)
      palette.appendChild(this.eraseSwatch());
      // index 1..total-1(index 0 は空きと衝突するため除外)
      for (let index = 1; index < total; index++) {
        palette.appendChild(this.tileSwatch(index, img.src));
      }
    };
  }

  private tileSwatch(index: number, url: string): HTMLElement {
    const col = index % SHEET_COLS;
    const row = Math.floor(index / SHEET_COLS);
    const el = document.createElement('div');
    el.className = 'tile-swatch';
    el.style.cssText = `display:inline-block;width:${TILE_SIZE}px;height:${TILE_SIZE}px;margin:2px;` +
      `background-image:url(${url});background-position:-${col * TILE_SIZE}px -${row * TILE_SIZE}px;cursor:pointer;`;
    el.addEventListener('click', () => {
      this.selectSwatch(el);
      this.scene.setSelectedChip(indexToChip(index));
    });
    return el;
  }

  private eraseSwatch(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tile-swatch';
    el.textContent = '消';
    el.style.cssText = `display:inline-flex;align-items:center;justify-content:center;` +
      `width:${TILE_SIZE}px;height:${TILE_SIZE}px;margin:2px;background:#444;color:#fff;cursor:pointer;`;
    el.addEventListener('click', () => {
      this.selectSwatch(el);
      this.scene.setSelectedChip(0); // chip 0 = 空き(消しゴム)
    });
    return el;
  }

  private selectSwatch(el: HTMLElement): void {
    el.parentElement?.querySelectorAll('.tile-swatch').forEach((s) => s.classList.remove('active'));
    el.classList.add('active');
  }

  // ---- 読込/保存 ----

  private async loadStage(mapPath: string, evtPath: string): Promise<void> {
    const [mapBuf, evtText] = await Promise.all([
      fetch(mapPath).then((r) => r.arrayBuffer()),
      fetch(evtPath).then((r) => r.text()),
    ]);
    this.applyLoaded(mapBuf, evtText);
  }

  private loadFromFiles(mapInput: HTMLInputElement, evtInput: HTMLInputElement): void {
    const mapF = mapInput.files?.[0];
    if (!mapF) return;
    const evtF = evtInput.files?.[0];
    const mapP = mapF.arrayBuffer();
    const evtP = evtF ? evtF.text() : Promise.resolve('');
    Promise.all([mapP, evtP]).then(([buf, txt]) => this.applyLoaded(buf, txt));
  }

  private applyLoaded(mapBuf: ArrayBuffer, evtText: string): void {
    const raw = parseMapRaw(mapBuf);
    const entities = parseEvents(evtText);
    this.scene.loadState(new EditorState(raw.width, raw.height, raw.chips, entities));
  }

  private save(name: string): void {
    const mapBytes = serializeMap(this.scene.state.chips);
    // Uint8Array のビューを正確に切り出して Blob 化
    const mapBlob = new Blob([mapBytes.slice()], { type: 'application/octet-stream' });
    this.download(mapBlob, `${name}.map`);
    const evtBlob = new Blob([serializeEvents(this.scene.state.entities)], { type: 'text/plain' });
    this.download(evtBlob, `${name}.evt`);
  }

  private download(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- DOM ヘルパ ----
  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  private toolButton(label: string, onClick: () => void): HTMLButtonElement {
    const b = this.button(label, onClick);
    b.className = 'tool-btn';
    return b;
  }
  private numberInput(value: number): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'number';
    i.value = String(value);
    i.size = 4;
    i.style.width = '52px';
    return i;
  }
  private fileInput(accept: string): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.style.width = '150px';
    return i;
  }
  private text(t: string): HTMLSpanElement {
    const s = document.createElement('span');
    s.textContent = t;
    return s;
  }
}
```

- [ ] **Step 2: standalone.ts で UI を配線**

`src/editor/standalone.ts`(全文):
```ts
import Phaser from 'phaser';
import { EditorScene, EDITOR_VIEW_W, EDITOR_VIEW_H } from './EditorScene';
import { EditorUI } from './ui/EditorUI';

const scene = new EditorScene();
// create 完了時に DOM UI を配線(EditorScene 自体は DOM 非依存に保つ)
scene.onReady = (s) => {
  new EditorUI(
    s,
    document.getElementById('editor-toolbar')!,
    document.getElementById('editor-palette')!,
  );
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'editor-canvas',
  width: EDITOR_VIEW_W,
  height: EDITOR_VIEW_H,
  backgroundColor: '#5c94fc',
  scene: [scene],
});

if (import.meta.env.DEV) {
  (window as unknown as { __editorGame?: Phaser.Game }).__editorGame = game;
}
```

- [ ] **Step 3: 型チェックとビルド**

Run: `npx tsc --noEmit && npm run build`
Expected: エラーなし。

- [ ] **Step 4: Playwright で 読込→編集→保存→再読込 の往復を確認**

`npm run dev` → `/editor.html`。
1. 既存ステージ(ステージ1)を読込 → `window.__editor.state.width > 0` かつタイルが描画される。
2. ブラウザで往復整合を検証:
```js
() => {
  const { parseMapRaw, serializeMap } = window; // 実際は module 内。ここでは state 経由で確認
  const e = window.__editor;
  e.loadState(new (e.state.constructor)(3, 2, [[0,1,17],[4,0,2]], []));
  // 保存相当: serializeMap は UI 内。状態が保持されていることを確認
  return { w: e.state.width, h: e.state.height, t: e.state.getTile(2,0) };
}
```
Expected: `{ w: 3, h: 2, t: 17 }`。
3. パレットのタイルをクリック→キャンバスにドラッグで塗れること、エンティティツールで配置/削除できること、保存ボタンで `.map`/`.evt` がダウンロードされることを目視確認。

- [ ] **Step 5: コミット**

```bash
git add src/editor/ui/EditorUI.ts src/editor/standalone.ts
git commit -m "feat(editor): DOMツールUI(パレット/ツール/新規/読込/保存)を追加し配線"
```

---

### Task 7: README にエディタの起動方法を追記

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし。
- Produces: なし。

- [ ] **Step 1: README にエディタ項を追記**

`README.md` の「npm スクリプト」節の後に、次の節を追加する:
```markdown
## マップエディタ(スタンドアロン)

開発サーバ起動中(`npm run dev`)に `http://localhost:5173/editor.html` を開くとマップエディタが使えます。

- 左のパレットでタイルを選び、キャンバスに左ドラッグで地形を描画(「消」で消去)。
- 上部ツールで敵/針/バネ/ゲート/スターを選び、クリックで配置(同じ場所を再クリックで削除)。
- ホイールで横スクロール、スペース押下＋ドラッグでパン。
- 「既存ステージ」から読込、または `.map`/`.evt` をファイル指定で読込。
- 「保存」で `.map`(バイナリ)と `.evt`(CSV)をダウンロード。`public/levels/` に置けばゲームで使えます。
```

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs: マップエディタの起動方法を README に追記"
```

---

## Self-Review

**1. Spec coverage(仕様網羅):**
- タイル描画/消去 → Task 4(paint/drawTile)+ Task 6(パレット・消しゴム)。✓
- エンティティ配置/削除 → Task 1(toggleEntity)+ Task 4(editAt)+ Task 6(ツール)。✓
- 保存(.map/.evt ダウンロード)→ Task 2/3(直列化)+ Task 6(save/download)。✓
- 読込(ファイル/既存ステージ)→ Task 6(loadFromFiles/loadStage/applyLoaded)。✓
- 新規(幅×高さ)→ Task 6(新規ボタン + EditorState.empty)。✓
- スタンドアロン(editor.html)→ Task 4。✓
- Phaser地図 + DOM UI 構成、EditorState 分離 → Task 1/4/6。✓
- チップ符号化(chip保持・chipToIndex描画・indexToChip保存・index0除外)→ Task 2 + Task 4/6。✓
- 往復整合テスト → Task 2/3。✓
- 将来統合(Sceneのみで再利用、DOM非依存)→ EditorScene は DOM 非依存、onReady で疎結合(Task 4/6)。✓

**2. Placeholder scan:** "TBD"/"後で"/"適宜" 等なし。各コード手順に完全なコードあり。✓

**3. Type consistency:**
- `EditorState` の署名(`getTile`/`setTile`/`toggleEntity`/`entitiesAt`/`chips`/`entities`)は Task 1 定義と Task 4/6 の使用が一致。✓
- `EditorTool = 'tile' | EntityType`、`setTool`/`setSelectedChip`/`loadState` は Task 4 定義と Task 6 使用が一致。✓
- `parseMapRaw`/`serializeMap`/`indexToChip`/`serializeEvents` の署名は Task 2/3 定義と Task 6 使用が一致。✓
- `EntitySpec`/`EntityType`/`parseEvents`/`STAGES`/`chipToIndex` は既存定義と一致。✓
