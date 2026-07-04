# RunAction Web版 移植 設計ドキュメント（MVP）

- 作成日: 2026-07-04
- 対象: Android スタンドアロンゲーム「RunAction」の Web 移植（MVP: 1ステージ通しプレイ）
- 元プロジェクト: `/Users/tsutsumi/ghq/github.com/threepipes/RunAction`（Java 約3,500行 / Android Canvas）

## 1. 目的とゴール

昔 Android 用に作ったスタンドアロンのアクションゲームを、誰でもブラウザで（PC・スマホ）遊べる形に移植する。自前実装していたゲームループ・衝突判定はゲームフレームワークの機能に載せ替え、コードをすっきりさせる。既存ロジックとの厳密一致は不要で、モダンで実績のあるフレームワークを用いる。

本サイクルのゴールは **MVP: 1ステージ(easy01) を最初から最後まで通しで遊べる状態にし、GitHub Pages で公開する**こと。

## 2. ゲーム仕様（元コードから確定した挙動）

- **ジャンル**: ワンボタンのオートラン横スクロールアクション（縦画面 540×960 ポートレート）
- **操作**: ジャンプのみ（左右移動なし）
  - プレイヤーは `vx = SPEED(8)` で常に自動で前進
  - `onGround`（接地）または `forceJump`（空中再ジャンプ許可）時にジャンプ可（`vy = -JUMP_SPEED(20)`）
- **即死条件**:
  - 前進方向でタイル（壁）に水平衝突 → 即ゲームオーバー（進路を塞ぐ障害物はジャンプで越える必要がある）
  - 画面下への落下（穴） → 即ゲームオーバー
  - 針(NEEDLE)に接触 → 死亡
  - 敵(ENEMY/Kuribo)に横から接触 → 死亡
- **アクション成立**:
  - 敵を上から踏む → 撃破
  - バネ(SPRING) → 強い上方バウンス（`jump2` = 通常の2倍ジャンプ相当）＋空中再ジャンプ付与
  - 中間ゲート(GATE) → チェックポイント（死亡時の復帰位置）
  - マップ終端の goalX 到達 → ゴール（クリア）
- **stage1(easy01) の内訳**: ENEMY 9 / NEEDLE 63 / SPRING 7 / GATE 1 / STAR 0
- 定数: `TILE_SIZE=32`, `GRAVITY=2.0`, `SPEED=8`, `JUMP_SPEED=20`（Phaser 側で挙動が近くなるよう調整。厳密一致は求めない）

## 3. 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript | Web 上での拡張性・型安全 |
| ゲームFW | Phaser 3（最新 3.9x） | 2D Web の定番・成熟・タッチ入力が一級市民 |
| 物理 | Phaser Arcade Physics + Tilemap | 自前ループ/衝突を FW 機能へ載せ替えて簡素化 |
| ビルド | Vite | 標準・高速・GitHub Pages 向け出力が容易 |
| ホスティング | GitHub Pages（GitHub Actions で自動デプロイ） | 無料・第一候補どおり |
| テスト | Vitest | 純粋ロジック（パーサ等）のユニットテスト |
| 基準解像度 | 540×960 ポートレート、Scale FIT + CENTER_BOTH | 元コードに準拠、レスポンシブに拡縮（レターボックス） |

### フレームワーク選定の経緯
「Web 上の機能を育てたい」という拡張方針のため、エコシステム・タッチ操作・ロードの軽さで優位な TypeScript + Phaser 3 を採用。Go + Ebitengine（マルチプラットフォーム展開に強い）も有力候補だったが、本件はブラウザ＋スマホタッチを主戦場とするため Phaser を選定した。

## 4. データ・アセット移植方針（作り直し不要）

- **画像**: 元 `res/drawable-*` の PNG を `public/assets/` にコピーして流用
  - タイルセット `map.png`（16列 × 32px グリッド）、`player.png`, `kuri.png`(敵), `toge.png`(針), spring/gate 画像, 背景 `sky.png`/`yama.png`, UI(`bar_base.png`/`bar_progress.png`, `button.png` 等), `gameclear.png`/`gameover.png`
- **レベル `.map`（バイナリ）**: 素直なバイナリなので変換スクリプト不要。ランタイムで fetch → ArrayBuffer をパース
  - フォーマット: 先頭 `row`(1byte) + `col`(2byte ビッグエンディアン: `col = b1<<8 | b2`) + 続く `row×col` バイトが各タイルのチップID
  - チップID `0` = 空、非0 = タイルセット `map.png` 内のインデックス（`tx = id%16, ty = id/16`）
  - Phaser 変換: チップID 0 → 空(-1)、非0 → 対応タイル。Phaser の `this.make.tilemap({ data: number[][], tileWidth:32, tileHeight:32 })` に流し込み、`createLayer` でタイルセット適用。ソリッド化は `layer.setCollisionByExclusion([-1])`（元コードは非0すべてソリッド）
  - ※ Phaser のタイルインデックスと元チップID の 0/-1 オフセット差異はローダ側で吸収する
