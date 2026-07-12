import Phaser from 'phaser';
import {
  RUN_SPEED,
  JUMP_VELOCITY,
  GAME_HEIGHT,
  BOUNCE_BOOST,
  BOUNCE_BOOST_WINDOW_MS,
  MAX_FALL_VELOCITY,
  JUMP_BUFFER_MS,
  SE_JUMP_VOLUME,
  seVolume,
} from '../config';

/**
 * プレイヤー(mi-chan)の操作を集約する。
 * - 自動前進 + ワンボタンジャンプ(Space/Up/タップ)
 * - バネ/踏みつけによる跳ね上げ。接触前後の猶予内にタップしていると跳躍が少し大きくなる
 *   (空中の追加ジャンプはしない = ジャンプ回数は増えない)
 * - 死亡演出(死亡ポーズ→跳ね→画面下へ落下)
 * 死亡判定・ゴール判定・衝突配線などのゲームルールは GameScene 側が持つ。
 */
export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly jumpKeys: Phaser.Input.Keyboard.Key[];
  private pointerJumpQueued = false;
  // 直近のジャンプ入力時刻(ms)。跳ね上げ接触「前」のタップ判定に使う
  private lastJumpAt = Number.NEGATIVE_INFINITY;
  // 跳ね上げ直後にブースト用タップを受け付ける期限(ms)。now <= これ の間だけ後追い受付
  private boostArmedUntil = 0;
  // 現在の跳ね上げでブースト適用済みか(二重適用防止)
  private boostApplied = false;
  // ジャンプ入力バッファの期限(ms)。着地直前に押した入力を覚え、接地時に発火する
  private jumpBufferedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, layer: Phaser.Tilemaps.TilemapLayer) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setCollideWorldBounds(false);
    scene.physics.add.collider(this.sprite, layer);

    this.jumpKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    ];
    scene.input.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        // UI(ポーズボタン等)上のタップはジャンプにしない。空き領域のタップのみジャンプ
        if (currentlyOver.length > 0) return;
        this.pointerJumpQueued = true;
      },
    );
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
    const body = this.sprite.body!;
    // 落下の終端速度クランプ(下方向のみ)。高所落下で地面をすり抜けるのを防ぐ。
    // 上方向(ジャンプ/バネ/ブースト)には干渉しないよう velocity.y > 0 のときだけ丸める。
    if (body.velocity.y > MAX_FALL_VELOCITY) {
      this.sprite.setVelocityY(MAX_FALL_VELOCITY);
    }
    const onGround = body.blocked.down;
    const now = this.scene.time.now;

    if (this.consumeJump()) {
      this.lastJumpAt = now;
      // 入力バッファに積む。接地していなくても JUMP_BUFFER_MS の間は覚えておき、
      // この後(または後続フレーム)で接地した時点で発火させる(着地直前の先行入力対応)。
      this.jumpBufferedUntil = now + JUMP_BUFFER_MS;
      if (!onGround && now <= this.boostArmedUntil && !this.boostApplied) {
        // 跳ね上げ直後の猶予内タップ: 上昇中の速度にブーストを後追い加算
        this.sprite.setVelocityY(body.velocity.y - BOUNCE_BOOST);
        this.boostApplied = true;
      }
    }

    // 接地中にバッファされたジャンプ入力があれば発火。押した瞬間に接地していれば
    // 即ジャンプ、着地直前に押していた場合は着地したフレームでジャンプする。
    if (onGround && now <= this.jumpBufferedUntil) {
      this.sprite.setVelocityY(-JUMP_VELOCITY);
      this.jumpBufferedUntil = 0;
      this.scene.sound.play('se_jump', { volume: seVolume(SE_JUMP_VOLUME) }); // ジャンプSE(単発)
    }

    this.sprite.anims.play(onGround ? 'run' : 'jump', true);
  }

  private consumeJump(): boolean {
    const keyJust = this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const pointer = this.pointerJumpQueued;
    this.pointerJumpQueued = false;
    return keyJust || pointer;
  }

  /** ポーズ再開時など、溜まったジャンプ入力を捨てる(再開直後の暴発防止) */
  resetJumpInput(): void {
    this.pointerJumpQueued = false;
    this.jumpBufferedUntil = 0;
  }

  /**
   * バネ/踏みつけによる跳ね上げ。
   * 接触「前」の猶予内にタップ済みなら即ブースト。未タップなら接触「後」の
   * 猶予内タップを受け付ける(update 側で後追い加算)。いずれも空中の追加ジャンプはしない。
   */
  bounce(velocity: number): void {
    const now = this.scene.time.now;
    const preTapped = now - this.lastJumpAt <= BOUNCE_BOOST_WINDOW_MS;
    this.sprite.setVelocityY(-(preTapped ? velocity + BOUNCE_BOOST : velocity));
    this.boostApplied = preTapped;
    this.boostArmedUntil = preTapped ? 0 : now + BOUNCE_BOOST_WINDOW_MS;
  }

  /** 死亡演出: 死亡ポーズ(frame7)→少し跳ねてから画面下へ落下→onComplete(原作 gameoverAnimation 準拠) */
  playDeath(onComplete: () => void, skipHop = false): void {
    if (skipHop) {
      // 落下死: 既に頭まで画面外へ落下済み。飛び上がり/落下演出はせず即ゲームオーバーへ。
      onComplete();
      return;
    }
    this.sprite.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setFrame(7);
    const fallY = this.scene.cameras.main.scrollY + GAME_HEIGHT + 80;
    // 通常死: 少し飛び上がってから画面下へ落下
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
