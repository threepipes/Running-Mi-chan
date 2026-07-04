# タイトル / ステージ選択 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RunAction Web版に「タイトル画面」「ステージ選択画面」「原作3ステージ」「クリア状況の localStorage 永続化」を追加する。

**Architecture:** Phaser のシーンを Boot → Title → StageSelect → Game(stageIndex) の4段に分割。ステージ定義は `stages.ts` レジストリ、クリア記録は `Progress.ts`(localStorage) に閉じ込める。GameScene は `init({stageIndex})` で対象ステージを受け取り、クリア時に Progress へ記録する。

**Tech Stack:** TypeScript, Phaser 3.90, Vite, Vitest, Node 24 (LTS)

## Global Constraints

- Phaser 3.90（Phaser 3 API）。基準解像度 540×960 ポートレート、Scale FIT + CENTER_BOTH、TILE_SIZE 32。
- 3ステージ: index 0=easy01(30×500) / 1=medium01(30×600) / 2=map(30×1000)。チップID {0,1,2,3,4,17} は既存 `chipToIndex` で対応済み。イベントは全て ENEMY/NEEDLE/SPRING/GATE のみ（STARなし）、GATE 各1個。
- クリアスタンプ: ゲート未使用クリア=`stamp`、通常クリア=`stamp_sub`。localStorage キー `runaction:progress`。
- localStorage 例外（プライベートモード等）は握りつぶして進行を止めない。
- 既存アセット配置元: 画像 `/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/drawable-nodpi/` および `.../drawable-hdpi/`、レベル `.../res/raw/`。

---

## ファイル構成

```
src/
  main.ts                    # 改修: Title/StageSelect を scene 登録
  config.ts                  # 改修: 未使用の LEVEL を撤去
  scenes/
    BootScene.ts             # 改修: 全ステージ+タイトル/選択UI画像をpreload、Titleへ遷移
    TitleScene.ts            # 新規
    StageSelectScene.ts      # 新規
    GameScene.ts             # 改修: create()整理, stageIndex受取, usedGate, 結果2択, 戻る導線, クリア記録
  game/
    stages.ts                # 新規: ステージレジストリ
    Progress.ts              # 新規: localStorage クリア記録
    loaders/                 # 既存(変更なし)
test/
  stages.test.ts             # 新規
  Progress.test.ts           # 新規
```

---

## Task 1: ステージレジストリ (stages.ts) — TDD

**Files:**
- Create: `src/game/stages.ts`
- Test: `test/stages.test.ts`

**Interfaces:**
- Produces:
  - `interface StageDef { index: number; name: string; mapKey: string; eventKey: string; mapFile: string; eventFile: string }`
  - `const STAGES: StageDef[]`（3要素）

- [ ] **Step 1: 失敗するテストを書く**

`test/stages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/game/stages';

describe('STAGES', () => {
  it('3ステージを index 0..2 で定義する', () => {
    expect(STAGES).toHaveLength(3);
    expect(STAGES.map((s) => s.index)).toEqual([0, 1, 2]);
  });
  it('mapKey / eventKey は一意', () => {
    const keys = STAGES.flatMap((s) => [s.mapKey, s.eventKey]);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('各ステージが name / mapFile / eventFile を持つ', () => {
    for (const s of STAGES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.mapFile).toMatch(/^levels\/.+\.map$/);
      expect(s.eventFile).toMatch(/^levels\/.+\.evt$/);
    }
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npm test`
Expected: FAIL（「Cannot find module '../src/game/stages'」）

- [ ] **Step 3: 実装**

`src/game/stages.ts`:

```ts
export interface StageDef {
  index: number;
  name: string;
  mapKey: string; // BootScene の binary キー
  eventKey: string; // BootScene の text キー
  mapFile: string; // public/ 配下のパス
  eventFile: string;
}

export const STAGES: StageDef[] = [
  {
    index: 0,
    name: 'ステージ1 (Easy)',
    mapKey: 'map_0',
    eventKey: 'evt_0',
    mapFile: 'levels/map_easy01.map',
    eventFile: 'levels/event_easy01.evt',
  },
  {
    index: 1,
    name: 'ステージ2 (Medium)',
    mapKey: 'map_1',
    eventKey: 'evt_1',
    mapFile: 'levels/map_medium01.map',
    eventFile: 'levels/event_medium01.evt',
  },
  {
    index: 2,
    name: 'ステージ3 (Hard)',
    mapKey: 'map_2',
    eventKey: 'evt_2',
    mapFile: 'levels/map.map',
    eventFile: 'levels/event.evt',
  },
];
```

