# RunAction Web版 MVP 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android版「RunAction」の1ステージ(easy01)を、ブラウザ(PC・スマホ)でワンボタン操作で通しプレイでき、GitHub Pagesで公開された状態にする。

**Architecture:** TypeScript + Phaser 3 + Vite。既存の画像・レベルデータ(`.map`バイナリ / `.evt` CSV)をそのまま流用し、ランタイムでパースして Phaser の Tilemap + Arcade Physics に載せる。純粋ロジック(パーサ)は Vitest で TDD、Phaser のシーン/エンティティはブラウザ手動確認。

**Tech Stack:** TypeScript, Phaser 3 (3.9x), Vite, Vitest, GitHub Actions (Pages deploy)

## Global Constraints

- 基準解像度: 540 × 960 ポートレート。Scale mode = `FIT`、autoCenter = `CENTER_BOTH`
- タイルサイズ: 32px
- タイルセット `map.png` は物理5列だが、元チップIDは16列前提で addressing されている。変換式: `chip 0 → -1(空)`、`chip N → floor(N/16)*5 + (N%16)`
- 操作は「ジャンプ」1種類のみ。前進は自動(constant velocity)
- 即死条件: 前進方向の水平タイル衝突 / 画面下への落下 / 針接触 / 敵への横接触
- アクション: 敵を上から踏む(`player.y < enemy.y`)=撃破+再ジャンプ / バネ=強い上方バウンス+空中再ジャンプ / 中間ゲート=復帰位置更新 / マップ終端到達=クリア
- 元アセット配置元: `/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/drawable-nodpi/`(画像) と `.../res/raw/`(レベル)
- 対象レベル: `map_easy01.map`(row=30, col=500) / `event_easy01.evt`(ENEMY 9 / NEEDLE 63 / SPRING 7 / GATE 1)

---

## ファイル構成

```
RunActionRenew/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  .github/workflows/deploy.yml
  public/
    assets/           # 画像 (BootScene が読む)
    levels/           # .map / .evt
  src/
    main.ts           # Phaser.Game 起動・Scale/物理設定
    config.ts         # 定数
    scenes/
      BootScene.ts    # アセット preload
      GameScene.ts    # ゲーム本体
    game/
      loaders/
        MapLoader.ts  # .map バイナリ → number[][]
        EventLoader.ts# .evt CSV → EntitySpec[]
  test/
    MapLoader.test.ts
    EventLoader.test.ts
```

---

## Task 1: プロジェクト scaffold と空の Phaser 起動

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/config.ts`, `src/main.ts`, `src/scenes/BootScene.ts`, `src/scenes/GameScene.ts`

**Interfaces:**
- Produces: `src/config.ts` の全定数、`GameScene`/`BootScene` クラス

- [ ] **Step 1: 依存インストール**

```bash
cd /Users/tsutsumi/hobby/RunActionRenew
npm init -y
npm install phaser@^3.90.0   # Phaser 3系に固定(4系はAPIが異なるため不可)
npm install -D typescript vite vitest
```

- [ ] **Step 2: `tsconfig.json` 作成**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: `vite.config.ts` 作成**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages(project pages)でも相対参照で動くように
});
```

- [ ] **Step 4: `vitest.config.ts` 作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

- [ ] **Step 5: `index.html` 作成**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>RunAction</title>
    <style>
      html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
      #game { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: `src/config.ts` 作成**

```ts
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 32;

// 元 map.png は物理5列だが chip id は16列前提で addressing されている
export const SHEET_COLS = 5;
export const CHIP_COLS = 16;

// 物理値(px/秒・px/秒^2)。体感で調整可
export const RUN_SPEED = 260;
export const JUMP_VELOCITY = 620;
export const GRAVITY_Y = 1800;
export const SPRING_VELOCITY = 980;
export const ENEMY_SPEED = 100;

export const LEVEL = 'easy01';
```

- [ ] **Step 7: `src/scenes/BootScene.ts` 作成(空 preload、GameSceneへ遷移)**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload(): void {
    // Task 5 でアセット読み込みを実装する
  }
  create(): void {
    this.scene.start('Game');
  }
}
```

- [ ] **Step 8: `src/scenes/GameScene.ts` 作成(空、背景色のみ)**

```ts
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }
  create(): void {
    this.cameras.main.setBackgroundColor('#5c94fc');
    this.add.text(20, 20, 'RunAction booting...', { color: '#ffffff' });
  }
}
```

- [ ] **Step 9: `src/main.ts` 作成**

```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: false },
  },
  scene: [BootScene, GameScene],
});
```

- [ ] **Step 10: `package.json` に scripts 追加**

`package.json` の `"scripts"` を以下に置き換える:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 11: 起動確認**

Run: `npm run dev`
Expected: `http://localhost:5173` で青背景に「RunAction booting...」が中央寄せで表示される(ブラウザで目視)。確認後 Ctrl+C。

