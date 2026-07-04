# GameScene リファクタリング 案B 設計ドキュメント

- 作成日: 2026-07-04
- 対象: レベル/エンティティ生成層の抽出（案B）
- 前提: 案A（UI/演出・アニメの抽出）は完了・main にマージ済み
- 方針: **挙動不変のリファクタ**

## 内容（案B）

`GameScene.create()` に残っていた「レベルの構築処理」を `src/game/LevelBuilder.ts` へ抽出する。

- **`buildTilemap(scene, mapBuffer)` → `{ layer, worldWidth, worldHeight }`**
  `.map` バイナリのパース、Phaser タイルマップ生成、衝突レイヤー作成、ワールド寸法算出をまとめる。
- **`spawnEntities(scene, specs)` → `{ enemies, hazards, springs, gates }`**
  イベント定義から各グループを生成（タイル中心配置、敵の初速/アニメ設定）。**生成のみ**で衝突挙動の配線は行わない。

`GameScene` 側は上記を呼び、返り値を各フィールドへ代入。旧 `spawnEntities`/`spawnEnemy` メソッドは削除。

## 設計判断: 衝突の"挙動"はシーンに残す

当初案では `wireOverlaps` も抽出候補としていたが、踏みつけ・被弾（死亡）・バネ・ゲート（チェックポイント）といった衝突の**挙動はゲームルールそのもの**で、シーン状態（player/isEnded/forceJump/usedGate/checkpoint/die）に密結合する。多数のコールバックを渡す形での抽出は間接化が増えて可読性を下げるため、**`wireOverlaps`/`onEnemyOverlap` は GameScene に残す**。LevelBuilder は「構築」だけの純粋な責務に限定する。

結果: `GameScene` 301 → 265行。

## スコープ

### 含む
- `LevelBuilder.buildTilemap` / `spawnEntities` の抽出と GameScene からの委譲。挙動不変。

### 含まない
- 案C（PlayerController によるプレイヤー操作の集約）は後続。
- 衝突挙動の配線（ゲームルール）は GameScene に残す。

## テスト方針

- 既存 Vitest グリーン維持。
- Playwright 回帰: 3ステージともタイルマップ・エンティティが従来の数（easy 9/63/7、medium 12/101/20、hard 20/315/57、各ゲート1）で生成・描画され、踏みつけ等の挙動が従来どおり動くことを確認。
