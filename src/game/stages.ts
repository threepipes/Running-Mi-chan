export interface StageDef {
  index: number;
  name: string;
  mapKey: string; // BootScene の binary キー
  eventKey: string; // BootScene の text キー
  mapFile: string; // public/ 配下のパス
  eventFile: string;
}

export const STAGES: StageDef[] = [
  {
    index: 0,
    name: 'ステージ1 (Easy)',
    mapKey: 'map_0',
    eventKey: 'evt_0',
    mapFile: 'levels/map_easy01.map',
    eventFile: 'levels/event_easy01.evt',
  },
  {
    index: 1,
    name: 'ステージ2 (Medium)',
    mapKey: 'map_1',
    eventKey: 'evt_1',
    mapFile: 'levels/map_medium01.map',
    eventFile: 'levels/event_medium01.evt',
  },
  {
    index: 2,
    name: 'ステージ3 (Hard)',
    mapKey: 'map_2',
    eventKey: 'evt_2',
    mapFile: 'levels/map.map',
    eventFile: 'levels/event.evt',
  },
];
