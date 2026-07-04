# ステージ進捗バー 設計ドキュメント

- 作成日: 2026-07-04
- 対象: 原作の進捗バー（`bar_base.png` / `bar_progress.png`）を Web 版に実装
- 前提: タイトル/ステージ選択/3ステージ/クリア記録/ボタン画像化まで実装済み

## 目的

原作 `Map.java` の `ProgressBar` を Web 版に移植。プレイ中にステージのどこまで進んだか（`playerX / goalX`）を画面上部で示す。

## アセット

- `bar_base.png`（300×50）: 進捗トラックの枠
- `bar_progress.png`（32×64）: 現在位置を指す下向きピン
- いずれも原作 `res/drawable-nodpi` から `public/assets/` へ配置。

## 実装（GameScene 内）

画面上部・中央に固定表示（`scrollFactor 0`）。左上のポーズボタンとは横方向に重ならない。

- **基盤**: `bar_base` を中央 `(GAME_WIDTH/2, 60)` に配置（depth 40）。
- **赤い塗り**: `Rectangle`（赤）を内側左端起点（`origin(0, 0.5)`）に置き、`scaleX = progress` で伸縮（depth 41）。原作の赤い進捗線に相当。
- **ピン**: `bar_progress` をバー上に重ね、`x = innerLeft + progress * innerWidth` でスライド（depth 42）。
- **進捗**: `progress = Phaser.Math.Clamp(player.x / goalX, 0, 1)`。
- レイアウト定数: `BAR_W=300`, `BAR_PAD=6`, `BAR_CENTER_Y=60`。内側幅 = `BAR_W - BAR_PAD*2 = 288`。

`update()` の先頭で `updateProgressBar()` を呼び、毎フレーム反映（`isEnded` ガードより前に呼ぶため、ゴール到達時も満タンを反映）。`scene.restart()` 時は `create()` で作り直し。

## スコープ

### 含む
- 上記の進捗バー（基盤＋赤塗り＋ピン）の表示と毎フレーム更新、BootScene でのアセットプリロード。

### 含まない
- 到達率の永続化・表示（原作の `maxReach`）、BGM/SFX、スター等。

## テスト方針

- ブラウザ確認（Playwright）: 任意進捗（0/50/60/100%）でのピン位置・赤塗り幅・描画。数値（`progressFill.scaleX` / `progressPin.x`）が `player.x / goalX` と一致することを確認。
- 既存ユニットテスト（stages/Progress/loaders）に影響なし。