- [ ] **Step 12: テストランナー確認**

Run: `npm test`
Expected: 「No test files found」で正常終了(exit 0 相当。テストはまだ無い)。

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: Vite+TypeScript+Phaser の初期scaffoldと空のゲーム起動"
```

---

## Task 2: アセット・レベルデータを public/ に配置

**Files:**
- Create: `public/assets/*.png`, `public/levels/map_easy01.map`, `public/levels/event_easy01.evt`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p public/assets public/levels
```

- [ ] **Step 2: 画像コピー**

```bash
SRC=/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/drawable-nodpi
for f in player kuri toge gate map sky yama jump gameclear gameover; do
  cp "$SRC/$f.png" public/assets/
done
ls public/assets/
```
Expected: 10個の png が並ぶ。

- [ ] **Step 3: レベルデータコピー**

```bash
RAW=/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/raw
cp "$RAW/map_easy01.map" public/levels/
cp "$RAW/event_easy01.evt" public/levels/
ls -l public/levels/
```
Expected: `map_easy01.map`(15003 bytes) と `event_easy01.evt` が存在。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "assets: stage1(easy01)の画像とレベルデータを public/ に配置"
```

---

## Task 3: MapLoader (.map バイナリ → Phaser タイル配列) — TDD

**Files:**
- Create: `src/game/loaders/MapLoader.ts`
- Test: `test/MapLoader.test.ts`

**Interfaces:**
- Consumes: `src/config.ts` の `SHEET_COLS`, `CHIP_COLS`
- Produces:
  - `chipToIndex(chip: number, sheetCols?: number, chipCols?: number): number`
  - `interface ParsedMap { width: number; height: number; data: number[][] }`
  - `parseMap(buffer: ArrayBuffer): ParsedMap`

- [ ] **Step 1: 失敗するテストを書く**

`test/MapLoader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chipToIndex, parseMap } from '../src/game/loaders/MapLoader';

describe('chipToIndex', () => {
  it('chip 0 は空(-1)', () => {
    expect(chipToIndex(0)).toBe(-1);
  });
  it('同一行(0-4)はそのまま', () => {
    expect(chipToIndex(1)).toBe(1);
    expect(chipToIndex(2)).toBe(2);
    expect(chipToIndex(4)).toBe(4);
  });
  it('chip 17 は 2行目の 5*1+1=6', () => {
    expect(chipToIndex(17)).toBe(6);
  });
});

describe('parseMap', () => {
  it('ヘッダ(row=2, col=3)と本体を number[][] に変換する', () => {
    // row=2, col=3(big-endian: 0x00 0x03), 本体: 0,1,17, 4,0,2
    const bytes = new Uint8Array([2, 0x00, 0x03, 0, 1, 17, 4, 0, 2]);
    const parsed = parseMap(bytes.buffer);
    expect(parsed.height).toBe(2);
    expect(parsed.width).toBe(3);
    expect(parsed.data).toEqual([
      [-1, 1, 6],
      [4, -1, 2],
    ]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npm test`
Expected: FAIL(「Cannot find module '../src/game/loaders/MapLoader'」等)

- [ ] **Step 3: 最小実装**

`src/game/loaders/MapLoader.ts`:

```ts
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
```

- [ ] **Step 4: テスト成功を確認**

Run: `npm test`
Expected: PASS(全 assertion 成功)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: .map バイナリを Phaser タイル配列へ変換する MapLoader"
```

---

## Task 4: EventLoader (.evt CSV → EntitySpec[]) — TDD

**Files:**
- Create: `src/game/loaders/EventLoader.ts`
- Test: `test/EventLoader.test.ts`

**Interfaces:**
- Produces:
  - `type EntityType = 'ENEMY' | 'NEEDLE' | 'SPRING' | 'GATE' | 'STAR'`
  - `interface EntitySpec { type: EntityType; tileX: number; tileY: number }`
  - `parseEvents(text: string): EntitySpec[]`

- [ ] **Step 1: 失敗するテストを書く**

`test/EventLoader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEvents } from '../src/game/loaders/EventLoader';

describe('parseEvents', () => {
  it('TYPE,x,y の行をパースする', () => {
    const text = 'NEEDLE,321,10\nENEMY,245,11\nSPRING,100,5\nGATE,250,12';
    expect(parseEvents(text)).toEqual([
      { type: 'NEEDLE', tileX: 321, tileY: 10 },
      { type: 'ENEMY', tileX: 245, tileY: 11 },
      { type: 'SPRING', tileX: 100, tileY: 5 },
      { type: 'GATE', tileX: 250, tileY: 12 },
    ]);
  });
  it('空行・未知タイプ・CRLF を無視する', () => {
    const text = 'NEEDLE,1,2\r\n\r\nUNKNOWN,3,4\n';
    expect(parseEvents(text)).toEqual([{ type: 'NEEDLE', tileX: 1, tileY: 2 }]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npm test`
Expected: FAIL(「Cannot find module」)

- [ ] **Step 3: 最小実装**

`src/game/loaders/EventLoader.ts`:

```ts
export type EntityType = 'ENEMY' | 'NEEDLE' | 'SPRING' | 'GATE' | 'STAR';

export interface EntitySpec {
  type: EntityType;
  tileX: number;
  tileY: number;
}

const VALID: EntityType[] = ['ENEMY', 'NEEDLE', 'SPRING', 'GATE', 'STAR'];

/** .evt CSV(TYPE,tileX,tileY)をパースする。空行・未知タイプは無視 */
export function parseEvents(text: string): EntitySpec[] {
  const specs: EntitySpec[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const [type, x, y] = t.split(',');
    if (!VALID.includes(type as EntityType)) continue;
    specs.push({ type: type as EntityType, tileX: parseInt(x, 10), tileY: parseInt(y, 10) });
  }
  return specs;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: .evt CSV をパースする EventLoader"
```

---

## Task 5: アセット読み込み + タイルマップ・背景の描画

**Files:**
- Modify: `src/scenes/BootScene.ts`(preload 実装)
- Modify: `src/scenes/GameScene.ts`(タイルマップ+背景)

**Interfaces:**
- Consumes: `parseMap`(Task 3)、`LEVEL`/`TILE_SIZE`(config)
- Produces: `GameScene` のプロパティ `layer: Phaser.Tilemaps.TilemapLayer`, `worldWidth: number`, `worldHeight: number`

- [ ] **Step 1: `BootScene.ts` の preload を実装**

`preload()` の中身を以下に置き換える:

```ts
  preload(): void {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('yama', 'assets/yama.png');
    this.load.image('toge', 'assets/toge.png');
    this.load.image('gate', 'assets/gate.png');
    this.load.image('mapTiles', 'assets/map.png');
    this.load.image('gameclear', 'assets/gameclear.png');
    this.load.image('gameover', 'assets/gameover.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: 32, frameHeight: 32 });
    this.load.binary('mapbin', `levels/map_${LEVEL}.map`);
    this.load.text('events', `levels/event_${LEVEL}.evt`);
  }
```

`BootScene.ts` の import に追加:

```ts
import { LEVEL } from '../config';
```

- [ ] **Step 2: `GameScene.ts` を背景+タイルマップ描画に置き換える**

```ts
import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { parseMap } from '../game/loaders/MapLoader';

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private worldWidth = 0;
  private worldHeight = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    // 背景(パララックス)
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    this.add
      .image(0, GAME_HEIGHT, 'yama')
      .setOrigin(0, 1)
      .setScrollFactor(0.3)
      .setDepth(-9);

    // タイルマップ
    const parsed = parseMap(this.cache.binary.get('mapbin') as ArrayBuffer);
    this.worldWidth = parsed.width * TILE_SIZE;
    this.worldHeight = parsed.height * TILE_SIZE;

    const map = this.make.tilemap({
      data: parsed.data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tiles = map.addTilesetImage('mapTiles')!;
    this.layer = map.createLayer(0, tiles, 0, 0)!;
    this.layer.setCollisionByExclusion([-1]);

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
  }
}
```

- [ ] **Step 3: 描画確認**

Run: `npm run dev`
Expected: ブラウザ左上に、空(sky)を背景に stage1 のタイル地形(地面など)が描画される。カメラはまだ動かない(左端が見える)。確認後 Ctrl+C。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: アセット読込とタイルマップ・パララックス背景の描画"
```

---

## Task 6: プレイヤー(自動前進・ジャンプ・衝突・死亡・ゴール)

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `layer`, `worldWidth`, `worldHeight`(Task 5)、`RUN_SPEED`/`JUMP_VELOCITY`(config)
- Produces: `GameScene` の `player: Phaser.Physics.Arcade.Sprite`, メソッド `die(): void`, `clear(): void`, `checkpointX/Y`, `forceJump: boolean`

- [ ] **Step 1: import と定数を追加**

`GameScene.ts` の import 行を更新:

```ts
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, RUN_SPEED, JUMP_VELOCITY } from '../config';
```

クラスにプロパティ追加:

```ts
  private player!: Phaser.Physics.Arcade.Sprite;
  private jumpKeys!: Phaser.Input.Keyboard.Key[];
  private pointerJump = false;
  private forceJump = false;
  private isEnded = false;
  private startX = TILE_SIZE * 2;
  private startY = 0;
  private checkpointX = TILE_SIZE * 2;
  private checkpointY = 0;
  private goalX = 0;
```

- [ ] **Step 2: `create()` の末尾にプレイヤー/入力/カメラ設定を追加**

`create()` の `this.cameras.main.setBounds(...)` の後に追記:

```ts
    // プレイヤー初期位置(スタート地点のやや上空)
    this.startY = this.worldHeight - TILE_SIZE * 4;
    this.checkpointX = this.startX;
    this.checkpointY = this.startY;
    this.goalX = this.worldWidth - GAME_WIDTH;

    this.createAnims();

    this.player = this.physics.add.sprite(this.startX, this.startY, 'player', 0);
    this.player.setCollideWorldBounds(false);
    this.physics.add.collider(this.player, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(0, GAME_HEIGHT);

    // 入力(キーボード + タップ)
    this.jumpKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    ];
    this.input.on('pointerdown', () => {
      this.pointerJump = true;
    });
```

- [ ] **Step 3: アニメ生成メソッドを追加**

クラス内に追加:

```ts
  private createAnims(): void {
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 3] }),
        frameRate: 12,
        repeat: -1,
      });
      this.anims.create({
        key: 'jump',
        frames: [{ key: 'player', frame: 4 }],
        frameRate: 1,
      });
    }
  }
```

- [ ] **Step 4: `update()` を追加**

```ts
  update(): void {
    if (this.isEnded) return;

    this.player.setVelocityX(RUN_SPEED);

    const onGround = this.player.body!.blocked.down;
    if (this.consumeJump() && (onGround || this.forceJump)) {
      this.player.setVelocityY(-JUMP_VELOCITY);
      this.forceJump = false;
    }

    this.player.anims.play(onGround ? 'run' : 'jump', true);

    // 即死: 前進方向の壁衝突
    if (this.player.body!.blocked.right) {
      this.die();
      return;
    }
    // 即死: 落下
    if (this.player.y > this.worldHeight) {
      this.die();
      return;
    }
    // ゴール
    if (this.player.x >= this.goalX) {
      this.clear();
    }
  }

  private consumeJump(): boolean {
    const keyJust = this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const pointer = this.pointerJump;
    this.pointerJump = false;
    return keyJust || pointer;
  }

  private die(): void {
    if (this.isEnded) return;
    this.player.setPosition(this.checkpointX, this.checkpointY);
    this.player.setVelocity(0, 0);
    this.forceJump = false;
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
  }
```

- [ ] **Step 5: 動作確認**

Run: `npm run dev`
Expected: プレイヤーが自動で右へ走り出し、カメラが追従して横スクロールする。Space / ↑ / 画面タップでジャンプする。段差や壁にぶつかると(あるいは穴に落ちると)スタート地点に戻る。ジャンプで越えれば進める。確認後 Ctrl+C。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: プレイヤーの自動前進・ジャンプ・衝突死・落下死・ゴール判定"
```

---

## Task 7: 敵(Kuribo)の生成・歩行・踏みつけ/被弾

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `parseEvents`(Task 4)、`player`/`layer`/`die`(Task 6)、`ENEMY_SPEED`/`JUMP_VELOCITY`(config)
- Produces: `GameScene` の `enemies: Phaser.Physics.Arcade.Group`

- [ ] **Step 1: import・プロパティ追加**

import に追加:

```ts
import { ENEMY_SPEED } from '../config';
import { parseEvents } from '../game/loaders/EventLoader';
```

プロパティ追加:

```ts
  private enemies!: Phaser.Physics.Arcade.Group;
```

- [ ] **Step 2: 敵アニメを `createAnims()` に追加**

`createAnims()` の `if (!this.anims.exists('run'))` ブロック内に追記:

```ts
      this.anims.create({
        key: 'kuri-walk',
        frames: this.anims.generateFrameNumbers('kuri', { frames: [0, 1] }),
        frameRate: 6,
        repeat: -1,
      });
```

- [ ] **Step 3: `create()` にイベント読込と敵生成を追加**

`create()` 内、プレイヤー生成の後(入力設定の前後どちらでも可)に追記:

```ts
    // イベントからエンティティ生成
    const specs = parseEvents(this.cache.text.get('events') as string);
    this.enemies = this.physics.add.group();

    for (const s of specs) {
      // .evt のタイル座標は左上基準。Phaser のスプライトはデフォルト origin=0.5(中心)なので
      // タイル中心に配置してズレを防ぐ
      const px = s.tileX * TILE_SIZE + TILE_SIZE / 2;
      const py = s.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (s.type === 'ENEMY') {
        const e = this.enemies.create(px, py, 'kuri', 0) as Phaser.Physics.Arcade.Sprite;
        e.setVelocityX(-ENEMY_SPEED);
        e.anims.play('kuri-walk', true);
      }
    }

    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.onEnemyOverlap(e as Phaser.Physics.Arcade.Sprite);
    });
