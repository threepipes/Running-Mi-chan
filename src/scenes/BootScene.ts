import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload(): void {
    // Task 5 でアセット読み込みを実装する
  }
  create(): void {
    this.scene.start('Game');
  }
}
