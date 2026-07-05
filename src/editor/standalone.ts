import Phaser from 'phaser';
import { EditorScene, EDITOR_VIEW_W, EDITOR_VIEW_H } from './EditorScene';

const scene = new EditorScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'editor-canvas',
  width: EDITOR_VIEW_W,
  height: EDITOR_VIEW_H,
  backgroundColor: '#5c94fc',
  scene: [scene],
});

if (import.meta.env.DEV) {
  (window as unknown as { __editorGame?: Phaser.Game }).__editorGame = game;
}