```

- [ ] **Step 4: 踏みつけ判定メソッドを追加**

クラス内に追加:

```ts
  private onEnemyOverlap(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.isEnded || !enemy.active) return;
    // 元コード準拠: プレイヤーが敵より上にいれば踏みつけ
    if (this.player.y < enemy.y) {
      enemy.destroy();
      this.forceJump = true;
      this.player.setVelocityY(-JUMP_VELOCITY);
    } else {
      this.die();
    }
  }
```

`import` に `JUMP_VELOCITY` が既にあることを確認(Task 6 で追加済み)。

- [ ] **Step 5: 動作確認**

Run: `npm run dev`
Expected: ステージ上に敵(kuri)が現れ左方向に歩く。上から踏むと敵が消えてプレイヤーが小さく跳ね、横からぶつかるとスタート地点に戻る。確認後 Ctrl+C。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 敵(Kuribo)の生成・歩行と踏みつけ/被弾判定"
```

---

## Task 8: 針(Needle)・バネ(Spring)・中間ゲート(Gate)

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `parseEvents` の spec、`player`/`die`/`forceJump`/`checkpoint`(Task 6)、`SPRING_VELOCITY`(config)
- Produces: `GameScene` の `hazards`/`springs`/`gates` グループ

- [ ] **Step 1: import・プロパティ追加**

