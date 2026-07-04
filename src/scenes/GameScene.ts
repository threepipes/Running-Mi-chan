import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }
  create(): void {
    this.cameras.main.setBackgroundColor('#5c94fc');
    this.add.text(20, 20, 'RunAction booting...', { color: '#ffffff' });
  }
}
