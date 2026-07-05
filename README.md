# かけぬけろ みーちゃん (RunAction Renew)

ワンボタン操作の縦画面オートランナー。Android 製の旧作ゲーム「RunAction」を Web で遊べるように移植したものです。

▶ 遊ぶ: https://threepipes.github.io/Running-Mi-chan/

- 操作はジャンプのみ（画面タップ / `Space` / `↑`）。みーちゃんは自動で右へ走ります。
- 敵やバネを踏むと跳ね上がり、タイミングよくタップすると少し高く跳べます。

## 技術スタック

| 分類 | 採用 |
|---|---|
| 言語 | TypeScript |
| ゲームエンジン | [Phaser 3](https://phaser.io/)（`3.90`。Phaser 4 とは API が異なるため 3 系に固定） |
| バンドラ / 開発サーバ | [Vite 5](https://vite.dev/) |
| テスト | [Vitest](https://vitest.dev/) |
| ホスティング | GitHub Pages（GitHub Actions で自動デプロイ） |

## 必要環境

- **Node.js 24**（`package.json` の `volta.node` に `24.18.0` を固定）
  - [Volta](https://volta.sh/) を使っていれば、リポジトリに入った時点で自動的にこのバージョンに切り替わります。
  - 使っていない場合は Node 24 系を手動で用意してください。

## セットアップ & 起動

```bash
# 依存インストール
npm install

# 開発サーバ起動(ホットリロード)。表示された http://localhost:5173 を開く
npm run dev
```

`npm run dev` の起動後、ブラウザでゲームがすぐに動きます。ソースを編集すると自動でリロードされます。

## npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバを起動（ホットリロード） |
| `npm run build` | 本番ビルドを `dist/` に出力 |
| `npm run preview` | ビルド成果物（`dist/`）をローカルで確認 |
| `npm run typecheck` | 型チェックのみ実行（`tsc --noEmit`） |
| `npm test` | ユニットテストを実行（Vitest） |

コミット前は `npm run typecheck` / `npm test` / `npm run build` が通ることを確認してください。

## デプロイ

`main` ブランチへの push で、GitHub Actions（`.github/workflows/deploy.yml`）が `npm ci → npm run build` を実行し、`dist/` を GitHub Pages に自動デプロイします。手動実行（`workflow_dispatch`）も可能です。

> Vite の `base` は `./`（相対パス）に設定済みで、project pages の URL（`/Running-Mi-chan/`）配下でも正しく動作します。

## 開発メモ

- **Phaser のバージョン**: エコシステム/ドキュメントが 3 系中心のため、`phaser@^3.90.0` に固定しています。Phaser 4 は API が異なるため上げないでください。
- **デバッグ用フック**: 開発ビルド時のみ `window.__game`（`Phaser.Game`）と `window.__scene`（実行中の `GameScene`）を公開しています（`import.meta.env.DEV` ガードで本番ビルドからは除去）。E2E スモークテストやコンソールからの動作確認に利用できます。
- **画面フィット**: 縦画面前提で FIT + 中央揃え。モバイルのアドレスバーによる高さズレは `visualViewport` を実測して補正しています（`src/main.ts`）。
