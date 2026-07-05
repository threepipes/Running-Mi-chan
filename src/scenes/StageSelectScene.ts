import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
import { STAGES, type StageDef } from '../game/stages';
import { loadProgress } from '../game/Progress';
import { parseEvents } from '../game/loaders/EventLoader';
import { createImageButton } from '../ui/button';

export class StageSelectScene extends Phaser.Scene {
  // デバッグ(ローカル開発時のみ): ON でステージを中間地点(ゲート)から開始する
  private startFromGate = false;

  constructor() {
    super('StageSelect');
  }
  create(): void {
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add
      .text(GAME_WIDTH / 2, 120, 'ステージ選択', { color: '#ffffff', fontSize: '40px' })
      .setOrigin(0.5);

    const progress = loadProgress();
    STAGES.forEach((stage, i) => {
      const y = 280 + i * 140;
      createImageButton({
        scene: this,
        x: GAME_WIDTH / 2,
        y,
        texture: 'button_large',
        pressedTexture: 'button_large_pressed',
        label: stage.name,
        fontSize: '24px',
        onClick: () => this.startStage(stage),
      });
      if (progress[i].cleared) {
        // ボタン右端にクリアスタンプを重ねる(depth を上げて前面へ)
        this.add
          .image(GAME_WIDTH / 2 + 150, y, progress[i].gateless ? 'stamp' : 'stamp_sub')
          .setOrigin(0.5)
          .setScale(0.6)
          .setDepth(1);
      }
    });

    createImageButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 90,
      texture: 'button_large',
      pressedTexture: 'button_large_pressed',
      label: 'タイトルへ',
      fontSize: '26px',
      onClick: () => this.scene.start('Title'),
    });

    // ローカル開発時のみ: 中間地点(ゲート)から開始するデバッグトグル。
    // 本番ビルドでは import.meta.env.DEV が false になりこのブロックごと除去される。
    if (import.meta.env.DEV) {
      const label = () => `[debug] 中間地点から開始: ${this.startFromGate ? 'ON' : 'OFF'}`;
      const toggle = this.add
        .text(GAME_WIDTH / 2, 200, label(), {
          color: '#ffff66',
          fontSize: '20px',
          backgroundColor: '#333333',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      toggle.on('pointerup', () => {
        this.startFromGate = !this.startFromGate;
        toggle.setText(label());
      });
    }
  }

  // ステージ開始。デバッグトグル ON かつゲートがあれば中間地点から、それ以外は先頭から開始。
  private startStage(stage: StageDef): void {
    if (import.meta.env.DEV && this.startFromGate) {
      const gate = this.findGateSpawn(stage);
      if (gate) {
        this.scene.start('Game', {
          stageIndex: stage.index,
          resumeX: gate.x,
          resumeY: gate.y,
          usedGate: true, // 中間地点開始はゲート使用扱い(クリア記録もそれに準ずる)
        });
        return;
      }
    }
    this.scene.start('Game', { stageIndex: stage.index });
  }

  // ステージのイベントから GATE を探し、開始位置(ゲート衝突時のチェックポイントと同じ算出)を返す。
  private findGateSpawn(stage: StageDef): { x: number; y: number } | null {
    const text = this.cache.text.get(stage.eventKey) as string | undefined;
    if (!text) return null;
    const gate = parseEvents(text).find((e) => e.type === 'GATE');
    if (!gate) return null;
    const px = gate.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = gate.tileY * TILE_SIZE + TILE_SIZE / 2;
    return { x: px, y: py - TILE_SIZE * 2 };
  }
}