import に追加:

```ts
import { SPRING_VELOCITY } from '../config';
```

プロパティ追加:

```ts
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private springs!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
```

- [ ] **Step 2: `create()` のエンティティ生成ループを拡張**

Task 7 で追加した `for (const s of specs)` ループの前に、グループを初期化:

```ts
    this.hazards = this.physics.add.staticGroup();
    this.springs = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();
```

同ループ内の `if (s.type === 'ENEMY') {...}` に続けて `else if` を追加:

```ts
      } else if (s.type === 'NEEDLE') {
        this.hazards.create(px, py, 'toge');
      } else if (s.type === 'SPRING') {
        this.springs.create(px, py, 'spring', 0);
      } else if (s.type === 'GATE') {
        this.gates.create(px, py, 'gate');
      }
```

(注: `staticGroup().create` はテクスチャサイズで body を張るため、32×32 の各画像に対して自動で当たり判定が付く)

- [ ] **Step 3: `create()` に overlap 配線を追加**

Task 7 の敵 overlap の下に追記:

```ts
    this.physics.add.overlap(this.player, this.hazards, () => {
      this.die();
    });
    this.physics.add.overlap(this.player, this.springs, () => {
      if (this.isEnded) return;
      this.player.setVelocityY(-SPRING_VELOCITY);
      this.forceJump = true;
    });
    this.physics.add.overlap(this.player, this.gates, (_p, g) => {
      const gate = g as Phaser.Physics.Arcade.Sprite;
      this.checkpointX = gate.x;
      this.checkpointY = gate.y - TILE_SIZE * 2;
    });
```

