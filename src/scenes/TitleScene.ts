import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { createImageButton } from '../ui/button';
import { registerAnims } from '../game/anims';
import { isSoundOn, toggleSound } from '../game/audio/soundSetting';

// 原作準拠の配置(540×960 座標系)
const PLAYER_X = 98;
const PLAYER_Y = 828;
const NOTE_X = 150;
const NOTE_Y = 840;
const SLEEP_FRAME = 11;

// タイトル背景(title.png)のラジオ位置。ここをタップするとサウンド ON/OFF を切り替える。
const RADIO_X = 188;
const RADIO_Y = 861;
const RADIO_W = 74;
const RADIO_H = 74;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    registerAnims(this);

    this.add.image(0, 0, 'title').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'title_logo').setOrigin(0.5);

    // みーちゃん(寝ポーズで待機)
    this.add.image(PLAYER_X, PLAYER_Y, 'player', SLEEP_FRAME).setOrigin(0, 0);

    // ラジオの音符(サウンドONのときだけ表示・アニメ)
    const note = this.add.sprite(NOTE_X, NOTE_Y, 'music', 0).setOrigin(0, 0);
    note.play('music-note');
    note.setVisible(isSoundOn());

    // サウンド ON/OFF トグル = 背景のラジオをタップ領域にする(専用ボタンは置かない)
    const radio = this.add
      .zone(RADIO_X, RADIO_Y, RADIO_W, RADIO_H)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    radio.on('pointerup', () => {
      const on = toggleSound(this);
      note.setVisible(on);
    });

    // スタート(この段階では即遷移。開始シーケンスは Task 4 で差し替え)
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
    this.input.keyboard!.once('keydown', go);
  }
}