- [ ] **Step 4: テスト成功を確認**

Run: `npm test`
Expected: PASS（stages 3件 + 既存 MapLoader/EventLoader 6件）

- [ ] **Step 5: Commit**

```bash
git add src/game/stages.ts test/stages.test.ts
git commit -m "feat: 3ステージのレジストリ stages.ts"
```

---

## Task 2: クリア記録 (Progress.ts) — TDD

**Files:**
- Create: `src/game/Progress.ts`
- Test: `test/Progress.test.ts`

**Interfaces:**
- Consumes: `STAGES`（Task 1）
- Produces:
  - `interface StageProgress { cleared: boolean; gateless: boolean }`
  - `loadProgress(): StageProgress[]`（全ステージ分。未保存は `{cleared:false, gateless:false}`）
  - `getStageProgress(index: number): StageProgress`
  - `recordClear(index: number, gateless: boolean): void`（`cleared=true`、`gateless` は既存 true を維持）

- [ ] **Step 1: 失敗するテストを書く**

`test/Progress.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, recordClear, getStageProgress } from '../src/game/Progress';

// node 環境には localStorage が無いのでメモリ実装を注入する
function installMockStorage(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('Progress', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('未保存時は全ステージ未クリア', () => {
    const p = loadProgress();
    expect(p).toHaveLength(3);
    expect(p.every((s) => !s.cleared && !s.gateless)).toBe(true);
  });

  it('recordClear でクリア状態が保存される', () => {
    recordClear(1, false);
    expect(getStageProgress(1)).toEqual({ cleared: true, gateless: false });
    expect(getStageProgress(0).cleared).toBe(false);
  });

  it('一度ゲートレス達成したら以後 gateless を維持する', () => {
    recordClear(2, true);
    recordClear(2, false); // ゲート使用クリアでも
    expect(getStageProgress(2)).toEqual({ cleared: true, gateless: true });
  });

  it('localStorage が使えなくても例外を投げない', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined;
    expect(() => recordClear(0, true)).not.toThrow();
    expect(loadProgress().every((s) => !s.cleared)).toBe(true);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npm test`
Expected: FAIL（「Cannot find module '../src/game/Progress'」）

- [ ] **Step 3: 実装**

`src/game/Progress.ts`:

```ts
import { STAGES } from './stages';

const STORAGE_KEY = 'runaction:progress';

export interface StageProgress {
  cleared: boolean;
  gateless: boolean;
}

function emptyProgress(): StageProgress[] {
  return STAGES.map(() => ({ cleared: false, gateless: false }));
}

export function loadProgress(): StageProgress[] {
  const base = emptyProgress();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as StageProgress[];
    for (let i = 0; i < base.length; i++) {
      if (parsed[i]) {
        base[i] = { cleared: !!parsed[i].cleared, gateless: !!parsed[i].gateless };
      }
    }
  } catch {
    // localStorage 不可 / 破損時はデフォルトで続行
  }
  return base;
}

export function getStageProgress(index: number): StageProgress {
  return loadProgress()[index] ?? { cleared: false, gateless: false };
}

export function recordClear(index: number, gateless: boolean): void {
  const all = loadProgress();
  if (!all[index]) return;
  all[index] = {
    cleared: true,
    gateless: all[index].gateless || gateless, // 一度でもゲートレス達成なら維持
  };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // 保存不可でも進行は止めない
  }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npm test`
Expected: PASS（Progress 4件を含む全テスト）

