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

export const LEVEL = 'easy01';
