import { TILE_SIZE, SHEET_COLS } from '../../config';
import { STAGES } from '../../game/stages';
import { EditorState } from '../EditorState';
import { EditorScene, ENTITY_STYLE } from '../EditorScene';
import type { EntityType } from '../../game/loaders/EventLoader';
import { parseEvents } from '../../game/loaders/EventLoader';
import { parseMapRaw, serializeMap, indexToChip } from '../../game/loaders/MapSerializer';
import { serializeEvents } from '../../game/loaders/EventSerializer';

const ENTITY_TYPES: EntityType[] = ['ENEMY', 'NEEDLE', 'SPRING', 'GATE', 'STAR'];
const ENTITY_LABEL: Record<EntityType, string> = {
  ENEMY: '敵', NEEDLE: '針', SPRING: 'バネ', GATE: 'ゲート', STAR: 'スター',
};

// number 色(0xRRGGBB)を CSS の #rrggbb へ
function cssColor(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** マップエディタの DOM ツールUI。EditorScene とはメソッド呼び出しで疎結合。 */
export class EditorUI {
  private scene: EditorScene;
  private palette!: HTMLElement;

  constructor(scene: EditorScene, toolbar: HTMLElement, palette: HTMLElement) {
    this.scene = scene;
    this.buildToolbar(toolbar);
    this.buildPalette(palette);
  }

  private buildToolbar(bar: HTMLElement): void {
    // 新規(幅・高さ入力)
    const wInput = this.numberInput(100);
    const hInput = this.numberInput(30);
    const newBtn = this.button('新規', () => {
      // 幅・高さは 1 以上にガード(0 や負値でマップが壊れないように)
      const w = Math.max(1, parseInt(wInput.value, 10) || 100);
      const h = Math.max(1, parseInt(hInput.value, 10) || 30);
      this.scene.loadState(EditorState.empty(w, h));
    });

    // 既存ステージ読込
    const stageSel = document.createElement('select');
    stageSel.appendChild(new Option('— 既存ステージ —', ''));
    STAGES.forEach((s, i) => stageSel.appendChild(new Option(s.name, String(i))));
    stageSel.addEventListener('change', () => {
      const i = parseInt(stageSel.value, 10);
      if (!Number.isNaN(i)) this.loadStage(STAGES[i].mapFile, STAGES[i].eventFile);
      stageSel.value = '';
    });

    // ファイル読込(.map / .evt)
    const mapFile = this.fileInput('.map');
    const evtFile = this.fileInput('.evt');
    const loadBtn = this.button('ファイル読込', () => this.loadFromFiles(mapFile, evtFile));

    // 保存
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = 'map';
    nameInput.size = 8;
    const saveBtn = this.button('保存', () => this.save(nameInput.value || 'map'));

    // ツールバーはファイル操作のみ。何を置くか(タイル/エンティティ)は左パレットで選ぶ。
    bar.append(
      newBtn, this.text('幅'), wInput, this.text('高'), hInput,
      stageSel, mapFile, evtFile, loadBtn, nameInput, saveBtn,
    );
  }

  // 左パレット: エンティティと(map.png由来の)タイルを同じ場所から選べるようにする
  private buildPalette(palette: HTMLElement): void {
    this.palette = palette;

    // エンティティ節
    palette.appendChild(this.sectionHeader('エンティティ'));
    for (const t of ENTITY_TYPES) {
      palette.appendChild(this.entitySwatch(t));
    }

    // タイル節
    palette.appendChild(this.sectionHeader('タイル'));
    palette.appendChild(this.eraseSwatch());

    const img = new Image();
    img.src = 'assets/map.png';
    img.onload = () => {
      const rows = Math.floor(img.naturalHeight / TILE_SIZE);
      const total = SHEET_COLS * rows;
      // index 1..total-1(index 0 は空きと衝突するため除外)
      for (let index = 1; index < total; index++) {
        const sw = this.tileSwatch(index, img.src);
        palette.appendChild(sw);
        if (index === 1) this.selectSwatch(sw); // 初期選択(Scene 既定の chip 1 タイルに合わせる)
      }
    };
    // 読込失敗時はパレット領域にエラーを表示(無反応にしない)
    img.onerror = () => {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#f88;padding:8px;font-size:12px;';
      msg.textContent = 'タイル画像(assets/map.png)の読込に失敗しました';
      palette.appendChild(msg);
    };
  }

  private sectionHeader(title: string): HTMLElement {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'width:100%;margin:6px 2px 2px;font-size:12px;color:#aaa;';
    return h;
  }

  // エンティティの選択 swatch(色は Scene の ENTITY_STYLE と共有)
  private entitySwatch(type: EntityType): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tile-swatch';
    el.textContent = ENTITY_LABEL[type];
    el.title = `${ENTITY_LABEL[type]}(同じ場所を再クリックで削除)`;
    el.style.cssText = `display:inline-flex;align-items:center;justify-content:center;` +
      `width:${TILE_SIZE}px;height:${TILE_SIZE}px;margin:2px;font-size:11px;cursor:pointer;` +
      `background:${cssColor(ENTITY_STYLE[type].color)};color:#fff;`;
    el.addEventListener('click', () => {
      this.selectSwatch(el);
      this.scene.setTool(type);
    });
    return el;
  }

  private tileSwatch(index: number, url: string): HTMLElement {
    const col = index % SHEET_COLS;
    const row = Math.floor(index / SHEET_COLS);
    const el = document.createElement('div');
    el.className = 'tile-swatch';
    el.style.cssText = `display:inline-block;width:${TILE_SIZE}px;height:${TILE_SIZE}px;margin:2px;` +
      `background-image:url(${url});background-position:-${col * TILE_SIZE}px -${row * TILE_SIZE}px;cursor:pointer;`;
    el.addEventListener('click', () => {
      this.selectSwatch(el);
      this.scene.setSelectedChip(indexToChip(index));
    });
    return el;
  }

  private eraseSwatch(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tile-swatch';
    el.textContent = '消';
    el.style.cssText = `display:inline-flex;align-items:center;justify-content:center;` +
      `width:${TILE_SIZE}px;height:${TILE_SIZE}px;margin:2px;background:#444;color:#fff;cursor:pointer;`;
    el.addEventListener('click', () => {
      this.selectSwatch(el);
      this.scene.setSelectedChip(0); // chip 0 = 空き(消しゴム)
    });
    return el;
  }

  // パレット全体で単一選択(タイル/エンティティ/消 を跨いで排他)
  private selectSwatch(el: HTMLElement): void {
    this.palette.querySelectorAll('.tile-swatch.active').forEach((s) => s.classList.remove('active'));
    el.classList.add('active');
  }

  // ---- 読込/保存 ----

  private async loadStage(mapPath: string, evtPath: string): Promise<void> {
    try {
      const [mapBuf, evtText] = await Promise.all([
        fetch(mapPath).then((r) => r.arrayBuffer()),
        fetch(evtPath).then((r) => r.text()),
      ]);
      this.applyLoaded(mapBuf, evtText);
    } catch (err) {
      alert('マップの読込に失敗しました: ' + err);
    }
  }

  private loadFromFiles(mapInput: HTMLInputElement, evtInput: HTMLInputElement): void {
    const mapF = mapInput.files?.[0];
    if (!mapF) return;
    const evtF = evtInput.files?.[0];
    const mapP = mapF.arrayBuffer();
    const evtP = evtF ? evtF.text() : Promise.resolve('');
    Promise.all([mapP, evtP])
      .then(([buf, txt]) => this.applyLoaded(buf, txt))
      .catch((err) => alert('マップの読込に失敗しました: ' + err));
  }

  private applyLoaded(mapBuf: ArrayBuffer, evtText: string): void {
    const raw = parseMapRaw(mapBuf);
    const entities = parseEvents(evtText);
    this.scene.loadState(new EditorState(raw.width, raw.height, raw.chips, entities));
  }

  private save(name: string): void {
    const mapBytes = serializeMap(this.scene.state.chips);
    // slice() で Uint8Array を複製し、BlobPart として受け付けられる型へ適合させる
    const mapBlob = new Blob([mapBytes.slice()], { type: 'application/octet-stream' });
    this.download(mapBlob, `${name}.map`);
    const evtBlob = new Blob([serializeEvents(this.scene.state.entities)], { type: 'text/plain' });
    this.download(evtBlob, `${name}.evt`);
  }

  private download(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- DOM ヘルパ ----
  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  private numberInput(value: number): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'number';
    i.min = '1';
    i.value = String(value);
    i.size = 4;
    i.style.width = '52px';
    return i;
  }
  private fileInput(accept: string): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.style.width = '150px';
    return i;
  }
  private text(t: string): HTMLSpanElement {
    const s = document.createElement('span');
    s.textContent = t;
    return s;
  }
}
