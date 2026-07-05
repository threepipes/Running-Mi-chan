# マップエディタ 設計ドキュメント（スタンドアロン版 v1）

- 作成日: 2026-07-05
- 対象: 本ゲーム(RunActionRenew)用のマップエディタを、まずスタンドアロンとして作成する
- 将来: ゲーム本体のクリア後/デバッグモードに組み込む（今回は作らないが、そのまま再利用できる構成にする）

## 背景

- 原作のマップエディタ相当（`threepipes/JumpGame`）はマウス編集機能を持たず、マップは「ROW(1B)/COL(2B BE)＋チップ列（2=針,3=バネ,4=敵をグリッドに埋め込み）」の単一ファイルを手編集する形だった。
- 本ゲームは **2ファイル構成**:
  - `.map`（バイナリ）: 地形タイルのみ。`ROW(1B) / COL(2B BE) / row×col の chip id`。
  - `.evt`（CSV）: エンティティ `TYPE,tileX,tileY`（`ENEMY / NEEDLE / SPRING / GATE / STAR`）。
- したがってエディタは **地形タイルとエンティティの両方**を編集し、`.map` と `.evt` を出力する必要がある。

## スコープ

### 含む（v1）
- タイル地形の描画（パレットから選択して塗る／空きで消す）。
- エンティティ（ENEMY / NEEDLE / SPRING / GATE / STAR）の配置・削除。
- 保存（`.map` バイナリ + `.evt` CSV をダウンロード）／読込（ファイル選択 or 既存ステージを fetch）。
- 新規作成（幅×高さをタイル数で指定して空マップを生成）。
- スタンドアロンページ（`editor.html`）として単体で動く。

### 含まない（v1）
- マップの動的リサイズ（作成後の拡縮）。作成時サイズ固定。
- ゲーム本体への組み込み（クリア後/デバッグモード）。設計上は再利用可能にするが実装は別タスク。
- Undo/Redo、コピペ、複数レイヤー等の高度な編集機能。

## アーキテクチャ

描画は **Phaser Scene**（ゲームとタイル描画を共有し、将来 Scene 登録だけで統合可能）、ツールUIは **DOM オーバーレイ**（パレット/ボタン/ファイル入出力が容易）。

```
src/editor/
  EditorState.ts     … 編集データを保持する純ロジック(Phaser/DOM非依存)
  EditorScene.ts     … 地図描画・入力(ペイント/配置/削除)・カメラ横スクロール・カーソル強調
  standalone.ts      … スタンドアロン起動(Phaser.Game を生成し EditorScene のみ動かす)
  ui/EditorUI.ts     … DOMツールバー(パレット/エンティティ/ツール切替/新規/読込/保存)
src/game/loaders/
  MapSerializer.ts   … EditorState → .map バイナリ(parseMap の逆 + indexToChip)
  EventSerializer.ts … EditorState → .evt CSV(parseEvents の逆)
editor.html          … 2つ目の Vite エントリ
vite.config.ts       … マルチページ化(index.html + editor.html)
```

### 各ユニットの責務・インターフェース

- **EditorState**: 何を持つか＝タイルグリッド（chip id の 2次元配列 `number[][]`、0=空）とエンティティ配列（`{ type, tileX, tileY }[]`）、幅・高さ。どう使うか＝`setTile(x,y,chip)` / `getTile(x,y)` / `toggleEntity(type,x,y)` / `entitiesAt(x,y)` などのメソッドで読み書き。依存＝なし（純データ）。
- **EditorScene**: `EditorState` を描画し、ポインタ入力を現在のツールに応じて `EditorState` へ反映。カメラ横スクロール。依存＝Phaser, EditorState, `chipToIndex`。
- **EditorUI**: DOM要素を生成し、ツール選択・パレット選択・新規/読込/保存を発火。`EditorScene`/`EditorState` とはコールバック/イベントで疎結合。依存＝DOM, Serializer, loaders。
- **MapSerializer / EventSerializer**: `EditorState` を各ファイル形式へ直列化。`parseMap`/`parseEvents` の逆。依存＝config, MapLoader（`chipToIndex` の逆写像）。

## データモデルとチップ符号化

