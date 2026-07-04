# ポーズメニュー 設計ドキュメント（原作準拠）

- 作成日: 2026-07-04
- 対象: ポーズ挙動を原作に合わせる
- 方針: 原作 `GameMode` のポーズ SubMode（CONTINUE / RESTART / TITLE）に合わせる

## 背景（原作 vs 現Web版）

- **原作**: 左上ポーズボタン → ポーズ状態へ遷移（ゲーム停止）。メニューに **CONTINUE / RESTART / TITLE** の3ボタン。
- **現Web版（変更前）**: ポーズボタン → 即ステージ選択へ遷移（停止もメニューも無い）。

→ 異なるため、原作に合わせる。退出先は原作どおり **タイトルへ**（Web版のステージ選択ではなく Title）。

## 実装

- **`ui/overlays.ts` に `showPause(scene, {onContinue, onRestart, onTitle})`** を追加。半透明の暗転＋「ポーズ」テキスト＋`button_large` の3ボタン（続ける/リスタート/タイトルへ）を生成し、生成オブジェクト配列を返す（再開時に destroy するため）。
- **`GameScene`**:
  - `isPaused` フラグと `pauseObjects` を追加。
  - ポーズボタン onClick を `pauseGame()` に変更（従来の `scene.start('StageSelect')` を置換）。
  - `pauseGame()`: `physics.pause()` ＋ `showPause(...)`。
  - `resumeGame()`（続ける）: メニュー destroy ＋ `player.resetJumpInput()` ＋ `physics.resume()`。
  - リスタート: `scene.restart({ stageIndex })`（最初から）。タイトルへ: `scene.start('Title')`。
  - `update()` は `if (this.isEnded || this.isPaused) return;` で停止中は進行しない。
  - `create()` 冒頭で `isPaused`/`pauseObjects` をリセット（restart 対応）。
- **`PlayerController` に `resetJumpInput()`** を追加。「続ける」タップの pointerdown で溜まるジャンプ入力を捨て、再開直後の暴発ジャンプを防ぐ。

## スコープ

### 含む
- 原作準拠のポーズ（停止＋続ける/リスタート/タイトルへ）。

### 含まない
- BGM の一時停止（BGM 未実装）、standby（開始前待機）など他の原作要素。

## テスト方針

- Playwright: ポーズで敵/プレイヤーが停止しメニュー表示、続ける→再開（物理再開・メニュー消滅・暴発ジャンプ無し）、リスタート→最初から、タイトルへ→Title 遷移 を確認。
- 既存 Vitest グリーン維持。
