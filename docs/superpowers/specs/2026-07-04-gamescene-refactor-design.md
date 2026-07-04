# GameScene リファクタリング 設計ドキュメント

- 作成日: 2026-07-04
- 対象: 肥大化した `GameScene`（420行）を、責務ごとに分割して整理する
- 方針: **挙動不変のリファクタ**。段階的に A → B → C を実施（本ドキュメントは全体方針＋案Aの内容）

## 背景

`GameScene` が 420行・約24フィールド・18メソッドに肥大化し、複数の責務（レベル構築／エンティティ生成／衝突挙動／プレイヤー操作／アニメ登録／進捗バーUI／進行・演出）が混在していた。

## 段階方針

- **案A（本PR）**: UI/演出・アニメの抽出（自己完結度が高く低リスク）。
- **案B（後続）**: レベル/エンティティ生成層の抽出（`LevelBuilder` 等）。
- **案C（後続）**: プレイヤー操作の集約（`PlayerController`）。

## 案A の内容（本PR）

以下を新規モジュールへ抽出し、`GameScene` から委譲する（挙動は不変）。

- **`src/ui/ProgressBar.ts`（class）**: 進捗バー（基盤＋赤い塗り＋ピン）。`new ProgressBar(scene, goalX)` と `update(playerX)`。レイアウト定数（BAR_W 等）も本ファイルへ移動。
- **`src/ui/overlays.ts`（関数）**: `showGameClear(scene, {onRetry, onSelect})` / `showGameOver(scene, {onRetry, onSelect})`。gameclear/gameover 画像・暗転フェード・2択ボタン生成を集約。
- **`src/game/anims.ts`**: `registerAnims(scene)`（run/jump/kuri-walk のアニメ登録、重複ガード付き）。

`GameScene` 側:
- `createProgressBar`/`updateProgressBar` → `ProgressBar` に委譲。
- `showGameOver`/`showGameOverUI`/`showResult` → `overlays` の関数呼び出しに置換（コールバックで restart/StageSelect 遷移を渡す）。
- `createAnims` → `registerAnims(this)`。
- 死亡演出（`die`/`playDeathAnimation`）や進行制御（`clear`）自体はシーンに残し、UI表示のみ委譲。

結果: `GameScene` 420 → 301行（約120行削減）。

## スコープ

### 含む（案A）
- 上記3モジュールの抽出と `GameScene` からの委譲。挙動不変。

### 含まない
- 案B/C（レベル生成層・PlayerController の抽出）は後続サイクル。
- 機能追加・挙動変更は一切なし。

## テスト方針

- 既存 Vitest（stages/Progress/loaders）グリーン維持。
- Playwright 回帰: 進捗バー（50%で fill.scaleX=0.5）、ゲームオーバー画面（暗転＋gameover＋2択）、クリア画面（gameclear＋2択）が従来どおり表示されることを確認。
