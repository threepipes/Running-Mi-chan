# タイトル / ステージ選択 設計ドキュメント

- 作成日: 2026-07-04
- 対象: RunAction Web版に「タイトル画面」「ステージ選択画面」「3ステージ」「クリア記録の永続化」を追加する
- 前提: MVP（easy01 の1ステージ通しプレイ + GitHub Pages 公開）は完了・main にマージ済み

## 1. 目的

MVP は easy01 の1ステージ固定（`LEVEL='easy01'`）だった。本サイクルで、原作同様の「タイトル → ステージ選択 → プレイ」の導線を作り、原作の3ステージを遊べるようにする。加えてクリア状況を localStorage に永続化し、ステージ選択画面にスタンプで表示する。

## 2. 画面遷移

```
TitleScene ──タップ──▶ StageSelectScene ──ステージ選択──▶ GameScene(stageIndex)
   ▲                        ▲                                  │
   └───「タイトルへ」戻る────┘                        クリア→結果表示
                            ▲                                  │
                            └──[ステージ選択へ]◀──[リトライ]/[選択へ]
                                        ゲーム中の戻るボタン────────┘
```

- **TitleScene**: 背景 `title.png` + ロゴ `title_logo.png` + 「タップでスタート」テキスト。画面タップ/キーで StageSelectScene へ。
- **StageSelectScene**: 3ステージのボタン + 「タイトルへ」戻るボタン。クリア済みステージにはスタンプを表示（`stamp` = ゲート未使用クリア / `stamp_sub` = 通常クリア）。ロック無し（原作準拠、全ステージ最初から選択可）。
- **GameScene**: 選択された stageIndex をプレイ。クリア時は gameclear 演出 + 「リトライ」「ステージ選択へ」の2択。プレイ中は画面隅の小さな戻るボタンでいつでも StageSelectScene へ。

## 3. ステージ定義（レジストリ）

`src/game/stages.ts` に3ステージを定義する。原作のマッピングに準拠:

| stageIndex | map ファイル | event ファイル | 表示名 |
|---|---|---|---|
| 0 | map_easy01.map | event_easy01.evt | ステージ1 (Easy) |
| 1 | map_medium01.map | event_medium01.evt | ステージ2 (Medium) |
| 2 | map.map | event.evt | ステージ3 (Hard) |

- 各ステージデータの実測（本サイクルで検証済み）: easy01=30×500, medium01=30×600, stage3=30×1000。チップIDは全て既存 `chipToIndex` で扱える範囲（0,1,2,3,4,17）。イベントは全ステージ ENEMY/NEEDLE/SPRING/GATE のみ（STARなし）、GATE は各1個。
- 追加でコピーするデータ: `map_medium01.map`/`event_medium01.evt`、`map.map`/`event.evt` を `public/levels/` へ（easy01 は配置済み）。

型定義例:
```ts
export interface StageDef {
  index: number;
  name: string;
  mapKey: string;   // BootScene の binary キー
  eventKey: string; // BootScene の text キー
  mapFile: string;  // levels/ 配下のパス
  eventFile: string;
}
export const STAGES: StageDef[];
```

## 4. クリア記録の永続化

`src/game/Progress.ts` に localStorage の読み書きを閉じ込める（Phaser 非依存、Vitest でテスト可能）。

- 保存形式: キー `runaction:progress`、値は JSON。各ステージの `{ cleared: boolean; gateless: boolean }`。
- API 例:
```ts
export interface StageProgress { cleared: boolean; gateless: boolean }
export function loadProgress(): StageProgress[];        // 全ステージ分（未保存は cleared:false）
export function recordClear(index: number, gateless: boolean): void; // クリア記録（gateless は既存 true を維持=一度でもゲートレス達成なら stamp）
export function getStageProgress(index: number): StageProgress;
```
- `recordClear` は「一度でもゲートレスでクリアしたら gateless=true を維持」する（原作の `stamp`（ゲートレス）優先表示に相当）。localStorage 例外（プライベートモード等）は握りつぶして進行を止めない。

## 5. GameScene の改修

