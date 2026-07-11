import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { createImageButton } from '../ui/button';
import { playOpeningBgm } from '../game/audio/openingBgm';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }
  create(): void {
    // タイトル・ステージ選択で共有するオープニングBGM(遷移では鳴り直さず継続)
    playOpeningBgm(this);

    this.add.image(0, 0, 'title').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'title_logo').setOrigin(0.5);

    const go = () => this.scene.start('StageSelect');
    createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.7,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: 'スタート',
      onClick: go,
    });
    // キーボードでも開始可能
    this.input.keyboard!.once('keydown', go);
  }
}
