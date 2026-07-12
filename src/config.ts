export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 32;

// 元 map.png は物理5列だが chip id は16列前提で addressing されている
export const SHEET_COLS = 5;
export const CHIP_COLS = 16;

// 物理値(px/秒・px/秒^2)。体感で調整可
export const RUN_SPEED = 260;
export const JUMP_VELOCITY = 600;
export const GRAVITY_Y = 1800;
export const SPRING_VELOCITY = 980;
export const ENEMY_SPEED = 100;

// 落下の終端速度。1物理ステップ(1/60秒)の移動量がタイル厚(32px)を十分下回るよう
// 上限をかけ、高所落下時に地面をすり抜ける(トンネリング)のを防ぐ。1200/60=20px/step。
export const MAX_FALL_VELOCITY = 1200;

// 敵踏み/バネの跳ね上げ時、接触前後の短い猶予(ms)内にタップしていれば
// 跳躍速度に BOUNCE_BOOST を上乗せする(タイミングジャンプ)。空中の追加ジャンプは無し。
export const BOUNCE_BOOST = 200;
export const BOUNCE_BOOST_WINDOW_MS = 150;

// ジャンプ入力バッファ(ms)。着地する少し前に押したジャンプを覚えておき、
// この猶予内に接地したら発火する。着地直前の先行入力が捨てられるのを防ぐ。
export const JUMP_BUFFER_MS = 120;

// ゲームプレイ中の BGM 音量(0.0〜1.0)
export const BGM_VOLUME = 0.7;

// SE(効果音)のマスター音量。各SEの実効音量 = SE_MASTER_VOLUME * SE_xxx_VOLUME。
// 全SEを一括で下げたいときはこれを 1.0 未満にする。
export const SE_MASTER_VOLUME = 1.0;

// 各SEの相対音量(0.0〜1.0)。マスターを掛けた値が実際の再生音量になる。
export const SE_JUMP_VOLUME = 0.1; // ジャンプ(他より小さめ)
export const SE_SPRING_VOLUME = 1.0; // 大ジャンプ(バネ)。音源が小さいので大きめ
export const SE_DAMAGED_VOLUME = 0.5; // ダメージ
export const SE_CLEAR_VOLUME = 0.5; // クリア

/** SEの実効音量(マスター×相対)を返す。 */
export const seVolume = (relative: number): number => SE_MASTER_VOLUME * relative;

// アセット読み込み用のキー(ASCII)。
export const AUDIO_KEY = 'mi-chan-run-2026-audio-xor-key';