- [ ] **Step 4: 動作確認**

Run: `npm run dev`
Expected:
- 針(toge)に触れるとスタート/チェックポイントに戻る
- バネ(spring)に乗ると大きく跳ね上がる
- 中間ゲート(gate)を通過後に死ぬと、スタートではなくゲート位置付近から再開する

確認後 Ctrl+C。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 針(死亡)・バネ(強ジャンプ)・中間ゲート(チェックポイント)"
```

---

## Task 9: ゴール/ゲームオーバー演出とリスタート

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `clear`/`die`(Task 6)、`gameclear`/`gameover` 画像(Task 5 で読込済み)
- Produces: 画面オーバーレイ表示 + タップ/キーでの再スタート

- [ ] **Step 1: オーバーレイ表示メソッドを追加**

クラス内に追加:

```ts
  private showOverlay(textureKey: string): void {
    const img = this.add
      .image(this.cameras.main.centerX, this.cameras.main.centerY, textureKey)
      .setScrollFactor(0)
      .setDepth(100)
      .setScale(0.6);
    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY + 180, 'タップでリトライ', {
        color: '#ffffff',
        fontSize: '28px',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    void img;
    this.input.once('pointerdown', () => this.scene.restart());
    this.input.keyboard!.once('keydown', () => this.scene.restart());
  }
```

- [ ] **Step 2: `clear()` を拡張してクリア画像を表示**

`clear()` の `this.player.setVelocity(0, 0);` の後に追記:

```ts
    this.showOverlay('gameclear');
```

- [ ] **Step 3: ゲームオーバー(完全死亡)の扱いを追加**

MVP方針では、チェックポイントからの復帰が基本のため、`die()` は従来どおり位置リセットのままとする。加えて「gameover 画像を出してから復帰したい」場合に備え、`die()` の先頭に一瞬のフィードバックとしてカメラフラッシュを追加する:

`die()` の `this.forceJump = false;` の後に追記:

```ts
    this.cameras.main.flash(200, 255, 0, 0);
```

(注: `gameover.png` はステージ全体を失敗した時の全画面演出。MVP ではチェックポイント復帰方式のため常時の全滅画面は出さない。将来ステージ制を入れる際に `showOverlay('gameover')` を利用する。)

- [ ] **Step 4: シーン再スタート時の状態初期化を確認**

`create()` の先頭で `this.isEnded = false;`、`this.pointerJump = false;`、`this.forceJump = false;` を明示的にリセットする(scene.restart 後に確実に初期化するため):

`create()` の最初の行に追記:

```ts
    this.isEnded = false;
    this.pointerJump = false;
    this.forceJump = false;
```

- [ ] **Step 5: 動作確認**

Run: `npm run dev`
Expected: マップ終端まで到達すると gameclear 画像と「タップでリトライ」が中央に表示され、タップ/キーで最初から再開する。死亡時は赤いフラッシュが入りチェックポイントから復帰する。確認後 Ctrl+C。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: ゴール演出(gameclear)・死亡フラッシュ・リスタート"
```

---

## Task 10: GitHub Pages 自動デプロイ

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build`(Task 1)。`vite.config.ts` の `base: './'`(Task 1 で設定済み)

- [ ] **Step 1: ビルドがローカルで通ることを確認**

Run: `npm run build`
Expected: `dist/` が生成されエラーなく完了。

Run: `npm run preview`
Expected: preview URL で本番ビルドが動作(ゲームがプレイ可能)。確認後 Ctrl+C。

- [ ] **Step 2: GitHub Actions ワークフロー作成**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: `package-lock.json` の存在を確認(`npm ci` に必須)**

Run: `ls package-lock.json`
Expected: ファイルが存在する(Task 1 の `npm install` で生成済み)。無い場合は `npm install` を実行してコミットに含める。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: GitHub Pages への自動デプロイ workflow を追加"
```

- [ ] **Step 5: リモート作成・push・Pages 有効化(手動)**

以下はユーザーが実施(または `gh` で実行):

```bash
gh repo create RunActionRenew --public --source=. --remote=origin --push
```

その後 GitHub リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」に設定する。次回以降 `main` への push で自動デプロイされる。

Expected: Actions が成功し、`https://<user>.github.io/RunActionRenew/` でゲームがプレイできる。

---

## 完了条件

- `npm test` が全てパスする(MapLoader / EventLoader)
- ローカル `npm run dev` で easy01 を最初から最後まで通しプレイできる(自動前進・ジャンプ・敵踏み/被弾・針・バネ・中間ゲート・ゴール・死亡復帰、キーボード+タッチ)
- `main` への push で GitHub Pages に自動公開され、公開URLでプレイできる