- `init(data: { stageIndex: number })` で対象ステージを受け取る。`create()` は `STAGES[stageIndex]` の map/event キーからパースする（現状の固定 `LEVEL` 参照を置換）。
- **ゲート使用フラグ**: `usedGate` プロパティを追加し、ゲート overlap で `true` にする。クリア時 `recordClear(stageIndex, !usedGate)` を呼ぶ。
- クリア演出: 既存 `showOverlay('gameclear')` を拡張し、「リトライ」（同 stageIndex で `scene.restart({ stageIndex })`）と「ステージ選択へ」（`scene.start('StageSelect')`）の2ボタンを表示。
- プレイ中の戻る導線: 画面隅に小さな戻るボタン（`button` 画像 or テキスト）→ `scene.start('StageSelect')`。
- `scene.restart({ stageIndex })` / `scene.start` 越しの状態リセットは MVP 同様 `create()` 冒頭で担保する。

## 6. BootScene の改修

- 全3ステージの `.map`（binary）/ `.evt`（text）をプリロード（キー: `map_0/1/2`, `evt_0/1/2`、`stages.ts` の定義から回す）。
- タイトル/選択用画像を追加プリロード: `title`, `title_logo`, `stamp`, `stamp_sub`（`button` は配置済み。未配置分は `public/assets/` へコピー）。
- 起動後は TitleScene へ遷移。

## 7. コンポーネント構成

```
src/
  main.ts                    # 改修: Title/StageSelect を scene 登録、起動は Title
  scenes/
    BootScene.ts             # 改修: 全ステージ+タイトル/選択UI画像をpreload
    TitleScene.ts            # 新規
    StageSelectScene.ts      # 新規
    GameScene.ts             # 改修: stageIndex受取, usedGate, 結果2択, 戻る導線, クリア記録
  game/
    stages.ts                # 新規: ステージレジストリ
    Progress.ts              # 新規: localStorage クリア記録(テスト対象)
    loaders/                 # 既存(変更なし)
config.ts                    # 固定 LEVEL は撤去 or デフォルト値に
```

各シーンは単一責務: TitleScene=入口、StageSelectScene=選択+進捗表示、GameScene=プレイ。scene 間は Phaser の `scene.start(key, data)` で疎結合に受け渡す。

## 8. テスト方針

- **Vitest**: `Progress`（localStorage read/write、未保存時デフォルト、gateless 維持ロジック、例外握りつぶし）、`stages` レジストリ（件数・キー整合）。
- **Playwright（コントローラが実施）**: Title→Select 遷移、3ステージ各々の起動・描画、クリア→スタンプ記録→選択画面反映、ゲート使用有無での stamp/stamp_sub 出し分け、戻る導線、本番ビルド。

## 9. スコープ

### 含む
- TitleScene / StageSelectScene の新規実装と画面遷移
- 原作3ステージの移植（データコピー + レジストリ + 各ステージ起動・描画）
- クリア状況の localStorage 永続化とステージ選択画面でのスタンプ表示（ゲート有無で出し分け）
- クリア結果の2択（リトライ / ステージ選択へ）とゲーム中の戻る導線

### 含まない（後続サイクル）
- BGM / SFX とそのON/OFFトグル
- スター収集
- プレイ回数・到達率など詳細統計
- ステージのロック/アンロック進行

## 10. リスク・留意点

- 3ステージのデータは本サイクルで実測・検証済み（ヘッダ・チップID・イベント種別）で、既存ローダ/GameScene でそのまま扱える見込み。stage3(map) は col=1000 と長いため、ワールド境界/カメラ追従の挙動を実装初期に実機確認する。
- 画面レイアウト（タイトル・選択ボタン配置）は 540×960 ポートレート基準。ボタンのタップ領域はスマホで押しやすいサイズにする。
- 既存 GameScene の `create()` は MVP 時点で ~100 行。stageIndex 対応・戻る導線・結果2択の追加でさらに増えるため、エンティティ生成（`spawnEntities`）とオーバーラップ配線（`wireOverlaps`）を private メソッドへ抽出する軽微なリファクタを本サイクルで併せて行う（レビューで defer 済みの改善提案の消化）。