- **イベント `.evt`（CSV）**: `TYPE,tileX,tileY`（`TYPE ∈ {ENEMY, NEEDLE, SPRING, GATE, STAR}`）を fetch してパース → 各エンティティを tile 座標 × 32 のピクセル座標に生成

## 5. コンポーネント設計

```
src/
  main.ts                 # Phaser.Game 起動・Scale/物理設定
  config.ts               # TILE_SIZE, GRAVITY, SPEED, JUMP_SPEED 等の定数、基準解像度
  scenes/
    BootScene.ts          # アセット preload（画像・.map・.evt）
    GameScene.ts          # ゲーム本体（1ステージ）。エンティティ間の collide/overlap を配線
  game/
    loaders/
      MapLoader.ts        # .map バイナリ → number[][]（+ Phaser 用インデックス変換）
      EventLoader.ts      # .evt CSV → EntitySpec[]
    entities/
      Player.ts           # 一定前進 / ジャンプ / 踏みつけ / 水平衝突死 / 落下死
      Enemy.ts            # Kuribo: 歩行・上から踏まれ判定
      Needle.ts           # 静的ハザード（接触で死亡）
      Spring.ts           # 強い上方バウンス + 空中再ジャンプ付与
      Gate.ts             # 中間チェックポイント（復帰位置更新）
    ui/
      TouchControls.ts    # 全画面タップ入力ゾーン（ジャンプ）
```

### 設計方針
- 各エンティティは Arcade Sprite を包む薄いクラス。`GameScene` がグループ同士の `collide`/`overlap` を配線する（元の巨大な `Map.mapupdate` 手書き衝突ループを Phaser のグループ衝突へ置き換え）。
- 各ユニットは単一責務・独立テスト可能。パーサ（`MapLoader`/`EventLoader`）は Phaser 非依存の純粋関数として実装し、Vitest でテストする。

## 6. 操作（ワンボタン）

- **入力は「ジャンプ」の1種類のみ**、前進は自動（constant velocity）
- **キーボード**: Space / ↑ / 任意キーでジャンプ
- **タッチ**: 画面のどこでもタップでジャンプ（左右ボタン・マルチタッチ考慮は不要）
- `TouchControls` は全画面タップ入力ゾーン1つに簡素化

## 7. ゲームフロー（MVP）

1. プレイヤー生成（スタート位置）
2. 一定速度で自動前進、カメラが横スクロールで follow
3. ジャンプ入力で障害物・穴を越える
4. 敵は踏めば撃破、横接触・針接触・水平壁衝突・落下は死亡
5. 死亡時: 中間ゲート通過済みならゲート位置から、未通過ならスタートから復帰
6. マップ終端 goalX 到達で「ゴール（`gameclear` 表示）」→ リスタート可能

## 8. デプロイ

- `main` への push を契機に GitHub Actions が `vite build` を実行し、`actions/deploy-pages` で公開
- Vite の `base` をリポジトリ名（Project Pages）に合わせて設定
- 完全静的配信のためバックエンド不要

## 9. テスト方針

- **ユニット（Vitest）**: `MapLoader`（バイナリパース・0/-1 変換）、`EventLoader`（CSV パース）、踏みつけ/死亡判定などの純粋ユーティリティ
- **統合**: 描画・物理はブラウザ手動確認（MVP では Playwright 等の E2E は導入しない）

## 10. スコープ

### MVP に含む
- 1ステージ(easy01) の: 移動（自動前進）・ジャンプ・タイル衝突・敵（踏/横被弾）・針・バネ・中間ゲート・ゴール・死亡復帰
- キーボード＋タッチ（タップ）操作
- GitHub Pages への公開（Actions 自動デプロイ）

### MVP に含まない（後続サイクル）
- タイトル / クリア / ゲームオーバーの画面遷移
- ステージ選択、複数ステージ（medium01 等）
- 星(STAR)収集、プレイ履歴の保存
- BGM / SFX
- プログレスバー等の一部 UI（必要に応じ後続）

## 11. 未確定・リスク

- 元 `.map` バイナリの実データを実際にパースして期待通りの `number[][]` になるか、実装初期に検証する（0/-1 変換、行列サイズ）
- Arcade Physics の挙動（重力・ジャンプの体感）は元の値をそのまま使わず、遊んで調整する
- `player.png` / `kuri.png` 等のスプライトシートのセル割り（フレーム数・サイズ）は実装時に元 `Animation` 定義を参照して確定する
