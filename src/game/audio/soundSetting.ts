import Phaser from 'phaser';
import { playOpeningBgm } from './openingBgm';

// サウンド(BGM/SE 一括の master)有効状態。既定 OFF。
// ページ読み込みごとにモジュールが再初期化されるため、リロードで毎回 OFF に戻る(永続化しない)。
// 注: WebAudio の `game.sound.mute` getter は gain ノード由来で set 直後の読み取りが遅延し得るため、
//     状態のソースは Phaser 側ではなく本フラグを正とする。
let soundOn = false;

/** 現在サウンドが ON か。 */
export function isSoundOn(): boolean {
  return soundOn;
}

/**
 * サウンドの ON/OFF を反転する。master トグル(BGM/SE 一括)。
 * ON にした場合はタイトル/選択画面のオープニングBGMを起動する。
 * @returns 反転後にサウンドが ON なら true
 */
export function toggleSound(scene: Phaser.Scene): boolean {
  soundOn = !soundOn;
  scene.sound.mute = !soundOn;
  if (soundOn) playOpeningBgm(scene);
  return soundOn;
}
