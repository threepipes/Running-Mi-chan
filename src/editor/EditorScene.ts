import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { chipToIndex } from '../game/loaders/MapLoader';
import { EditorState } from './EditorState';
import type { EntityType } from '../game/loaders/EventLoader';

export const EDITOR_VIEW_W = 960;
export const EDITOR_VIEW_H = 640;

export type EditorTool = 'tile' | EntityType;

// エンティティ表示スタイル(色 + 短ラベル)。ゲーム画像が無い種別(STAR)のフォールバック表示と
// エディタUIのパレットで共有する。
export const ENTITY_STYLE: Record<EntityType, { color: number; label: string }> = {
  ENEMY: { color: 0xe74c3c, label: '敵' },
  NEEDLE: { color: 0x95a5a6, label: '針' },
  SPRING: { color: 0x27ae60, label: 'バ' },
  GATE: { color: 0x2980b9, label: '門' },
  STAR: { color: 0xf1c40f, label: '★' },
};

// 各エンティティのゲーム内テクスチャ(LevelBuilder と一致)。STAR はゲーム側で未描画のため画像無し。
export const ENTITY_TEXTURE: Partial<Record<EntityType, { key: string; frame?: number }>> = {
  ENEMY: { key: 'kuri', frame: 0 },
  NEEDLE: { key: 'toge' },
  SPRING: { key: 'spring', frame: 0 },
  GATE: { key: 'gate' },
};

export class EditorScene extends Phaser.Scene {
  state: EditorState = EditorState.empty(100, 30);
  onReady?: (scene: EditorScene) => void;

  private tool: EditorTool = 'tile';
  private selectedChip = 1;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private map!: Phaser.Tilemaps.Tilemap;
  private entityLayer!: Phaser.GameObjects.Container;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Editor');
  }

  preload(): void {
    this.load.image('mapTiles', 'assets/map.png');
    // エンティティ用のゲーム画像(BootScene と同じキー/パス)
    this.load.image('toge', 'assets/toge.png');
    this.load.image('gate', 'assets/gate.png');
    this.load.spritesheet('kuri', 'assets/kuri.png', { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
    this.load.spritesheet('spring', 'assets/jump.png', { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#5c94fc');
    this.buildMap();
    this.gridGfx = this.add.graphics().setDepth(20);
    this.entityLayer = this.add.container(0, 0).setDepth(10);
    this.cursor = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xffffff, 0.25)
      .setOrigin(0, 0)
      .setDepth(30);
    this.renderAll();
    this.setupInput();

    if (import.meta.env.DEV) {
      (window as unknown as { __editor?: EditorScene }).__editor = this;
    }
    this.onReady?.(this);
  }

  // 現在の state からタイルマップ(空レイヤ)を作り直す
  private buildMap(): void {
    this.map?.destroy();
    this.map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: this.state.width,
      height: this.state.height,
    });
    const tiles = this.map.addTilesetImage('mapTiles')!;
    this.layer = this.map.createBlankLayer('main', tiles)!;
    this.cameras.main.setBounds(0, 0, this.state.width * TILE_SIZE, this.state.height * TILE_SIZE);
  }

  loadState(state: EditorState): void {
    this.state = state;
    this.buildMap();
    this.renderAll();
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
  }

  setSelectedChip(chip: number): void {
    this.selectedChip = chip;
    this.tool = 'tile';
  }

  // 全タイル/エンティティ/グリッドを描画し直す
  private renderAll(): void {
    for (let y = 0; y < this.state.height; y++) {
      for (let x = 0; x < this.state.width; x++) this.drawTile(x, y);
    }
    this.renderEntities();
    this.drawGrid();
  }

  private drawTile(x: number, y: number): void {
    const index = chipToIndex(this.state.getTile(x, y));
    if (index < 0) this.layer.removeTileAt(x, y);
    else this.layer.putTileAt(index, x, y);
  }

  private renderEntities(): void {
    this.entityLayer.removeAll(true);
    for (const e of this.state.entities) {
      const px = e.tileX * TILE_SIZE;
      const py = e.tileY * TILE_SIZE;
      const tex = ENTITY_TEXTURE[e.type];
      if (tex) {
        // ゲームと同じ画像で表示
        const img = this.add.image(px, py, tex.key, tex.frame).setOrigin(0, 0);
        this.entityLayer.add(img);
      } else {
        // 画像が無い種別(STAR)は色マーカー+ラベルで表示
        const st = ENTITY_STYLE[e.type];
        const rect = this.add
          .rectangle(px, py, TILE_SIZE, TILE_SIZE, st.color, 0.85)
          .setOrigin(0, 0);
        const label = this.add
          .text(px + TILE_SIZE / 2, py + TILE_SIZE / 2, st.label, { fontSize: '16px', color: '#fff' })
          .setOrigin(0.5);
        this.entityLayer.add([rect, label]);
      }
    }
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x000000, 0.15);
    const w = this.state.width * TILE_SIZE;
    const h = this.state.height * TILE_SIZE;
    for (let x = 0; x <= this.state.width; x++) {
      this.gridGfx.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, h);
    }
    for (let y = 0; y <= this.state.height; y++) {
      this.gridGfx.lineBetween(0, y * TILE_SIZE, w, y * TILE_SIZE);
    }
  }

  private setupInput(): void {
    const space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // ホイール: 既定は上下スクロール(横成分dxも反映=トラックパッド対応)。Shift併用で横スクロール。
    this.input.on(
      'wheel',
      (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
        const cam = this.cameras.main;
        // Shift 判定はホイールイベント自身の修飾キーで行う(キーボードフォーカス非依存)
        const shiftHeld = (p.event as WheelEvent | undefined)?.shiftKey ?? false;
        if (shiftHeld) {
          cam.scrollX += dy;
        } else {
          cam.scrollX += dx;
          cam.scrollY += dy;
        }
      },
    );
    // スペース押下 + ドラッグでパン(上下左右自由)
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX;
      const wy = p.worldY;
      this.cursor.setPosition(Math.floor(wx / TILE_SIZE) * TILE_SIZE, Math.floor(wy / TILE_SIZE) * TILE_SIZE);
      if (space.isDown && p.isDown) {
        this.cameras.main.scrollX -= (p.x - p.prevPosition.x);
        this.cameras.main.scrollY -= (p.y - p.prevPosition.y);
        return;
      }
      if (p.isDown && this.tool === 'tile') this.paintAt(p);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (space.isDown) return; // パン中は編集しない
      this.editAt(p);
    });
  }

  // ポインタ位置のタイル座標に対して、現在ツールの編集を適用
  private editAt(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.tool === 'tile') {
      this.paintAt(p);
    } else {
      this.state.toggleEntity(this.tool, tx, ty);
      this.renderEntities();
    }
  }

  private paintAt(p: Phaser.Input.Pointer): void {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    if (this.state.getTile(tx, ty) === this.selectedChip) return;
    this.state.setTile(tx, ty, this.selectedChip);
    this.drawTile(tx, ty);
  }
}
