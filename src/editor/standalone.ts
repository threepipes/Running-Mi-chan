import Phaser from 'phaser';
import { EditorScene, EDITOR_VIEW_W, EDITOR_VIEW_H } from './EditorScene';
import { EditorUI } from './ui/EditorUI';

const scene = new EditorScene();
// create 完了時に DOM UI を配線(EditorScene 自体は DOM 非依存に保つ)
scene.onReady = (s) => {
  new EditorUI(
    s,
    document.getElementById('editor-toolbar')!,
    document.getElementById('editor-palette')!,
  );
};

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
