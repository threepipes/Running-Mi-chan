import Phaser from 'phaser';
import {
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  JUMP_VELOCITY,
  SPRING_VELOCITY,
  BGM_VOLUME,
  SE_VOLUME,
  ENEMY_SPEED,
} from '../config';
import { parseEvents } from '../game/loaders/EventLoader';
import { STAGES } from '../game/stages';
import { recordClear } from '../game/Progress';
import { registerAnims } from '../game/anims';
import { buildTilemap, spawnEntities } from '../game/LevelBuilder';
import { PlayerController } from '../game/PlayerController';
import { createImageButton } from '../ui/button';
import { ProgressBar } from '../ui/ProgressBar';
import { showGameClear, showGameOver, showPause } from '../ui/overlays';

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private worldWidth = 0;
  private worldHeight = 0;
  private player!: PlayerController;
  private enemies!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private springs!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private isEnded = false;
  private isPaused = false;
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];
  private startX = TILE_SIZE * 2;
  private startY = 0;
  private checkpointX = TILE_SIZE * 2;
  private checkpointY = 0;
  private goalX = 0;
  private stageIndex = 0;
  private usedGate = false;
  private resumeX?: number;
  private resumeY?: number;
  private resumeUsedGate = false;
  private progressBar!: ProgressBar;
  private bgm?: Phaser.Sound.BaseSound;
  private clearSe?: Phaser.Sound.BaseSound;

  constructor() {
    super('Game');
  }

  init(data?: {
    stageIndex?: number;
    resumeX?: number;
    resumeY?: number;
    usedGate?: boolean;
  }): void {
    this.stageIndex = data?.stageIndex ?? 0;
    this.resumeX = data?.resumeX;
    this.resumeY = data?.resumeY;
    this.resumeUsedGate = data?.usedGate ?? false;
  }

  create(): void {
    this.isEnded = false;
    this.isPaused = false;
    this.pauseObjects = [];
    // ゲームオーバー/クリア/ポーズで物理を止めているため、(再)開始時に必ず再開する
    this.physics.resume();

    // 背景(パララックス)
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    // マップを下方向に拡張した分、山(遠景)が中空に浮いて見えるので一段(1タイル)下げる
    this.add
      .image(0, GAME_HEIGHT + TILE_SIZE, 'yama')
      .setOrigin(0, 1)
      .setScrollFactor(0.3)
      .setDepth(-9);

    // タイルマップ
    const stage = STAGES[this.stageIndex];
    const level = buildTilemap(this, this.cache.binary.get(stage.mapKey) as ArrayBuffer);
    this.layer = level.layer;
    this.worldWidth = level.worldWidth;
    this.worldHeight = level.worldHeight;

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // プレイヤー初期位置。リトライ時は resume(チェックポイント)から、初回はスタートから
    // マップ下端に地面3段を足したぶん、worldHeight 基準の spawn も3段上げて地面上端の少し上に出す
    this.startY = this.worldHeight - TILE_SIZE * 7;
    const spawnX = this.resumeX ?? this.startX;
    const spawnY = this.resumeY ?? this.startY;
    this.checkpointX = spawnX;
    this.checkpointY = spawnY;
    this.usedGate = this.resumeUsedGate;
    this.goalX = this.worldWidth - GAME_WIDTH;

    registerAnims(this);

    this.player = new PlayerController(this, spawnX, spawnY, this.layer);

    // オートランなので、プレイヤーを画面やや左に置き前方を広く見せる(offsetXを負に)
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1, -GAME_WIDTH * 0.35, 0);
    this.cameras.main.setDeadzone(0, GAME_HEIGHT);

    // イベントからエンティティ生成し、衝突の挙動を配線
    const specs = parseEvents(this.cache.text.get(stage.eventKey) as string);
    const groups = spawnEntities(this, specs);
    this.enemies = groups.enemies;
    this.hazards = groups.hazards;
    this.springs = groups.springs;
    this.gates = groups.gates;
    this.wireOverlaps();

    // ゲーム中: ポーズボタン(左上)。押すとポーズメニューを表示
    createImageButton({
      scene: this,
      x: 52,
      y: 52,
      texture: 'button_pause',
      pressedTexture: 'button_pause_pressed',
      scrollFactor: 0,
      depth: 50,
      onClick: () => this.pauseGame(),
    });

    this.progressBar = new ProgressBar(this, this.goalX);

    // BGM: ゲームプレイ中はループ再生。ポーズで一時停止、クリア/オーバーで停止する。
    // シーン終了(タイトル/ステージ選択への遷移・リスタート)時は破棄して鳴り続け/多重再生を防ぐ。
    this.bgm = this.sound.add('bgm', { loop: true, volume: BGM_VOLUME });
    this.bgm.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bgm?.destroy();
      this.bgm = undefined;
      this.clearSe?.destroy(); // クリアSE(長め)がタイトル遷移後も鳴り続けないように破棄
      this.clearSe = undefined;
    });

    // 開発時のみ: E2Eスモークテスト用にシーンを公開(本番ビルドでは除去される)
    if (import.meta.env.DEV) {
      (window as unknown as { __scene?: GameScene }).__scene = this;
    }
  }

  private wireOverlaps(): void {
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.player.sprite, this.enemies, (_p, e) => {
      this.onEnemyOverlap(e as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player.sprite, this.hazards, () => {
      this.die();
    });
    this.physics.add.overlap(this.player.sprite, this.springs, (_p, s) => {
      if (this.isEnded) return;
      this.player.bounce(SPRING_VELOCITY);
      // 踏んだバネをアニメ(1→2→3で停止)。true=再生中は再スタートしない(overlap多重発火対策)
      (s as Phaser.Physics.Arcade.Sprite).anims.play('spring-bounce', true);
    });
    this.physics.add.overlap(this.player.sprite, this.gates, (_p, g) => {
      const gate = g as Phaser.Physics.Arcade.Sprite;
      this.usedGate = true;
      this.checkpointX = gate.x;
      this.checkpointY = gate.y - TILE_SIZE * 2;
    });
  }

  update(): void {
    this.progressBar.update(this.player.x);
    if (this.isEnded || this.isPaused) return;

    this.player.update();
    this.updateEnemies();

    // 即死: 前進方向の壁衝突
    if (this.player.isBlockedRight()) {
      this.die();
      return;
    }
    // 即死: 落下。頭(スプライト上端)まで完全に可視領域の下へ出てから判定する。
    // それまでは自由落下させ、落下死では死亡演出(飛び上がり/停止)を行わない。
    if (this.player.sprite.getBounds().top > this.cameras.main.scrollY + GAME_HEIGHT) {
      this.die(true);
      return;
    }
    // ゴール
    if (this.player.x >= this.goalX) {
      this.clear();
    }
  }

  // 原作準拠のポーズ: 物理を止めてメニュー(続ける/リスタート/タイトルへ)を表示
  private pauseGame(): void {
    if (this.isEnded || this.isPaused) return;
    this.isPaused = true;
    this.physics.pause();
    this.bgm?.pause(); // ポーズ中は BGM を止め、続けるで再開する
    this.pauseObjects = showPause(this, {
      onContinue: () => this.resumeGame(),
      onRestart: () => this.scene.restart({ stageIndex: this.stageIndex }),
      onTitle: () => this.scene.start('Title'),
    });
  }

  private resumeGame(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.pauseObjects.forEach((o) => o.destroy());
    this.pauseObjects = [];
    this.player.resetJumpInput(); // 「続ける」タップで溜まったジャンプ入力を捨てる
    this.physics.resume();
    this.bgm?.resume(); // ポーズ前の続きから BGM を再開
  }

  // 敵が壁(タイル)に当たったら進行方向を反転させる(左右にパトロール)
  private updateEnemies(): void {
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) continue;
      const body = e.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.left) {
        e.setVelocityX(ENEMY_SPEED); // 左の壁 → 右へ
      } else if (body.blocked.right) {
        e.setVelocityX(-ENEMY_SPEED); // 右の壁 → 左へ
      }
      // 進行方向に合わせて向き画像(アニメ)を切り替える(左=kuri-walk / 右=kuri-walk-right)
      if (body.velocity.x > 0) e.anims.play('kuri-walk-right', true);
      else if (body.velocity.x < 0) e.anims.play('kuri-walk', true);
    }
  }

  private onEnemyOverlap(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.isEnded || !enemy.active) return;
    // 元コード準拠: プレイヤーが敵より上にいれば踏みつけ
    if (this.player.y < enemy.y) {
      enemy.destroy();
      this.player.bounce(JUMP_VELOCITY);
    } else {
      this.die();
    }
  }

  // byFall=true は落下死(既に画面下へ落ちて隠れた状態)。この場合は飛び上がり演出を省く。
  private die(byFall = false): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.physics.pause(); // 敵の歩行を止める(プレイヤーの死亡演出は tween で行う)
    this.bgm?.stop(); // ゲームオーバーで BGM 停止
    this.sound.play('se_damaged', { volume: SE_VOLUME }); // ダメージSE(単発)
    this.cameras.main.stopFollow();
    // 死亡演出後にゲームオーバー画面。リトライはチェックポイント(ゲート/スタート)から
    this.player.playDeath(
      () =>
        showGameOver(this, {
          onRetry: () =>
            this.scene.restart({
              stageIndex: this.stageIndex,
              resumeX: this.checkpointX,
              resumeY: this.checkpointY,
              usedGate: this.usedGate,
            }),
          onSelect: () => this.scene.start('StageSelect'),
        }),
      byFall,
    );
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.bgm?.stop(); // ゴール(クリア)で BGM 停止(原作準拠)
    this.clearSe = this.sound.add('se_clear', { volume: SE_VOLUME });
    this.clearSe.play(); // クリアSE
    recordClear(this.stageIndex, !this.usedGate);

    // 原作準拠のクリア演出: みーちゃんは止めずに右へ走り抜けさせつつ約0.8秒で暗転し、
    // 全黒になってから gameclear 画面(タイトルへ)を表示する。
    // isEnded=true で update() は早期 return するため、走行速度は物理側で維持される。
    const cam = this.cameras.main;
    const black = this.add
      .rectangle(cam.centerX, cam.centerY, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0);
    this.tweens.add({
      targets: black,
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.physics.pause(); // 暗転後に敵の動きも止める
        showGameClear(this, { onTitle: () => this.scene.start('Title') });
      },
    });
  }
}
