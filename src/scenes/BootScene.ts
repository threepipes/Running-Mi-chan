import Phaser from 'phaser';
import { STAGES } from '../game/stages';
import { AUDIO_KEY } from '../config';
import { xorBytes } from '../game/audio/descramble';

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
    this.load.image('button_large', 'assets/button_large.png');
    this.load.image('button_large_pressed', 'assets/button_large_pressed.png');
    this.load.image('button_pause', 'assets/button_pause.png');
    this.load.image('button_pause_pressed', 'assets/button_pause_pressed.png');
    this.load.image('bar_base', 'assets/bar_base.png');
    this.load.image('bar_progress', 'assets/bar_progress.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('music', 'assets/music.png', { frameWidth: 32, frameHeight: 32 });
    this.load.binary('bgm_enc', 'assets/running.dat');
    this.load.binary('bgm_stage2_enc', 'assets/stage2.dat');
    this.load.binary('bgm_stage3_enc', 'assets/stage3.dat');
    this.load.binary('bgm_opening_enc', 'assets/opening.dat');
    this.load.binary('se_damaged_enc', 'assets/damaged.dat');
    this.load.binary('se_jump_enc', 'assets/jump.dat');
    this.load.binary('se_spring_enc', 'assets/jump-l.dat');
    this.load.binary('se_clear_enc', 'assets/clear.dat');
    for (const stage of STAGES) {
      this.load.binary(stage.mapKey, stage.mapFile);
      this.load.text(stage.eventKey, stage.eventFile);
    }
  }
  create(): void {
    const pairs: { srcKey: string; dstKey: string }[] = [
      { srcKey: 'bgm_enc', dstKey: 'bgm' },
      { srcKey: 'bgm_stage2_enc', dstKey: 'bgm_stage2' },
      { srcKey: 'bgm_stage3_enc', dstKey: 'bgm_stage3' },
      { srcKey: 'bgm_opening_enc', dstKey: 'bgm_opening' },
      { srcKey: 'se_damaged_enc', dstKey: 'se_damaged' },
      { srcKey: 'se_jump_enc', dstKey: 'se_jump' },
      { srcKey: 'se_spring_enc', dstKey: 'se_spring' },
      { srcKey: 'se_clear_enc', dstKey: 'se_clear' },
    ];
    const decodeList = pairs.map(({ srcKey, dstKey }) => {
      const enc = new Uint8Array(this.cache.binary.get(srcKey) as ArrayBuffer);
      const data = xorBytes(enc, AUDIO_KEY);
      return { key: dstKey, data: data.buffer as ArrayBuffer };
    });

    this.sound.once(Phaser.Sound.Events.DECODED_ALL, () => this.scene.start('Title'));
    (this.sound as Phaser.Sound.WebAudioSoundManager).decodeAudio(decodeList);
  }
}
