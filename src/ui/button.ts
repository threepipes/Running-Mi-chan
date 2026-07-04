import Phaser from 'phaser';

export interface ImageButtonOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  /** 通常時の画像キー */
  texture: string;
  /** 押下時の画像キー(あれば押下で差し替え) */
  pressedTexture?: string;
  /** 中央テキスト(無ければ画像のみ) */
  label?: string;
  fontSize?: string;
  /** カメラ固定用(既定1) */
  scrollFactor?: number;
  depth?: number;
  onClick: () => void;
}

/**
 * 原作のボタン画像を用いた画像ボタンを生成する。
 * 画像＋(任意)中央テキストを Container にまとめ、押下で pressedTexture に差し替える。
 */
export function createImageButton(opts: ImageButtonOptions): Phaser.GameObjects.Container {
  const { scene, x, y, texture, pressedTexture, label, fontSize = '28px', onClick } = opts;

  const img = scene.add.image(0, 0, texture).setOrigin(0.5);
  const parts: Phaser.GameObjects.GameObject[] = [img];
  if (label) {
    const text = scene.add
      .text(0, 0, label, { color: '#ffffff', fontSize })
      .setOrigin(0.5);
    parts.push(text);
  }

  const container = scene.add.container(x, y, parts);
  container.setSize(img.width, img.height);
  container.setInteractive({ useHandCursor: true });

  if (opts.scrollFactor !== undefined) container.setScrollFactor(opts.scrollFactor);
  if (opts.depth !== undefined) container.setDepth(opts.depth);

  const toPressed = () => {
    if (pressedTexture) img.setTexture(pressedTexture);
  };
  const toNormal = () => {
    if (pressedTexture) img.setTexture(texture);
  };

  container.on('pointerdown', toPressed);
  container.on('pointerout', toNormal);
  container.on('pointerup', () => {
    toNormal();
    onClick();
  });

  return container;
}
