# タイトルのサウンドON/OFF + 音符 + みーちゃんsleep 設計

## 背景・目的

原作(Android版 RunAction)のタイトル画面を再現する:

1. **サウンド(BGM/SE)の ON/OFF トグル** をタイトルに設置。
2. サウンド ON のとき、ラジオ位置に **音符アニメ(music.png)** を表示。
3. タイトルのみーちゃんは **寝ている**。スタート時に **起きる→ジャンプ→着地→右向き→走り出し→画面外** の開始アニメを再生してから遷移。

加えて Web 固有の要件:

- **ページを開いた初期状態は サウンド OFF**。ブラウザは初回タップ前に音を鳴らせないため、既定ONでも「無音」になり混乱する。よって既定OFF・手動ONにする。

## 原作の挙動(threepipes/RunAction TitleView.java より)

- `bgmState = !Setting.SET_VOLUME_OFF`(永続設定)。ON のときだけ `music.png` を描画・アニメ。
- `music.png` は 64×32 = 32px×2フレーム。アニメ `{{0,0,30},{1,0,30},loop}`(各30tick でループ)。描画位置 (150, 840)。
- みーちゃん(player スプライト, 32px, 4×4)。タイトル座標 (98, 828)。開始アニメのフレーム(列,行→index=行*4+列):
  - 寝てる `{3,2}`=11 / 起きる `{1,3}`=13 / 垂直ジャンプ `{0,3}`=12 / 着地 `{1,1}`=5 / 右向き `{2,1}`=6 / 走る 行0 = 0,1,2,3
  - シーケンス: STOP(寝) → (コマンド)起きる → 20tick後ジャンプ+jump SE → 着地 → 10tick後右向き → 20tick後 WALK(速度5) → 画面外で遷移。
- サウンド設定は master(`musicOff`):BGM も SE も一括で止まる(`playSE` も `musicOff` で無音)。

座標系は原作・Web版とも 540×960 で一致するため、座標はそのまま使える。

## 方針

### サウンド状態: `game.sound.mute` を master スイッチに

- Phaser の `game.sound.mute`(グローバル)で BGM・SE を一括制御。原作の `musicOff` に対応。
- **初期値 `mute = true`(OFF)**。`main.ts` でゲーム生成直後に設定。
- タイトルのトグルで `mute` を反転。ON にした瞬間に opening BGM を(未再生なら)開始する。
- 設定はグローバルなのでシーン遷移(Title↔StageSelect↔Game)で保持される。**リロード時はまた OFF**(localStorage 等での復元はしない = 「ページを開いたら OFF」に忠実)。
- 既存の各所(opening BGM / stage BGM / 各SE)の呼び出しは変更不要。`mute` が全体を無音化するため、ON にした瞬間から鳴る。
  - 例外: 現在 `TitleScene.create()` で opening BGM を無条件 `play()` している。mute=true でも `play()` 自体は走る(無音)ので、ON トグル時に「未再生なら play、再生済みなら mute 解除だけ」で自然に鳴り始める。挙動確認して必要なら調整。

### トグルUI: 専用トグルボタン

- 既存の `createImageButton`(label 対応)を用い、タイトルにサウンド切替ボタンを1つ設置。
- ラベルは状態を反映: OFF 時「サウンド OFF」/ ON 時「サウンド ON」(押すたびにトグル&ラベル更新)。
- 配置はスタートボタンと干渉しない位置(例: 画面下部または右上)。実装時に調整。

### 音符アニメ(music.png)

- `music.png` を原作 `res/drawable-nodpi/music.png` から `public/assets/music.png` にコピー(画像は難読化対象外)。
- BootScene で spritesheet(frameWidth/Height=32)としてロード。
- タイトルで radio 位置(150,840 付近)にスプライトを置き、2フレームのループアニメを登録・再生。
- **サウンド ON のときだけ可視**(`setVisible`)。トグルで表示/非表示を切替。

### みーちゃん sleep + 開始シーケンス

- title.png にはラジオはあるがみーちゃんは居ないため、player スプライトを (98,828) に重ねる。
- 通常時: 寝てるフレーム(11)で静止。
- スタート操作(スタートボタン or キー/タップ)時に開始シーケンスを Phaser の tween/timeline で再現:
  1. 起きる(frame 13)を短時間表示
  2. ジャンプ(frame 12)+ `se_jump` 再生(mute 中は無音)、上方向へ tween で跳ねる
  3. 着地(frame 5)
  4. 右向き(frame 6)を短時間
  5. 走る(frame 0-3 ループ)で右へ移動、画面外へ
  6. 画面外に出たら `scene.start('StageSelect')`
- シーケンス中は再入力を無効化(多重発火防止)。
- タイミングは原作 tick(60fps 基準: 20tick≒0.33s 等)を目安に、見た目で微調整。物理は厳密移植せず tween で近似。

## 影響ファイル(予定)

- `src/main.ts`: `game.sound.mute = true` を初期設定。
- `src/scenes/BootScene.ts`: `music.png` を spritesheet ロード。
- `src/game/audio/soundToggle.ts`(新規, 案): mute の取得/反転と opening BGM 起動をまとめる小ヘルパー。
- `src/game/anims.ts`: 音符ループアニメ(`music-note`)を登録。
- `src/scenes/TitleScene.ts`: トグルボタン・音符スプライト・みーちゃん sleep/開始シーケンスを追加。
- `src/game/audio/openingBgm.ts`: ON トグル時起動に合わせ、必要なら再生開始条件を調整。
- `public/assets/music.png`(追加)。

## 検証

- `npm run typecheck` / `npm run build` / `npm test` 緑。
- ローカルで:
  - 初期状態が OFF(無音)。トグル ON で opening BGM が鳴り、音符が表示・アニメ。OFF で停止・音符非表示。
  - リロードで再び OFF。
  - みーちゃんが寝ており、スタートで 起きる→ジャンプ→着地→右向き→走り出し→画面外 の後に StageSelect へ遷移。
  - ゲーム中の BGM/SE がサウンド状態に従う(ON なら鳴る/ OFF なら無音)。
- スクリーンショットで sleep ポーズ・音符表示位置を確認。
- iOS 実機で ON トグル後に音が鳴ること(既存の resume 対応と併用)。

## スコープ外 / 非対象

- 設定の永続化(localStorage)。要件どおり毎回 OFF 起動。
- ポーズメニュー等、タイトル以外でのトグル。原作同様タイトルのみに設置(ゲーム中はタイトルで決めた状態に従う)。
- クレジット表記(別件)。

## リスク・トレードオフ

- `game.sound.mute` は BGM も SE も一括で無音化する(= 原作の master と一致。BGMのみ/SEのみの個別制御はしない)。
- 開始シーケンスは tween 近似のため、原作とピクセル単位で同一にはならない(見た目重視で調整)。
- player スプライトのフレーム index(11/13/12/5/6)は原作の (列,行) から算出。実装時にスクショで実フレームを目視確認する。