Run: `npm run typecheck`
Expected: 型エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/game/Progress.ts test/Progress.test.ts
git commit -m "feat: クリア状況を localStorage に記録する Progress"
```

---

## Task 3: アセット・レベルデータの追加配置

**Files:**
- Create: `public/assets/title.png`, `title_logo.png`, `stamp.png`, `stamp_sub.png`, `button.png`
- Create: `public/levels/map_medium01.map`, `event_medium01.evt`, `map.map`, `event.evt`

- [ ] **Step 1: タイトル/選択用画像をコピー**

```bash
cd /Users/tsutsumi/hobby/RunActionRenew
SRC=/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res
cp "$SRC/drawable-nodpi/title.png"   public/assets/
cp "$SRC/drawable-hdpi/title_logo.png" public/assets/
cp "$SRC/drawable-hdpi/stamp.png"    public/assets/
cp "$SRC/drawable-hdpi/stamp_sub.png" public/assets/
cp "$SRC/drawable-nodpi/button.png"  public/assets/
ls public/assets/ | grep -E 'title|stamp|button'
```
Expected: `button.png title.png title_logo.png stamp.png stamp_sub.png` が並ぶ。

- [ ] **Step 2: ステージ2・3のレベルデータをコピー**

```bash
RAW=/Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/raw
cp "$RAW/map_medium01.map"   public/levels/
cp "$RAW/event_medium01.evt" public/levels/
cp "$RAW/map.map"            public/levels/
cp "$RAW/event.evt"          public/levels/
ls public/levels/
```
Expected: easy01 に加え `map_medium01.map event_medium01.evt map.map event.evt` が存在。

- [ ] **Step 3: サイズ検証**

```bash
for f in map_easy01:15003 map_medium01:18003 map:30003; do
  n="${f%%:*}"; want="${f##*:}"; got=$(wc -c < "public/levels/$n.map")
  echo "$n.map = $got (期待 $want) $([ "$got" = "$want" ] && echo OK || echo NG)"
done
```
Expected: 3つとも OK。

- [ ] **Step 4: Commit**

```bash
git add public/
git commit -m "assets: タイトル/選択UI画像とステージ2・3のレベルデータを配置"
```

---

## Task 4: GameScene のリファクタ（spawnEntities / wireOverlaps 抽出）

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Produces: private メソッド `spawnEntities(specs: EntitySpec[]): void`, `wireOverlaps(): void`（GameScene 内部のみ）

このタスクは**挙動を変えない純粋なリファクタ**。既存の easy01 プレイが従来どおり動くことを確認する。

- [ ] **Step 1: import に EntitySpec 型を追加**

`GameScene.ts` の import 行を更新:

```ts
import { parseEvents, type EntitySpec } from '../game/loaders/EventLoader';
```

- [ ] **Step 2: create() のエンティティ生成〜overlap 配線を2メソッドに置換**

`create()` 内の「イベントからエンティティ生成」ブロック（`const specs = parseEvents(...)` から `this.physics.add.overlap(this.player, this.gates, ...)` の閉じ括弧まで、現在の 82〜123 行相当）を、次の3行に置き換える:

```ts
    // イベントからエンティティ生成
    const specs = parseEvents(this.cache.text.get('events') as string);
    this.spawnEntities(specs);
    this.wireOverlaps();
```

- [ ] **Step 3: spawnEntities / wireOverlaps メソッドを追加**

`createAnims()` メソッドの直前に追加:

```ts
  private spawnEntities(specs: EntitySpec[]): void {
    this.enemies = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.springs = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();

    for (const s of specs) {
      // .evt のタイル座標は左上基準。Phaser のスプライトはデフォルト origin=0.5(中心)なので
      // タイル中心に配置してズレを防ぐ
      const px = s.tileX * TILE_SIZE + TILE_SIZE / 2;
      const py = s.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (s.type === 'ENEMY') {
        const e = this.enemies.create(px, py, 'kuri', 0) as Phaser.Physics.Arcade.Sprite;
        e.setVelocityX(-ENEMY_SPEED);
        e.anims.play('kuri-walk', true);
      } else if (s.type === 'NEEDLE') {
        this.hazards.create(px, py, 'toge');
      } else if (s.type === 'SPRING') {
        this.springs.create(px, py, 'spring', 0);
      } else if (s.type === 'GATE') {
        this.gates.create(px, py, 'gate');
      }
    }
  }

  private wireOverlaps(): void {
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.onEnemyOverlap(e as Phaser.Physics.Arcade.Sprite);
    });
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
  }
