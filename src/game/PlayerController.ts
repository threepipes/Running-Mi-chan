import Phaser from 'phaser';
import { RUN_SPEED, JUMP_VELOCITY, GAME_HEIGHT } from '../config';

/**
 * プレイヤー(mi-chan)の操作を集約する。
 * - 自動前進 + ワンボタンジャンプ(Space/Up/タップ)
 * - バネ/踏みつけによる跳ね上げ(空中再ジャンプ許可)
 * - 死亡演出(死亡ポーズ→跳ね→画面下へ落下)
 * 死亡判定・ゴール判定・衝突配線などのゲームルールは GameScene 側が持つ。
 */
export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly jumpKeys: Phaser.Input.Keyboard.Key[];
  private pointerJumpQueued = false;
  private forceJump = false;

  constructor(scene: Phaser.Scene, x: number, y: number, layer: Phaser.Tilemaps.TilemapLayer) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setCollideWorldBounds(false);
    scene.physics.add.collider(this.sprite, layer);

    this.jumpKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    ];
    scene.input.on('pointerdown', () => {
      this.pointerJumpQueued = true;
    });
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  isBlockedRight(): boolean {
    return this.sprite.body!.blocked.right;
  }

  /** 毎フレーム: 自動前進 + ジャンプ入力処理 + アニメ */
  update(): void {
    this.sprite.setVelocityX(RUN_SPEED);
    const onGround = this.sprite.body!.blocked.down;
    if (this.consumeJump() && (onGround || this.forceJump)) {
      this.sprite.setVelocityY(-JUMP_VELOCITY);
      this.forceJump = false;
    }
    this.sprite.anims.play(onGround ? 'run' : 'jump', true);
  }

  private consumeJump(): boolean {
    const keyJust = this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const pointer = this.pointerJumpQueued;
    this.pointerJumpQueued = false;
    return keyJust || pointer;
  }

  /** バネ/踏みつけによる跳ね上げ。空中でも再ジャンプできるようにする */
  bounce(velocity: number): void {
    this.sprite.setVelocityY(-velocity);
    this.forceJump = true;
  }

  /** 死亡演出: 死亡ポーズ(frame7)→少し跳ねてから画面下へ落下→onComplete(原作 gameoverAnimation 準拠) */
  playDeath(onComplete: () => void): void {
    this.sprite.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setFrame(7);
    const fallY = this.scene.cameras.main.scrollY + GAME_HEIGHT + 80;
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 70,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.sprite,
          y: fallY,
          duration: 500,
          ease: 'Quad.easeIn',
          onComplete,
        });
      },
    });
  }
}
