import Phaser from 'phaser';
import { TILE_SIZE, ENEMY_SPEED } from '../config';
import { parseMap } from './loaders/MapLoader';
import type { EntitySpec } from './loaders/EventLoader';

export interface BuiltTilemap {
  layer: Phaser.Tilemaps.TilemapLayer;
  worldWidth: number;
  worldHeight: number;
}

export interface LevelGroups {
  enemies: Phaser.Physics.Arcade.Group;
  hazards: Phaser.Physics.Arcade.StaticGroup;
  springs: Phaser.Physics.Arcade.StaticGroup;
  gates: Phaser.Physics.Arcade.StaticGroup;
}

/** .map バイナリからタイルマップと衝突レイヤーを構築する */
export function buildTilemap(scene: Phaser.Scene, mapBuffer: ArrayBuffer): BuiltTilemap {
  const parsed = parseMap(mapBuffer);
  const map = scene.make.tilemap({
    data: parsed.data,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
  });
  const tiles = map.addTilesetImage('mapTiles')!;
  const layer = map.createLayer(0, tiles, 0, 0)!;
  layer.setCollisionByExclusion([-1]);
  return {
    layer,
    worldWidth: parsed.width * TILE_SIZE,
    worldHeight: parsed.height * TILE_SIZE,
  };
}

/**
 * イベント定義からエンティティ群を生成する(生成のみ。衝突の挙動配線は行わない)。
 * .evt のタイル座標は左上基準だが Phaser スプライトは origin=0.5 なので、タイル中心に配置する。
 */
export function spawnEntities(scene: Phaser.Scene, specs: EntitySpec[]): LevelGroups {
  const enemies = scene.physics.add.group();
  const hazards = scene.physics.add.staticGroup();
  const springs = scene.physics.add.staticGroup();
  const gates = scene.physics.add.staticGroup();

  for (const s of specs) {
    const px = s.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = s.tileY * TILE_SIZE + TILE_SIZE / 2;
    if (s.type === 'ENEMY') {
      const e = enemies.create(px, py, 'kuri', 0) as Phaser.Physics.Arcade.Sprite;
      e.setVelocityX(-ENEMY_SPEED);
      e.anims.play('kuri-walk', true);
    } else if (s.type === 'NEEDLE') {
      hazards.create(px, py, 'toge');
    } else if (s.type === 'SPRING') {
      springs.create(px, py, 'spring', 0);
    } else if (s.type === 'GATE') {
      gates.create(px, py, 'gate');
    }
  }

  return { enemies, hazards, springs, gates };
}