```

- [ ] **Step 4: 検証**

Run: `npm run typecheck`
Expected: 型エラーなし

Run: `npm test`
Expected: 既存テスト全 PASS（挙動不変）

Run: `npm run build`
Expected: 成功

（コントローラ確認: easy01 が従来どおり自動走行・ジャンプ・敵/針/バネ/ゲート・ゴールで遊べる）

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "refactor: GameScene のエンティティ生成/overlap配線を spawnEntities/wireOverlaps へ抽出"
```

---

## Task 5: ステージ切替対応（BootScene 全ステージ preload + GameScene stageIndex + クリア記録）

**Files:**
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/config.ts`

**Interfaces:**
- Consumes: `STAGES`（Task 1）、`recordClear`（Task 2）
- Produces: `GameScene.init(data?: { stageIndex?: number })`、cache キー `map_0/1/2`・`evt_0/1/2`

- [ ] **Step 1: config.ts から未使用の LEVEL を撤去**

`src/config.ts` の最終行 `export const LEVEL = 'easy01';` を削除する。

- [ ] **Step 2: BootScene を全ステージ + UI画像 preload に更新**

`src/scenes/BootScene.ts` を全置換:

```ts
import Phaser from 'phaser';
import { STAGES } from '../game/stages';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload(): void {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('yama', 'assets/yama.png');
    this.load.image('toge', 'assets/toge.png');
    this.load.image('gate', 'assets/gate.png');
    this.load.image('mapTiles', 'assets/map.png');
    this.load.image('gameclear', 'assets/gameclear.png');
    this.load.image('gameover', 'assets/gameover.png');
    this.load.image('title', 'assets/title.png');
    this.load.image('title_logo', 'assets/title_logo.png');
    this.load.image('stamp', 'assets/stamp.png');
    this.load.image('stamp_sub', 'assets/stamp_sub.png');
    this.load.image('button', 'assets/button.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: 32, frameHeight: 32 });
    for (const stage of STAGES) {
      this.load.binary(stage.mapKey, stage.mapFile);
      this.load.text(stage.eventKey, stage.eventFile);
    }
  }
  create(): void {
    // Task 6 で 'Title' に変更する
    this.scene.start('Game');
  }
}
```

- [ ] **Step 3: GameScene に stageIndex / usedGate / クリア記録を追加**

`GameScene.ts` の import に追加:

```ts
import { STAGES } from '../game/stages';
import { recordClear } from '../game/Progress';
```

プロパティ追加（`private goalX = 0;` の下）:

```ts
  private stageIndex = 0;
  private usedGate = false;
```

`constructor()` の下に `init` を追加:

```ts
  init(data?: { stageIndex?: number }): void {
    this.stageIndex = data?.stageIndex ?? 0;
  }
```

`create()` 冒頭の状態リセットに `usedGate` を追加:

```ts
    this.isEnded = false;
    this.pointerJump = false;
    this.forceJump = false;
    this.usedGate = false;
```

タイルマップ読込を stageIndex 参照に変更（現在の `const parsed = parseMap(this.cache.binary.get('mapbin') as ArrayBuffer);`）:

```ts
    const stage = STAGES[this.stageIndex];
    const parsed = parseMap(this.cache.binary.get(stage.mapKey) as ArrayBuffer);
```

イベント読込を stageIndex 参照に変更（現在の `const specs = parseEvents(this.cache.text.get('events') as string);`）:

```ts
    const specs = parseEvents(this.cache.text.get(stage.eventKey) as string);
```

- [ ] **Step 4: ゲート使用フラグを立てる**

`wireOverlaps()` のゲート overlap を更新:

```ts
    this.physics.add.overlap(this.player, this.gates, (_p, g) => {
      const gate = g as Phaser.Physics.Arcade.Sprite;
      this.usedGate = true;
      this.checkpointX = gate.x;
      this.checkpointY = gate.y - TILE_SIZE * 2;
    });
```

- [ ] **Step 5: クリア時に記録し、リトライは同ステージを再開する**

`clear()` を更新:

```ts
  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
    recordClear(this.stageIndex, !this.usedGate);
    this.showOverlay('gameclear');
  }
