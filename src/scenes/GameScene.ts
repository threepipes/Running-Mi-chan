import Phaser from 'phaser';
import {
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  RUN_SPEED,
  JUMP_VELOCITY,
  ENEMY_SPEED,
  SPRING_VELOCITY,
} from '../config';
import { parseMap } from '../game/loaders/MapLoader';
import { parseEvents, type EntitySpec } from '../game/loaders/EventLoader';
import { STAGES } from '../game/stages';
import { recordClear } from '../game/Progress';
import { createImageButton } from '../ui/button';

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
  private specs: EntitySpec[] = [];

  constructor() {
    super('Game');
  }

  init(data?: { stageIndex?: number }): void {
    this.stageIndex = data?.stageIndex ?? 0;
  }

  create(): void {
    this.isEnded = false;
    this.pointerJump = false;
    this.forceJump = false;
    this.usedGate = false;

    // 背景(パララックス)
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    this.add
      .image(0, GAME_HEIGHT, 'yama')
      .setOrigin(0, 1)
      .setScrollFactor(0.3)
      .setDepth(-9);

    // タイルマップ
    const stage = STAGES[this.stageIndex];
    const parsed = parseMap(this.cache.binary.get(stage.mapKey) as ArrayBuffer);
    this.worldWidth = parsed.width * TILE_SIZE;
    this.worldHeight = parsed.height * TILE_SIZE;

    const map = this.make.tilemap({
      data: parsed.data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tiles = map.addTilesetImage('mapTiles')!;
    this.layer = map.createLayer(0, tiles, 0, 0)!;
    this.layer.setCollisionByExclusion([-1]);

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // プレイヤー初期位置(スタート地点のやや上空)
    this.startY = this.worldHeight - TILE_SIZE * 4;
    this.checkpointX = this.startX;
    this.checkpointY = this.startY;
    this.goalX = this.worldWidth - GAME_WIDTH;

    this.createAnims();

    this.player = this.physics.add.sprite(this.startX, this.startY, 'player', 0);
    this.player.setCollideWorldBounds(false);
    this.physics.add.collider(this.player, this.layer);

    // オートランなので、プレイヤーを画面やや左に置き前方を広く見せる(offsetXを負に)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, -GAME_WIDTH * 0.18, 0);
    this.cameras.main.setDeadzone(0, GAME_HEIGHT);

    // イベントからエンティティ生成
    this.specs = parseEvents(this.cache.text.get(stage.eventKey) as string);
    this.spawnEntities(this.specs);
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

    // 開発時のみ: E2Eスモークテスト用にシーンを公開(本番ビルドでは除去される)
    if (import.meta.env.DEV) {
      (window as unknown as { __scene?: GameScene }).__scene = this;
    }
  }

  private spawnEntities(specs: EntitySpec[]): void {
    this.enemies = this.physics.add.group();
    this.hazards = this.physics.add.staticGroup();
    this.springs = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();

    for (const s of specs) {
      // .evt のタイル座標は左上基準。Phaser のスプライトはデフォルト origin=0.5(中心)なので
      // タイル中心に配置してズレを防ぐ
      const px = s.tileX * TILE_SIZE + TILE_SIZE / 2;
      const py = s.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (s.type === 'ENEMY') {
        this.spawnEnemy(s.tileX, s.tileY);
      } else if (s.type === 'NEEDLE') {
        this.hazards.create(px, py, 'toge');
      } else if (s.type === 'SPRING') {
        this.springs.create(px, py, 'spring', 0);
      } else if (s.type === 'GATE') {
        this.gates.create(px, py, 'gate');
      }
    }
  }

  private spawnEnemy(tileX: number, tileY: number): void {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    const e = this.enemies.create(px, py, 'kuri', 0) as Phaser.Physics.Arcade.Sprite;
    e.setVelocityX(-ENEMY_SPEED);
    e.anims.play('kuri-walk', true);
  }

  // 死亡時に敵を初期配置へ復元する(踏んで消えた敵・移動した敵を元に戻す)
  private respawnEnemies(): void {
    this.enemies.clear(true, true);
    for (const s of this.specs) {
      if (s.type === 'ENEMY') this.spawnEnemy(s.tileX, s.tileY);
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

  private createAnims(): void {
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 3] }),
        frameRate: 12,
        repeat: -1,
      });
      this.anims.create({
        key: 'jump',
        frames: [{ key: 'player', frame: 4 }],
        frameRate: 1,
      });
      this.anims.create({
        key: 'kuri-walk',
        frames: this.anims.generateFrameNumbers('kuri', { frames: [0, 1] }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  update(): void {
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
    this.player.setPosition(this.checkpointX, this.checkpointY);
    this.player.setVelocity(0, 0);
    this.forceJump = false;
    this.respawnEnemies();
    this.cameras.main.flash(200, 255, 0, 0);
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
    recordClear(this.stageIndex, !this.usedGate);
    this.showResult();
  }

  private showResult(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    this.add
      .image(cx, cy - 80, 'gameclear')
      .setScrollFactor(0)
      .setDepth(100)
      .setScale(0.6);

    const makeButton = (dy: number, label: string, onClick: () => void) => {
      createImageButton({
        scene: this,
        x: cx,
        y: cy + dy,
        texture: 'button_large',
        pressedTexture: 'button_large_pressed',
        label,
        scrollFactor: 0,
        depth: 100,
        onClick,
      });
    };

    makeButton(130, 'リトライ', () => this.scene.restart({ stageIndex: this.stageIndex }));
    makeButton(235, 'ステージ選択へ', () => this.scene.start('StageSelect'));
  }
}
