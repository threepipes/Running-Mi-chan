import type { EntitySpec } from './EventLoader';

/** エンティティ配列を .evt CSV(1行 TYPE,tileX,tileY)へ直列化する。parseEvents の逆。 */
export function serializeEvents(entities: readonly EntitySpec[]): string {
  return entities.map((e) => `${e.type},${e.tileX},${e.tileY}`).join('\n') + '\n';
}