```

`showOverlay()` の restart 2箇所を、同ステージ再開に更新:

```ts
    this.input.once('pointerdown', () => this.scene.restart({ stageIndex: this.stageIndex }));
    this.input.keyboard!.once('keydown', () => this.scene.restart({ stageIndex: this.stageIndex }));
```

- [ ] **Step 6: 検証**

Run: `npm run typecheck`
Expected: 型エラーなし（LEVEL 撤去に伴う未解決 import が無いこと）

Run: `npm test`
Expected: 全 PASS

Run: `npm run build`
Expected: 成功

（コントローラ確認: stage 0 が新パスで起動・プレイでき、クリアすると localStorage `runaction:progress` に stage0 の cleared が記録される。ゲートを使わずクリアで gateless=true、使うと false。）

- [ ] **Step 7: Commit**

```bash
git add src/scenes/BootScene.ts src/scenes/GameScene.ts src/config.ts
git commit -m "feat: ステージ切替対応(全ステージpreload/stageIndex/クリア記録)"
```

---

## Task 6: TitleScene

**Files:**
- Create: `src/scenes/TitleScene.ts`
- Modify: `src/main.ts`
- Modify: `src/scenes/BootScene.ts`

**Interfaces:**
- Consumes: 画像 `title`/`title_logo`（Boot でロード済み）
- Produces: シーンキー `'Title'`（タップ/キーで `'StageSelect'` へ遷移）

- [ ] **Step 1: TitleScene を作成**

`src/scenes/TitleScene.ts`:

```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }
  create(): void {
    this.add.image(0, 0, 'title').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'title_logo').setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, 'タップでスタート', {
        color: '#ffffff',
        fontSize: '32px',
      })
      .setOrigin(0.5);

    const go = () => this.scene.start('StageSelect');
    this.input.once('pointerdown', go);
    this.input.keyboard!.once('keydown', go);
  }
}
```

- [ ] **Step 2: main.ts に TitleScene を登録**

`src/main.ts` の import に追加:

```ts
import { TitleScene } from './scenes/TitleScene';
```

`scene:` 配列を更新（Boot の次を Title に）:

```ts
  scene: [BootScene, TitleScene, GameScene],
```

- [ ] **Step 3: BootScene の遷移先を Title に変更**

`src/scenes/BootScene.ts` の `create()`:

```ts
  create(): void {
    this.scene.start('Title');
  }
```

- [ ] **Step 4: 検証**

Run: `npm run typecheck`
Expected: 型エラーなし

Run: `npm run build`
Expected: 成功

（コントローラ確認: 起動すると背景 title.png + ロゴ + 「タップでスタート」が表示される。タップで StageSelect へ遷移しようとする ※StageSelect は Task 7 で追加のため、この時点ではタップ後にエラーになり得る。表示自体を確認する）

- [ ] **Step 5: Commit**

```bash
git add src/scenes/TitleScene.ts src/main.ts src/scenes/BootScene.ts
git commit -m "feat: タイトル画面(TitleScene)"
```

---

## Task 7: StageSelectScene

**Files:**
- Create: `src/scenes/StageSelectScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `STAGES`（Task 1）、`loadProgress`（Task 2）、画像 `sky`/`button`/`stamp`/`stamp_sub`
- Produces: シーンキー `'StageSelect'`（各ステージボタン→`scene.start('Game', { stageIndex })`、戻る→`'Title'`）

- [ ] **Step 1: StageSelectScene を作成**

`src/scenes/StageSelectScene.ts`:

```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { STAGES } from '../game/stages';
import { loadProgress } from '../game/Progress';

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }
  create(): void {
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add
      .text(GAME_WIDTH / 2, 120, 'ステージ選択', { color: '#ffffff', fontSize: '40px' })
      .setOrigin(0.5);

    const progress = loadProgress();
    STAGES.forEach((stage, i) => {
      const y = 280 + i * 140;
      const btn = this.add
        .image(GAME_WIDTH / 2, y, 'button')
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GAME_WIDTH / 2, y, stage.name, { color: '#000000', fontSize: '24px' })
        .setOrigin(0.5);
      if (progress[i].cleared) {
        this.add
          .image(GAME_WIDTH / 2 + 130, y, progress[i].gateless ? 'stamp' : 'stamp_sub')
          .setOrigin(0.5)
          .setScale(0.6);
      }
      btn.on('pointerup', () => this.scene.start('Game', { stageIndex: stage.index }));
    });

    const back = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, '← タイトルへ', {
        color: '#ffffff',
        fontSize: '26px',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Title'));
  }
}
```