- `.map` は「元16列アドレッシングの chip id」を格納。描画時に既存 `chipToIndex(chip)`（`chip===0 → -1`（空）、それ以外 `row=floor(chip/16), col=chip%16` → `row*SHEET_COLS+col`）で 5列タイルセットの index に変換する。
- エディタは **chip id を内部保持**し、描画時に `chipToIndex` を通す。保存時は chip id をそのまま書き出す（`parseMap` と往復一致）。
- パレットは「保存可能なタイル」を列挙する。`chipToIndex` の逆写像 `indexToChip(index)`（`col=index%SHEET_COLS, row=floor(index/SHEET_COLS), chip=row*CHIP_COLS+col`）で、タイルセットの各セル index に対応する chip id を得る。空きは chip 0（index -1）として扱う。
  - 既知の制約: index 0（col0,row0）は chip 0 と衝突し「空き」と区別できないため、非空タイルとしては扱わない（原作の符号化由来）。パレットは index 1 以降を提示する。

## データフロー

### 読込
1. ファイル選択で `.map` と `.evt` を開く（`ArrayBuffer`/text 取得）。
2. または「既存ステージ」ドロップダウン（`STAGES` を列挙）から `mapFile`/`eventFile` を `fetch` して開く。
3. `parseMap`（既存）でタイルグリッド、`parseEvents`（既存）でエンティティを得て `EditorState` を構築。
   - 注意: `parseMap` は現状 chip を index へ変換して返すため、エディタ用に **chip を保持したまま返す経路**が必要。方針: `parseMap` を変更せず、エディタは生バイト（ROW/COL/chip列）を読む薄いパーサ `parseMapRaw(buffer): { width, height, chips: number[][] }` を `MapSerializer.ts`（または MapLoader）に追加して使う。描画は `chipToIndex`。

### 保存
1. `MapSerializer.serialize(state)` → `Uint8Array`（`ROW(1B) / COL(2B BE) / chip列`）→ `Blob` でダウンロード。
2. `EventSerializer.serialize(state)` → CSV 文字列 → `Blob` でダウンロード。
3. ファイル名は入力欄で指定（既定値あり）。

### 新規
- 幅×高さ（タイル数）を入力 → 全セル chip 0（空）・エンティティ空の `EditorState` を生成。

## 編集操作

- **タイルツール**: パレットで選択したタイル（chip）を左クリック/ドラッグで塗る。「空き」を選ぶと消しゴム。
- **エンティティツール**: 種類を選び、タイルにクリックで1個配置。既存の同種の上をクリックで削除（トグル）。
- **カメラ**: マウスホイールで横スクロール、スペース押下ドラッグでパン。
- グリッド線とカーソル位置ハイライトを常時表示。

## UI レイアウト（DOMオーバーレイ）

```
┌───────────────────────────────────────────────┐
│ [新規] [読込] [保存]  ツール:(タイル)(敵)(針)(バネ)(ゲート)(スター) │
├───────────────┬───────────────────────────────┤
│ タイルパレット   │        地図キャンバス(Phaser)       │
│ (map.png分割)  │        横スクロール/パン            │
└───────────────┴───────────────────────────────┘
```

## テスト方針

- **Vitest（ユニット）**:
  - `EditorState`: setTile/getTile、toggleEntity（配置→再クリックで削除）、境界外アクセスの無視。
  - `MapSerializer`: `serialize` → 既存 `parseMap`（および `parseMapRaw`）で往復一致。`indexToChip`↔`chipToIndex` の整合。
  - `EventSerializer`: `serialize` → 既存 `parseEvents` で往復一致。
- **Playwright（結合・手動確認）**: `editor.html` を開き、タイル塗り→保存→再読込で内容一致、エンティティ配置/削除、既存ステージ読込。

## 将来の統合（v1では実装しない）

- `EditorScene` をゲームの Scene リストに登録し、クリア後/デバッグから `scene.start('Editor')` で起動。
- DOMツールUIはゲーム canvas に重ねて表示。`src/editor/` はそのまま再利用。

## その他構想

- マップにメタデータ (マップタイトルや作成者、作成時刻等) を持たせる