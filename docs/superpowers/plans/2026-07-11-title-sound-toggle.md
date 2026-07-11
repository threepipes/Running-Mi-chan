# タイトルのサウンドON/OFF + 音符 + みーちゃんsleep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイトル画面に原作準拠のサウンド(BGM/SE)ON/OFFトグル、ラジオの音符アニメ、みーちゃんの寝ポーズ+起きて走り出す開始アニメを追加する。ページを開いた初期状態はサウンドOFF。

**Architecture:** サウンドは Phaser の `game.sound.mute`(グローバル)を master スイッチとして使い、BGM/SE を一括制御。初期 `mute=true`(OFF)。タイトルの専用トグルボタンで反転し、ONにした瞬間に opening BGM を起動、音符スプライトを表示する。みーちゃんは player スプライトを重ねて寝ポーズで待機し、スタートで tween により 起きる→ジャンプ→着地→右向き→走り→画面外 を再生してから StageSelect へ遷移する。

**Tech Stack:** TypeScript / Phaser 3.90 / Vite 5 / Vitest

## Global Constraints

- 画面・座標系は 540×960(`GAME_WIDTH`/`GAME_HEIGHT`)。原作座標をそのまま使う。
- player スプライトは 32×32 の 4×4=16フレーム。フレーム index = 行*4 + 列。タイトルで使うフレーム(原作 TitleView 準拠):
  - 寝てる=11(列3,行2) / 起きる=13(列1,行3) / 垂直ジャンプ=12(列0,行3) / 着地=5(列1,行1) / 右向き=6(列2,行1) / 走る=0,1,2,3(行0)
- `music.png` は 64×32(32px×2フレーム)。音符アニメは 2フレーム・各0.5秒(frameRate 2)ループ。原作描画位置 (150, 840)。みーちゃん位置 (98, 828)。
- サウンドは master(BGM も SE も一括)。個別制御はしない。
- **初期状態 OFF(`mute=true`)。永続化しない**(リロードで毎回OFF)。
- 既存の音声キー(`bgm_opening` / `bgm` / `bgm_stage2` / `bgm_stage3` / `se_jump` / `se_damaged` / `se_spring` / `se_clear`)は変更しない。
- テストは `/test/*.test.ts`、vitest globals・node環境。シーン/Phaser依存の検証は Playwright + typecheck/build で行う。
- ブランチ `feat/title-sound-toggle`。main へ直接 commit/push しない。

---

### Task 1: サウンド master トグル(初期OFF)とヘルパー

**Files:**
- Modify: `src/main.ts`(ゲーム生成直後に `game.sound.mute = true`)
- Create: `src/game/audio/soundSetting.ts`

**Interfaces:**
- Produces: `isSoundOn(sound: Phaser.Sound.BaseSoundManager): boolean` — `!sound.mute`
- Produces: `toggleSound(scene: Phaser.Scene): boolean` — mute を反転し、ONにした場合は opening BGM を起動。反転後の「ONか」を返す。

- [ ] **Step 1: ヘルパーを作成**

`src/game/audio/soundSetting.ts`:
```ts
import Phaser from 'phaser';
import { playOpeningBgm } from './openingBgm';

/** 現在サウンドが有効(ミュート解除)か。 */
export function isSoundOn(sound: Phaser.Sound.BaseSoundManager): boolean {
  return !sound.mute;
}

/**
 * サウンドの ON/OFF を反転する。master トグル(BGM/SE 一括)。
 * ON にした場合はタイトル/選択画面のオープニングBGMを起動する。
 * @returns 反転後にサウンドが ON なら true
 */
export function toggleSound(scene: Phaser.Scene): boolean {
  const on = scene.sound.mute; // 現在ミュート → これから ON
  scene.sound.mute = !on;
  if (on) playOpeningBgm(scene);
  return on;
}
```

- [ ] **Step 2: main.ts で初期 OFF を設定**

`src/main.ts` の `const game = new Phaser.Game({...});` の直後(fitToViewport 定義より前)に追加:
```ts
// サウンドは既定 OFF(ミュート)。ブラウザは初回タップ前に音を鳴らせないため、
// 既定OFFにしてタイトルで手動ONにする。master(BGM/SE一括)。
game.sound.mute = true;
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: エラー0。

- [ ] **Step 4: Commit**

```bash
git add src/game/audio/soundSetting.ts src/main.ts
git commit -m "feat: サウンドmasterトグル(初期OFF)とヘルパーを追加"
```

---

### Task 2: music.png アセット + ロード + 音符アニメ登録

**Files:**
- Create: `public/assets/music.png`(原作 `res/drawable-nodpi/music.png` からコピー)
- Modify: `src/scenes/BootScene.ts`(spritesheet ロード追加)
- Modify: `src/game/anims.ts`(`music-note` アニメ登録)

**Interfaces:**
- Produces: テクスチャキー `music`(spritesheet 32×32, 2フレーム)
- Produces: アニメキー `music-note`(frames [0,1], frameRate 2, repeat -1)

- [ ] **Step 1: music.png をコピー**

```bash
cp /Users/tsutsumi/ghq/github.com/threepipes/RunAction/res/drawable-nodpi/music.png public/assets/music.png
file public/assets/music.png   # PNG 64 x 32 であることを確認
```

- [ ] **Step 2: BootScene で spritesheet をロード**

`src/scenes/BootScene.ts` の `preload()` 内、既存 spritesheet 群(`spring` の行)の直後に追加:
```ts
    this.load.spritesheet('music', 'assets/music.png', { frameWidth: 32, frameHeight: 32 });
