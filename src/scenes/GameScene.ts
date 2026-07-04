import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { parseMap } from '../game/loaders/MapLoader';

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private worldWidth = 0;
  private worldHeight = 0;

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
  }
}
