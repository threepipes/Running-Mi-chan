export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const TILE_SIZE = 32;

// 元 map.png は物理5列だが chip id は16列前提で addressing されている
export const SHEET_COLS = 5;
export const CHIP_COLS = 16;

// 物理値(px/秒・px/秒^2)。体感で調整可
export const RUN_SPEED = 260;
export const JUMP_VELOCITY = 620;
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