```

- [ ] **Step 3: 音符アニメを登録**

`src/game/anims.ts` の `registerAnims` 内、`spring-bounce` 登録の直後(関数末尾)に追加:
```ts
  // ラジオの音符(music.png 2フレーム)。各0.5秒でループ(原作: 30tick/frame @60fps)。
  scene.anims.create({
    key: 'music-note',
    frames: scene.anims.generateFrameNumbers('music', { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });
```

- [ ] **Step 4: 型チェック + ビルド**

Run: `npm run typecheck && npm run build`
Expected: 成功(music.png が dist にコピーされる)。

- [ ] **Step 5: Commit**

```bash
git add public/assets/music.png src/scenes/BootScene.ts src/game/anims.ts
git commit -m "feat: 音符画像(music.png)のロードとアニメ登録を追加"
```

---

### Task 3: タイトルにトグルボタン・音符・みーちゃん寝ポーズを追加

**Files:**
- Modify: `src/ui/button.ts`(ラベル Text に名前を付与し、後から更新可能にする)
- Modify: `src/scenes/TitleScene.ts`

**Interfaces:**
- Consumes: `isSoundOn` / `toggleSound`(Task 1)、`music-note` アニメ・`music` テクスチャ(Task 2)、`registerAnims`
- Produces: なし(タイトル内で完結)

この段階では「スタート」は従来どおり即 `StageSelect` へ遷移(開始シーケンスは Task 4)。

- [ ] **Step 1: button.ts のラベルに名前を付ける**

`src/ui/button.ts` の label 生成箇所を変更:
```ts
  if (label) {
    const text = scene.add
      .text(0, 0, label, { color: '#ffffff', fontSize })
      .setOrigin(0.5)
      .setName('label'); // 呼び出し側が container.getByName('label') で参照/更新できるように
    parts.push(text);
  }
```
(既存の戻り値 `Container` は不変。非破壊。)

- [ ] **Step 2: TitleScene に音符・みーちゃん・トグルを追加**

`src/scenes/TitleScene.ts` を以下に置き換え:
```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { createImageButton } from '../ui/button';
import { registerAnims } from '../game/anims';
import { isSoundOn, toggleSound } from '../game/audio/soundSetting';

// 原作準拠の配置(540×960 座標系)
const PLAYER_X = 98;
const PLAYER_Y = 828;
const NOTE_X = 150;
const NOTE_Y = 840;
const SLEEP_FRAME = 11;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    registerAnims(this);

    this.add.image(0, 0, 'title').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'title_logo').setOrigin(0.5);

    // みーちゃん(寝ポーズで待機)
    this.add.image(PLAYER_X, PLAYER_Y, 'player', SLEEP_FRAME).setOrigin(0, 0);

    // ラジオの音符(サウンドONのときだけ表示・アニメ)
    const note = this.add.sprite(NOTE_X, NOTE_Y, 'music', 0).setOrigin(0, 0);
    note.play('music-note');
    note.setVisible(isSoundOn(this.sound));

    // サウンド ON/OFF トグル(専用ボタン)
    const soundBtn = createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.85,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: isSoundOn(this.sound) ? 'サウンド ON' : 'サウンド OFF',
      onClick: () => {
        const on = toggleSound(this);
        note.setVisible(on);
        const text = soundBtn.getByName('label') as Phaser.GameObjects.Text;
        text.setText(on ? 'サウンド ON' : 'サウンド OFF');
      },
    });

    // スタート(この段階では即遷移。開始シーケンスは Task 4 で差し替え)
    const go = () => this.scene.start('StageSelect');
    createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.7,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: 'スタート',
      onClick: go,
    });
    this.input.keyboard!.once('keydown', go);
  }
}
```
(注: 従来 `playOpeningBgm(this)` を無条件で呼んでいたが、初期OFFのため削除。BGMはサウンドONトグル時に `toggleSound` 内で起動する。)

- [ ] **Step 3: 型チェック + ビルド**

Run: `npm run typecheck && npm run build`
Expected: エラー0・成功。

- [ ] **Step 4: Playwright で検証(コントローラが実施)**

dev サーバを起動し、ブラウザで:
1. 初期表示: `window.__game.sound.mute === true`(OFF)。音符スプライトが非表示。ボタンラベル「サウンド OFF」。みーちゃんが寝ポーズ(frame 11)で (98,828) に表示。スクショで目視。
2. サウンドボタン押下 → `mute === false`、音符が表示されアニメ、`bgm_opening` が再生中(`sound.get('bgm_opening').isPlaying`)、ラベル「サウンド ON」。
3. 再度押下 → `mute === true`、音符非表示、ラベル「サウンド OFF」。
4. スタート押下 → StageSelect に遷移。
- スクショで sleep ポーズ・音符位置(ラジオ上)を確認。フレーム11が寝姿でなければ Global Constraints のフレーム表を実画像で再確認し修正。

- [ ] **Step 5: Commit**

```bash
git add src/ui/button.ts src/scenes/TitleScene.ts
git commit -m "feat: タイトルにサウンドトグル・音符・みーちゃん寝ポーズを追加"
```

---

### Task 4: スタート時の開始シーケンス(起きる→走り出し→画面外)

**Files:**
- Modify: `src/scenes/TitleScene.ts`

**Interfaces:**
- Consumes: player フレーム(11/13/12/5/6/0-3)、`run` アニメ(registerAnims)、`se_jump`
- Produces: なし

原作 TitleView のシーケンス(STOP→起きる→ジャンプ+SE→着地→右向き→WALK→画面外)を Phaser の tween/delayedCall で近似する。物理は厳密移植せず見た目を合わせる。

- [ ] **Step 1: みーちゃんを sprite にして開始シーケンスを実装**

`src/scenes/TitleScene.ts` を修正:
- みーちゃんを `this.add.image(...)` から `this.add.sprite(PLAYER_X, PLAYER_Y, 'player', SLEEP_FRAME).setOrigin(0, 0)` に変更し、フィールド参照を持つ。
- 再入力防止フラグ `private started = false;` を追加。
- `go` を開始シーケンス実行に差し替え:

```ts
  private started = false;

  private startSequence(player: Phaser.GameObjects.Sprite): void {
    if (this.started) return;
    this.started = true;
    this.input.keyboard!.removeAllListeners('keydown');

    const groundY = player.y;
    // 起きる
    player.setFrame(13);
    this.time.delayedCall(333, () => {
      // ジャンプ(+SE。muteならPhaserが自動で無音)
      player.setFrame(12);
      this.sound.play('se_jump');
      this.tweens.add({
        targets: player,
        y: groundY - 70,
        duration: 220,
        ease: 'Quad.easeOut',
        yoyo: true,
        onComplete: () => {
          // 着地
          player.setFrame(5);
          this.time.delayedCall(167, () => {
            // 右向き
            player.setFrame(6);
            this.time.delayedCall(333, () => {
              // 走り出し → 画面外
              player.play('run');
              this.tweens.add({
                targets: player,
                x: GAME_WIDTH + 40,
                duration: 1500,
                ease: 'Linear',
                onComplete: () => this.scene.start('StageSelect'),
              });
            });
          });
        },
      });
    });
  }
