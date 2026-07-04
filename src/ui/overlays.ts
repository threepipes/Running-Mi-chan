import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { createImageButton } from './button';

export interface OverlayActions {
  onRetry: () => void;
  onSelect: () => void;
}

// クリア/ゲームオーバー共通の2択ボタン(リトライ / ステージ選択へ)
function addResultButtons(scene: Phaser.Scene, cx: number, cy: number, actions: OverlayActions): void {
  const make = (dy: number, label: string, onClick: () => void) =>
    createImageButton({
      scene,
      x: cx,
      y: cy + dy,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label,
      scrollFactor: 0,
      depth: 100,
      onClick,
    });
  make(130, 'リトライ', actions.onRetry);
  make(235, 'ステージ選択へ', actions.onSelect);
}

/** クリア演出: gameclear 画像 + 2択ボタン */
export function showGameClear(scene: Phaser.Scene, actions: OverlayActions): void {
  const cx = scene.cameras.main.centerX;
  const cy = scene.cameras.main.centerY;
  scene.add.image(cx, cy - 80, 'gameclear').setScrollFactor(0).setDepth(100).setScale(0.6);
  addResultButtons(scene, cx, cy, actions);
}

/** ゲームオーバー演出: 暗転フェード → gameover 画像 + 2択ボタン */
export function showGameOver(scene: Phaser.Scene, actions: OverlayActions): void {
  const cam = scene.cameras.main;
  const black = scene.add
    .rectangle(cam.centerX, cam.centerY, GAME_WIDTH, GAME_HEIGHT, 0x000000)
    .setScrollFactor(0)
    .setDepth(90)
    .setAlpha(0);
  scene.tweens.add({
    targets: black,
    alpha: 0.7,
    duration: 300,
    onComplete: () => {
      const cx = cam.centerX;
      const cy = cam.centerY;
      scene.add.image(cx, cy - 80, 'gameover').setScrollFactor(0).setDepth(100).setScale(0.7);
      addResultButtons(scene, cx, cy, actions);
    },
  });
}
