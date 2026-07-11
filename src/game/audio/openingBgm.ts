import Phaser from 'phaser';
import { BGM_VOLUME } from '../../config';

// タイトル・ステージ選択画面で共有するオープニングBGM。
// Phaser の SoundManager はゲーム全体で共有されるため、キーで既存インスタンスを引き回し、
// Title ↔ StageSelect の遷移では鳴り直さず(継続再生)、ゲーム開始で停止する。
const OPENING_KEY = 'bgm_opening';

export function playOpeningBgm(scene: Phaser.Scene): void {
  let bgm = scene.sound.get(OPENING_KEY);
  if (!bgm) {
    bgm = scene.sound.add(OPENING_KEY, { loop: true, volume: BGM_VOLUME });
  }
  if (!bgm.isPlaying) bgm.play();
}

export function stopOpeningBgm(scene: Phaser.Scene): void {
  scene.sound.get(OPENING_KEY)?.stop();
}
