import Phaser from 'phaser';
import { playOpeningBgm } from './openingBgm';

/** 現在サウンドが有効(ミュート解除)か。 */
export function isSoundOn(sound: Phaser.Sound.BaseSoundManager): boolean {
  return !sound.mute;
}

/**
 * サウンドの ON/OFF を反転する。master トグル(BGM/SE 一括)。
 * ON にした場合はタイトル/選択画面のオープニングBGMを起動する。
 * @returns 反転後にサウンドが ON なら true
 */
export function toggleSound(scene: Phaser.Scene): boolean {
  const on = scene.sound.mute; // 現在ミュート → これから ON
  scene.sound.mute = !on;
  if (on) playOpeningBgm(scene);
  return on;
}
