# ボタン画像化 設計ドキュメント

- 作成日: 2026-07-04
- 対象: 各画面のボタンを、原作のボタン画像に置き換える
- 前提: タイトル/ステージ選択/3ステージ/クリア記録まで実装済み（main）

## 目的

現状の Web 版はステージ選択のみ `button.png` を使い、他（戻る/結果/ゲーム中）は「テキスト＋背景色」。原作は全メニューボタンに `button_large`（400×100、押下時 `button_large_pressed`）、ゲーム中ポーズに `button_pause`（75×75、押下時 `button_pause_pressed`）を使っていた。原作のボタン画像を用いて見た目を統一する。

## 使用アセット（`public/assets/` に配置済み）

- `button_large.png` / `button_large_pressed.png`（メニュー系ボタン）
- `button_pause.png` / `button_pause_pressed.png`（ゲーム中の小ボタン）

## 共通コンポーネント

`src/ui/button.ts` に画像ボタン生成ヘルパを追加:

```ts
export interface ImageButtonOptions {
  scene: Phaser.Scene;
  x: number; y: number;
  texture: string;          // 通常時の画像キー
  pressedTexture?: string;  // 押下時の画像キー(あれば押下で差し替え)
  label?: string;           // 中央テキスト(無ければ画像のみ)
  fontSize?: string;
  scrollFactor?: number;    // カメラ固定用(既定1)
  depth?: number;
  onClick: () => void;
}
export function createImageButton(opts: ImageButtonOptions): Phaser.GameObjects.Container;
```

- Container に画像＋（あれば）中央テキストをまとめ、Container 全体を interactive 化。
- `pointerdown`→`pressedTexture` に差替、`pointerup`→通常画像に戻し `onClick`、`pointerout`→通常画像に戻す（原作の状態切替を再現）。

## 適用箇所

| 画面 | ボタン | 画像 | テキスト |
|---|---|---|---|
| Title | スタート | `button_large` | 「スタート」 |
| StageSelect | ステージ1/2/3 | `button_large` | ステージ名 |
| StageSelect | タイトルへ | `button_large` | 「タイトルへ」 |
| Game(結果) | リトライ | `button_large` | 「リトライ」 |
| Game(結果) | ステージ選択へ | `button_large` | 「ステージ選択へ」 |
| Game(プレイ中) | 選択へ戻る(隅) | `button_pause` | なし（画像がポーズを表すため） |

- **Title**: 従来の「画面どこでもタップで開始」を廃し、`button_large` の「スタート」ボタンに変更（キーボードでの開始も引き続き可能）。
- **Game プレイ中の隅ボタン**: `button_pause`（75×75）をテキストなしで左上に配置。動作は現状どおりステージ選択へ遷移。
- クリア済みステージのスタンプ表示（`stamp`/`stamp_sub`）は現状の位置関係を維持。

## スコープ

### 含む
- 上記6種のボタンを原作のボタン画像へ置換、押下状態のフィードバック、共通ヘルパ `ui/button.ts` の追加、BootScene での画像プリロード追加。

### 含まない
- BGM/SFX、スター収集等（別サイクル）。ボタンの音（クリック音）も対象外。

## テスト方針

- ヘルパは Phaser 依存のため主にブラウザ確認（Playwright）: 各画面のボタン描画・押下状態・クリック遷移。
- 既存ユニットテスト（stages/Progress/loaders）に影響なし＝グリーン維持を確認。
