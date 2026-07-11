import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { createImageButton } from '../ui/button';
import { registerAnims } from '../game/anims';
import { isSoundOn, toggleSound } from '../game/audio/soundSetting';

// 原作準拠の配置(540×960 座標系)。みーちゃんは切り株の上(PLAYER_Y)で寝て待機する。
const PLAYER_X = 98;
const PLAYER_Y = 828;
// 走行時の地面(スプライト上端 y)。原作 floor = WINDOW_HEIGHT - Player.HEIGHT*3 に一致。
// ジャンプ後はここ(=地面)に着地して走り出す(開始位置=切り株より下)。
const GROUND_Y = GAME_HEIGHT - TILE_SIZE * 3;
// 音符はラジオの右側に表示する。
const NOTE_X = 206;
const NOTE_Y = 824;
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
    // Phaser はシーンインスタンスを再利用するため、再入(タイトルへ戻る)時に必ずリセットする。
    // これを怠ると2回目以降スタートが発火しない(ソフトロック)。
    this.started = false;
    registerAnims(this);

    this.add.image(0, 0, 'title').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'title_logo').setOrigin(0.5);

    // みーちゃん(寝ポーズで待機)
    const player = this.add.sprite(PLAYER_X, PLAYER_Y, 'player', SLEEP_FRAME).setOrigin(0, 0);

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

    // スタート
    createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.7,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: 'スタート',
      onClick: () => this.startSequence(player),
    });
    this.input.keyboard!.once('keydown', () => this.startSequence(player));
  }

  private started = false;

  private startSequence(player: Phaser.GameObjects.Sprite): void {
    if (this.started) return;
    this.started = true;
    this.input.keyboard!.removeAllListeners('keydown');

    // 起きる
    player.setFrame(13);
    this.time.delayedCall(333, () => {
      // ジャンプ(+SE。muteならPhaserが自動で無音)。切り株から跳ね上がり、地面(GROUND_Y)に着地する。
      player.setFrame(12);
      this.sound.play('se_jump');
      const apexY = player.y - 80;
      this.tweens.add({
        targets: player,
        y: apexY,
        duration: 230,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: player,
            y: GROUND_Y, // 開始位置(切り株)ではなく地面へ落下して着地
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => {
              // 着地
              player.setFrame(5);
              this.time.delayedCall(167, () => {
                // 右向き
                player.setFrame(6);
                this.time.delayedCall(333, () => {
                  // 走り出し → 画面外(地面 GROUND_Y を走る)
                  player.play('run');
                  this.tweens.add({
                    targets: player,
                    x: GAME_WIDTH + 40,
                    duration: 1500,
                    ease: 'Linear',
                    onComplete: () => this.scene.start('StageSelect'),
                  });
                });
              });
            },
          });
        },
      });
    });
  }
}
