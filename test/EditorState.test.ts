import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';

describe('EditorState', () => {
  it('empty は全セル 0・エンティティ空', () => {
    const s = EditorState.empty(3, 2);
    expect(s.width).toBe(3);
    expect(s.height).toBe(2);
    expect(s.getTile(0, 0)).toBe(0);
    expect(s.getTile(2, 1)).toBe(0);
    expect(s.entities.length).toBe(0);
  });

  it('setTile/getTile が読み書きでき、境界外は無視/0', () => {
    const s = EditorState.empty(3, 2);
    s.setTile(1, 1, 17);
    expect(s.getTile(1, 1)).toBe(17);
    s.setTile(9, 9, 5); // 境界外: 無視
    expect(s.getTile(9, 9)).toBe(0);
  });

  it('toggleEntity は同座標同種でトグル(追加→削除)', () => {
    const s = EditorState.empty(3, 2);
    s.toggleEntity('ENEMY', 2, 1);
    expect(s.entitiesAt(2, 1)).toEqual([{ type: 'ENEMY', tileX: 2, tileY: 1 }]);
    s.toggleEntity('ENEMY', 2, 1); // 同種再クリックで削除
    expect(s.entitiesAt(2, 1)).toEqual([]);
  });

  it('コンストラクタは chips/entities を保持する', () => {
    const s = new EditorState(2, 1, [[1, 2]], [{ type: 'SPRING', tileX: 0, tileY: 0 }]);
    expect(s.getTile(1, 0)).toBe(2);
    expect(s.entities.length).toBe(1);
  });
});