```
- `create()` 内: みーちゃん sprite を変数 `player` で保持。`go` を `() => this.startSequence(player)` に変更。スタートボタンの `onClick` とキーボード `once('keydown', ...)` を両方これに向ける。

- [ ] **Step 2: 型チェック + ビルド**

Run: `npm run typecheck && npm run build`
Expected: エラー0・成功。

- [ ] **Step 3: Playwright で検証(コントローラが実施)**

1. スタート押下後、みーちゃんが 起きる→跳ねる→着地→右向き→右へ走って画面外 に動くことをスクショ(複数時点)で確認。
2. シーケンス完了後に StageSelect へ遷移すること。
3. サウンドON状態でスタートすると跳躍時に `se_jump` が鳴る(muteでは鳴らない)。
4. 開始中に再度スタート/キーを押しても多重発火しない(`started` ガード)。

- [ ] **Step 4: Commit**

```bash
git add src/scenes/TitleScene.ts
git commit -m "feat: タイトルのスタート時に起きる→走り出しの開始アニメを再生"
```

---

## Self-Review

- **Spec coverage**: master トグル+初期OFF(Task1)/ 音符アセット・アニメ(Task2)/ トグルボタン・音符表示・sleepポーズ(Task3)/ 開始シーケンス(Task4)/ opening BGM の ON起動化(Task1 toggleSound + Task3 で無条件playを削除)/ iOS は既存 resume 対応で担保(検証項目に含む)。
- **Placeholder scan**: なし(全コード実体記載)。ボタン配置 y は 0.7/0.85 で明示。
- **Type consistency**: `isSoundOn(sound)` / `toggleSound(scene): boolean` は Task1定義=Task3利用で一致。フレーム index(11/13/12/5/6/0-3)は Global Constraints と各タスクで一致。`music`/`music-note` キーは Task2定義=Task3利用で一致。`container.getByName('label')` は Task3 Step1 の `setName('label')` と対応。