- [ ] **Step 2: main.ts に StageSelectScene を登録**

`src/main.ts` の import に追加:

```ts
import { StageSelectScene } from './scenes/StageSelectScene';
```

`scene:` 配列を更新:

```ts
  scene: [BootScene, TitleScene, StageSelectScene, GameScene],
```

- [ ] **Step 3: 検証**

Run: `npm run typecheck`
Expected: 型エラーなし

Run: `npm run build`
Expected: 成功

（コントローラ確認: Title→タップ→StageSelect に3ステージのボタン + 「タイトルへ」表示。各ボタンで対応ステージが起動。クリア済みステージにスタンプ表示。戻るで Title へ。3ステージすべて描画・プレイできる。stage3(col=1000) のスクロールも確認）

- [ ] **Step 4: Commit**

```bash
git add src/scenes/StageSelectScene.ts src/main.ts
git commit -m "feat: ステージ選択画面(StageSelectScene)・クリアスタンプ表示"
```

---

## Task 8: クリア結果2択とゲーム中の戻る導線

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: シーンキー `'StageSelect'`（Task 7）
- Produces: なし（GameScene 内部の導線のみ）

- [ ] **Step 1: create() にゲーム中の戻るボタンを追加**

`GameScene.ts` の `create()` 末尾、デバッグフックの直前に追加:

```ts
    // ゲーム中: 選択画面へ戻る
    const backBtn = this.add
      .text(16, 16, '≪ 選択', {
        color: '#ffffff',
        fontSize: '22px',
        backgroundColor: '#00000080',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerup', () => this.scene.start('StageSelect'));
```

- [ ] **Step 2: clear() のクリア演出を2択に差し替える**

`clear()` の `this.showOverlay('gameclear');` を次に変更:

```ts
    this.showResult();
```

- [ ] **Step 3: showOverlay を showResult（リトライ / ステージ選択の2択）に置き換える**

`showOverlay(textureKey: string)` メソッド全体を、次の `showResult()` に置き換える:

```ts
  private showResult(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    this.add
      .image(cx, cy - 80, 'gameclear')
      .setScrollFactor(0)
      .setDepth(100)
      .setScale(0.6);

    const makeButton = (dy: number, label: string, onClick: () => void) => {
      this.add
        .text(cx, cy + dy, label, {
          color: '#ffffff',
          fontSize: '30px',
          backgroundColor: '#333333',
          padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', onClick);
    };

    makeButton(120, 'リトライ', () => this.scene.restart({ stageIndex: this.stageIndex }));
    makeButton(190, 'ステージ選択へ', () => this.scene.start('StageSelect'));
  }
```

（注: これにより Task 5 で `showOverlay` に残していた `input.once('pointerdown'/'keydown')` の全画面リスタートは廃止され、明示的なボタン操作に統一される。`void img;` の不要コードも解消される。）

- [ ] **Step 4: 検証**

Run: `npm run typecheck`
Expected: 型エラーなし（`showOverlay` への参照が残っていないこと）

Run: `npm test`
Expected: 全 PASS

Run: `npm run build`
Expected: 成功

（コントローラ確認: クリアで「リトライ / ステージ選択へ」の2択表示。リトライで同ステージ再開、選択へで StageSelect。ゲーム中は左上「≪ 選択」で StageSelect へ。Title→Select→各ステージ→クリア→スタンプ反映→戻る、の一連が通る）

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: クリア結果の2択(リトライ/選択へ)とゲーム中の戻る導線"
```

---

## 完了条件

- `npm test` 全パス（stages / Progress / MapLoader / EventLoader）
- `npm run typecheck` / `npm run build` クリーン
- Title → StageSelect → 3ステージ各々のプレイ → クリア（gameclear 2択）→ スタンプが選択画面へ反映 → 戻る導線、の一連がブラウザで動作
- ゲート未使用クリアで `stamp`、使用クリアで `stamp_sub` が出し分けられ、リロード後も localStorage から復元される
