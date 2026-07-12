import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './config';
import { isSoundOn } from './game/audio/soundSetting';
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
    // tileBias: 高速で侵入したタイルを押し戻す余裕(既定16→32)。落下貫通対策の安全網
    arcade: { gravity: { x: 0, y: GRAVITY_Y }, tileBias: 32, debug: false },
  },
  scene: [BootScene, TitleScene, StageSelectScene, GameScene],
});

// サウンド master 状態(既定 ON)を Phaser のミュートに反映する。単一情報源は soundSetting。
// ブラウザの自動再生制約により、実際の音は最初のユーザー操作まで鳴らない。
game.sound.mute = !isSoundOn();

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

// --- iOS Safari のオーディオ対策 ---
// (A) WebAudio を「メディア」区分にして消音スイッチ非依存で鳴らす(iOS 16.4+)。
//     Web Audio はデバイスがミュートだと鳴らない(HTML5音声とは非対称)ため。
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } };
const nav = navigator as NavigatorWithAudioSession;
if (nav.audioSession) {
  try {
    nav.audioSession.type = 'playback';
  } catch {
    /* 未対応環境は無視 */
  }
}

// (B) 初回のユーザー操作、および復帰(フォーカス/可視化)時に AudioContext を確実に resume/unlock する。
//     iOS では context が suspended/interrupted になり、Phaser の自動解除が漏れることがあるため保険をかける。
function resumeAudio(): void {
  const sound = game.sound as Phaser.Sound.WebAudioSoundManager;
  const ctx = sound.context as AudioContext | undefined;
  if (ctx && ctx.state !== 'running') {
    ctx.resume().catch(() => {});
  }
  if (game.sound.locked) {
    game.sound.unlock();
  }
}
for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) {
  window.addEventListener(ev, resumeAudio);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resumeAudio();
});

// 開発時のみ: E2Eスモークテスト用にゲームインスタンスを公開(本番ビルドでは除去される)
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
