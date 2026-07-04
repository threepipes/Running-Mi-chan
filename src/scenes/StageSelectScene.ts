import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { STAGES } from '../game/stages';
import { loadProgress } from '../game/Progress';
import { createImageButton } from '../ui/button';

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
      createImageButton({
        scene: this,
        x: GAME_WIDTH / 2,
        y,
        texture: 'button_large',
        pressedTexture: 'button_large_pressed',
        label: stage.name,
        fontSize: '24px',
        onClick: () => this.scene.start('Game', { stageIndex: stage.index }),
      });
      if (progress[i].cleared) {
        // ボタン右端にクリアスタンプを重ねる(depth を上げて前面へ)
        this.add
          .image(GAME_WIDTH / 2 + 150, y, progress[i].gateless ? 'stamp' : 'stamp_sub')
          .setOrigin(0.5)
          .setScale(0.6)
          .setDepth(1);
      }
    });

    createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 90,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: 'タイトルへ',
      fontSize: '26px',
      onClick: () => this.scene.start('Title'),
    });
  }
}
