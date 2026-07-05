import Phaser from 'phaser';

/**
 * プレイヤー(run/jump)と敵(kuri-walk)のアニメーションを登録する。
 * アニメはゲーム(グローバル)スコープなので、重複登録を避けるため exists ガードを行う。
 */
export function registerAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists('run')) return;
  scene.anims.create({
    key: 'run',
    frames: scene.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 3] }),
    frameRate: 12,
    repeat: -1,
  });
  scene.anims.create({
    key: 'jump',
    frames: [{ key: 'player', frame: 4 }],
    frameRate: 1,
  });
  // kuri.png は 左向き=frame 0,1 / 右向き=frame 2,3(原作 Kuribo 準拠)
  scene.anims.create({
    key: 'kuri-walk',
    frames: scene.anims.generateFrameNumbers('kuri', { frames: [0, 1] }),
    frameRate: 6,
    repeat: -1,
  });
  scene.anims.create({
    key: 'kuri-walk-right',
    frames: scene.anims.generateFrameNumbers('kuri', { frames: [2, 3] }),
    frameRate: 6,
    repeat: -1,
  });
}
