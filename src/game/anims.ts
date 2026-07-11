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
  // バネ(jump.png): 休止=frame 0。踏んだ瞬間に 1→2→3 と切り替え、最終フレーム(4番目)で
  // 停止する(repeat なし)。frameRate 30 ≒ 各画像2描画フレーム(60fps時)。
  // 注: アニメはゲーム全体で1度だけ登録されるため、frameRate 変更は完全リロードで反映される。
  scene.anims.create({
    key: 'spring-bounce',
    frames: scene.anims.generateFrameNumbers('spring', { frames: [1, 2, 3] }),
    frameRate: 30,
    repeat: 0,
  });
  // ラジオの音符(music.png 2フレーム)。各0.5秒でループ(原作: 30tick/frame @60fps)。
  scene.anims.create({
    key: 'music-note',
    frames: scene.anims.generateFrameNumbers('music', { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });
}
