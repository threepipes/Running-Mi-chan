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

  it('負の座標は境界外として無視/0 を返す', () => {
    const s = EditorState.empty(3, 2);
    expect(s.getTile(-1, 0)).toBe(0);
    s.setTile(-1, 0, 5); // 境界外: 無視
    expect(s.getTile(-1, 0)).toBe(0);
  });

  it('同一タイルに異なる type を配置でき entitiesAt が複数件返す', () => {
    const s = EditorState.empty(3, 2);
    s.toggleEntity('ENEMY', 1, 1);
    s.toggleEntity('SPRING', 1, 1);
    expect(s.entitiesAt(1, 1).length).toBe(2);
  });

  it('chips の次元が不整合でも落ちず境界外相当は 0 を返す', () => {
    const s = new EditorState(3, 2, [[1]]);
    expect(s.getTile(2, 1)).toBe(0);
  });

  it('addEntity は重複追加せず冪等(ドラッグ連続配置向け)', () => {
    const s = EditorState.empty(3, 2);
    s.addEntity('ENEMY', 1, 1);
    s.addEntity('ENEMY', 1, 1); // 同種同座標は無視
    expect(s.entitiesAt(1, 1).length).toBe(1);
    s.addEntity('SPRING', 1, 1); // 別種は追加される
    expect(s.entitiesAt(1, 1).length).toBe(2);
  });

  it('removeEntitiesAt は指定タイルのエンティティを種別問わず全削除する', () => {
    const s = EditorState.empty(3, 2);
    s.toggleEntity('ENEMY', 1, 1);
    s.toggleEntity('SPRING', 1, 1);
    s.toggleEntity('GATE', 2, 0); // 別タイルは残す
    s.removeEntitiesAt(1, 1);
    expect(s.entitiesAt(1, 1)).toEqual([]);
    expect(s.entitiesAt(2, 0).length).toBe(1);
  });
});
