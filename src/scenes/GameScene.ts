import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, RUN_SPEED, JUMP_VELOCITY } from '../config';
import { parseMap } from '../game/loaders/MapLoader';

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private worldWidth = 0;
  private worldHeight = 0;
  private player!: Phaser.Physics.Arcade.Sprite;
  private jumpKeys!: Phaser.Input.Keyboard.Key[];
  private pointerJump = false;
  private forceJump = false;
  private isEnded = false;
  private startX = TILE_SIZE * 2;
  private startY = 0;
  private checkpointX = TILE_SIZE * 2;
  private checkpointY = 0;
  private goalX = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    // 背景(パララックス)
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    this.add
      .image(0, GAME_HEIGHT, 'yama')
      .setOrigin(0, 1)
      .setScrollFactor(0.3)
      .setDepth(-9);

    // タイルマップ
    const parsed = parseMap(this.cache.binary.get('mapbin') as ArrayBuffer);
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

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(0, GAME_HEIGHT);

    // 入力(キーボード + タップ)
    this.jumpKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    ];
    this.input.on('pointerdown', () => {
      this.pointerJump = true;
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

  private die(): void {
    if (this.isEnded) return;
    this.player.setPosition(this.checkpointX, this.checkpointY);
    this.player.setVelocity(0, 0);
    this.forceJump = false;
  }

  private clear(): void {
    if (this.isEnded) return;
    this.isEnded = true;
    this.player.setVelocity(0, 0);
  }
}
