import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { GameScene } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: false },
  },
  scene: [BootScene, TitleScene, StageSelectScene, GameScene],
});

// 実表示領域(visualViewport)を実測して #game に反映し、Phaser の FIT を再計算する。
// モバイルのアドレスバー分でズレる 100vh/dvh を実測で補正し、黒帯+下はみ出しを防ぐ。
const gameEl = document.getElementById('game');
function fitToViewport(): void {
  if (!gameEl) return;
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  gameEl.style.width = `${w}px`;
  gameEl.style.height = `${h}px`;
  game.scale.refresh();
}
game.events.once('ready', fitToViewport);
window.addEventListener('resize', fitToViewport);
window.addEventListener('orientationchange', fitToViewport);
window.visualViewport?.addEventListener('resize', fitToViewport);
window.visualViewport?.addEventListener('scroll', fitToViewport);

// 開発時のみ: E2Eスモークテスト用にゲームインスタンスを公開(本番ビルドでは除去される)
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
