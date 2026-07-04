import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, JUMP_VELOCITY, SPRING_VELOCITY } from '../config';
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
    this.add
      .image(0, GAME_HEIGHT, 'yama')
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
    this.startY = this.worldHeight - TILE_SIZE * 4;
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
    this.physics.add.overlap(this.player.sprite, this.springs, () => {
      if (this.isEnded) return;
      this.player.bounce(SPRING_VELOCITY);
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

    // 即死: 前進方向の壁衝突
    if (this.player.isBlockedRight()) {
      this.die();
      return;
    }
    // 即死: 落下
    if (this.player.y > this.worldHeight) {
      this.die();
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

  private die(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.physics.pause(); // 敵の歩行を止める(プレイヤーの死亡演出は tween で行う)
    this.cameras.main.stopFollow();
    // 死亡ポーズ→落下の演出後にゲームオーバー画面。リトライはチェックポイント(ゲート/スタート)から
    this.player.playDeath(() =>
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
    );
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
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
