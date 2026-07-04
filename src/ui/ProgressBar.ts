import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

// 進捗バーのレイアウト(原作準拠: bar_base 300x50, 内側パディング6)
const BAR_W = 300;
const BAR_PAD = 6;
const BAR_CENTER_Y = 60;

/**
 * 画面上部に固定表示するステージ進捗バー(基盤 + 赤い塗り + 現在位置ピン)。
 * `new ProgressBar(scene, goalX)` で生成し、毎フレーム `update(playerX)` を呼ぶ。
 */
export class ProgressBar {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly pin: Phaser.GameObjects.Image;
  private readonly goalX: number;
  private readonly innerLeft = GAME_WIDTH / 2 - BAR_W / 2 + BAR_PAD;
  private readonly innerWidth = BAR_W - BAR_PAD * 2;

  constructor(scene: Phaser.Scene, goalX: number) {
    this.goalX = goalX;
    // 赤い塗り(左端起点で scaleX により伸縮)
    this.fill = scene.add
      .rectangle(this.innerLeft, BAR_CENTER_Y, this.innerWidth, 12, 0xff1111)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(41);
    this.fill.scaleX = 0;
    // 基盤トラック
    scene.add.image(GAME_WIDTH / 2, BAR_CENTER_Y, 'bar_base').setScrollFactor(0).setDepth(40);
    // 現在位置ピン
    this.pin = scene.add
      .image(this.innerLeft, BAR_CENTER_Y - 15, 'bar_progress')
      .setScrollFactor(0)
      .setDepth(42);
  }

  update(playerX: number): void {
    const progress = Phaser.Math.Clamp(playerX / this.goalX, 0, 1);
    this.fill.scaleX = progress;
    this.pin.x = this.innerLeft + progress * this.innerWidth;
  }
}
