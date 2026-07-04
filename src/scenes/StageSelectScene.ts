import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { STAGES } from '../game/stages';
import { loadProgress } from '../game/Progress';

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }
  create(): void {
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add
      .text(GAME_WIDTH / 2, 120, 'ステージ選択', { color: '#ffffff', fontSize: '40px' })
      .setOrigin(0.5);

    const progress = loadProgress();
    STAGES.forEach((stage, i) => {
      const y = 280 + i * 140;
      const btn = this.add
        .image(GAME_WIDTH / 2, y, 'button')
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GAME_WIDTH / 2, y, stage.name, { color: '#000000', fontSize: '24px' })
        .setOrigin(0.5);
      if (progress[i].cleared) {
        this.add
          .image(GAME_WIDTH / 2 + 130, y, progress[i].gateless ? 'stamp' : 'stamp_sub')
          .setOrigin(0.5)
          .setScale(0.6);
      }
      btn.on('pointerup', () => this.scene.start('Game', { stageIndex: stage.index }));
    });

    const back = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, '← タイトルへ', {
        color: '#ffffff',
        fontSize: '26px',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Title'));
  }
}
