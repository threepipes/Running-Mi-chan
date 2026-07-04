# GameScene リファクタリング 案C 設計ドキュメント

- 作成日: 2026-07-04
- 対象: プレイヤー操作の集約（案C / PlayerController）
- 前提: 案A（UI/演出抽出）・案B（LevelBuilder）は完了・main にマージ済み
- 方針: **挙動不変のリファクタ**（update ループ・死亡フローに絡むため回帰確認を厚めに実施）

## 内容（案C）

プレイヤー(mi-chan)の操作・状態・演出を `src/game/PlayerController.ts` に集約する。

`PlayerController` が持つもの:
- `sprite`（Arcade Sprite）とレイヤーとの衝突設定
- ジャンプ入力（Space/Up/タップ）と `consumeJump`、`forceJump` 状態
- `update()`: 自動前進 + ジャンプ処理 + run/jump アニメ
- `bounce(velocity)`: バネ/踏みつけの跳ね上げ（空中再ジャンプ許可）
- `playDeath(onComplete)`: 死亡ポーズ(frame7)→跳ね→画面下へ落下→コールバック
- 参照用: `x` / `y` / `isBlockedRight()`

GameScene に残すもの（ゲームルール）:
- 死亡条件（壁激突 `isBlockedRight()` / 落下 `y > worldHeight`）とゴール条件（`x >= goalX`）
- 衝突配線 `wireOverlaps`（踏みつけ判定 `onEnemyOverlap`、バネ→`bounce`、ゲート→チェックポイント）
- 進行制御（`die`/`clear`）、物理停止・再開、カメラ追従、オーバーレイ表示

`die()` は `physics.pause()` + `stopFollow()` の後に `player.playDeath(onComplete)` を呼ぶ形に。

結果: `GameScene` 265 → 204行。420行から通算で半減。

## スコープ

### 含む
- `PlayerController` の新規作成と GameScene からの委譲。挙動不変。

### 含まない
- 機能追加・挙動変更なし。衝突配線・進行制御はシーンに残す。

## テスト方針

- 既存 Vitest グリーン維持。
- Playwright 回帰（厚め）: 自動前進、ジャンプ（上向き速度）、踏みつけ（敵-1）、バネ（強い上方速度）、壁/落下死→死亡ポーズ(frame7)＋落下演出＋ゲームオーバー画面、リトライ（チェックポイント/usedGate 引き継ぎ・物理再開）を確認。
