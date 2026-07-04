import Phaser from 'phaser';
import { STAGES } from '../game/stages';

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
    this.load.image('title', 'assets/title.png');
    this.load.image('title_logo', 'assets/title_logo.png');
    this.load.image('stamp', 'assets/stamp.png');
    this.load.image('stamp_sub', 'assets/stamp_sub.png');
    this.load.image('button', 'assets/button.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: 32, frameHeight: 32 });
    for (const stage of STAGES) {
      this.load.binary(stage.mapKey, stage.mapFile);
      this.load.text(stage.eventKey, stage.eventFile);
    }
  }
  create(): void {
    // Task 6 で 'Title' に変更する
    this.scene.start('Game');
  }
}
