import Phaser from 'phaser';
import {
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  RUN_SPEED,
  JUMP_VELOCITY,
  SPRING_VELOCITY,
} from '../config';
import { parseEvents } from '../game/loaders/EventLoader';
import { STAGES } from '../game/stages';
import { recordClear } from '../game/Progress';
import { registerAnims } from '../game/anims';
import { buildTilemap, spawnEntities } from '../game/LevelBuilder';
import { createImageButton } from '../ui/button';
import { ProgressBar } from '../ui/ProgressBar';
import { showGameClear, showGameOver } from '../ui/overlays';

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private worldWidth = 0;
  private worldHeight = 0;
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private springs!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private jumpKeys!: Phaser.Input.Keyboard.Key[];
  private pointerJump = false;
  private forceJump = false;
  private isEnded = false;
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
    this.pointerJump = false;
    this.forceJump = false;
    // ゲームオーバー/クリアで物理を止めているため、(再)開始時に必ず再開する
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

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player', 0);
    this.player.setCollideWorldBounds(false);
    this.physics.add.collider(this.player, this.layer);

    // オートランなので、プレイヤーを画面やや左に置き前方を広く見せる(offsetXを負に)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, -GAME_WIDTH * 0.18, 0);
    this.cameras.main.setDeadzone(0, GAME_HEIGHT);

    // イベントからエンティティ生成し、衝突の挙動を配線
    const specs = parseEvents(this.cache.text.get(stage.eventKey) as string);
    const groups = spawnEntities(this, specs);
    this.enemies = groups.enemies;
    this.hazards = groups.hazards;
    this.springs = groups.springs;
    this.gates = groups.gates;
    this.wireOverlaps();

    // 入力(キーボード + タップ)
    this.jumpKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    ];
    this.input.on('pointerdown', () => {
      this.pointerJump = true;
    });

    // ゲーム中: ポーズ相当の小ボタン(左上)。押すと選択画面へ戻る
    createImageButton({
      scene: this,
      x: 52,
      y: 52,
      texture: 'button_pause',
      pressedTexture: 'button_pause_pressed',
      scrollFactor: 0,
      depth: 50,
      onClick: () => this.scene.start('StageSelect'),
    });

    this.progressBar = new ProgressBar(this, this.goalX);

    // 開発時のみ: E2Eスモークテスト用にシーンを公開(本番ビルドでは除去される)
    if (import.meta.env.DEV) {
      (window as unknown as { __scene?: GameScene }).__scene = this;
    }
  }

  private wireOverlaps(): void {
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.onEnemyOverlap(e as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.hazards, () => {
      this.die();
    });
    this.physics.add.overlap(this.player, this.springs, () => {
      if (this.isEnded) return;
      this.player.setVelocityY(-SPRING_VELOCITY);
      this.forceJump = true;
    });
    this.physics.add.overlap(this.player, this.gates, (_p, g) => {
      const gate = g as Phaser.Physics.Arcade.Sprite;
      this.usedGate = true;
      this.checkpointX = gate.x;
      this.checkpointY = gate.y - TILE_SIZE * 2;
    });
  }

  update(): void {
    this.progressBar.update(this.player.x);
    if (this.isEnded) return;

    this.player.setVelocityX(RUN_SPEED);

    const onGround = this.player.body!.blocked.down;
    if (this.consumeJump() && (onGround || this.forceJump)) {
      this.player.setVelocityY(-JUMP_VELOCITY);
      this.forceJump = false;
    }

    this.player.anims.play(onGround ? 'run' : 'jump', true);

    // 即死: 前進方向の壁衝突
    if (this.player.body!.blocked.right) {
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

  private consumeJump(): boolean {
    const keyJust = this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const pointer = this.pointerJump;
    this.pointerJump = false;
    return keyJust || pointer;
  }

  private onEnemyOverlap(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.isEnded || !enemy.active) return;
    // 元コード準拠: プレイヤーが敵より上にいれば踏みつけ
    if (this.player.y < enemy.y) {
      enemy.destroy();
      this.forceJump = true;
      this.player.setVelocityY(-JUMP_VELOCITY);
    } else {
      this.die();
    }
  }

  private die(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
    this.physics.pause(); // 敵の歩行を止める(プレイヤーの死亡演出は tween で行う)
    this.cameras.main.stopFollow();
    this.player.anims.stop();
    this.player.setFrame(7); // 死亡ポーズ(原作 gameoverAnimation: col3,row1)
    this.playDeathAnimation();
  }

  // 原作 gameoverAnimation 準拠: 少し跳ねてから画面下へ落下 → ゲームオーバー表示
  private playDeathAnimation(): void {
    const fallY = this.cameras.main.scrollY + GAME_HEIGHT + 80;
    this.tweens.add({
      targets: this.player,
      y: this.player.y - 70,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.player,
          y: fallY,
          duration: 500,
          ease: 'Quad.easeIn',
          // 落下後にゲームオーバー画面。リトライはチェックポイント(通過ゲート/スタート)から
          onComplete: () =>
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
        });
      },
    });
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
    this.physics.pause(); // クリア後も敵が動き続けないように止める
    recordClear(this.stageIndex, !this.usedGate);
    showGameClear(this, {
      onRetry: () => this.scene.restart({ stageIndex: this.stageIndex }),
      onSelect: () => this.scene.start('StageSelect'),
    });
  }
}
