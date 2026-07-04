import Phaser from 'phaser';
import { LEVEL } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload(): void {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('yama', 'assets/yama.png');
    this.load.image('toge', 'assets/toge.png');
    this.load.image('gate', 'assets/gate.png');
    this.load.image('mapTiles', 'assets/map.png');
    this.load.image('gameclear', 'assets/gameclear.png');
    this.load.image('gameover', 'assets/gameover.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: 32, frameHeight: 32 });
    this.load.binary('mapbin', `levels/map_${LEVEL}.map`);
    this.load.text('events', `levels/event_${LEVEL}.evt`);
  }
  create(): void {
    this.scene.start('Game');
  }
}
