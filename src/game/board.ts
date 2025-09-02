export type Location = {
  row: number;
  col: number;
};

export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
};

export type Board = Cell[][];

export type RNG = () => number;

/**
 * Generates a string based on the date, dimensions, and number of mines.
 * @param {number} rows The number of rows in the board.
 * @param {number} cols The number of columns in the board.
 * @param {number} mines The number of mines in the board.
 * @returns {string} The seed string.
 */
export function dailySeedKey(
  rows: number,
  cols: number,
  mines: number,
): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}|${rows}x${cols}|${mines}`;
}

/**
 * Converts a string to a value that can be used as a seed.
 * @param {string} str The string to convert.
 * @returns {number} The seed value.
 */
export function seedFromString(str: string): number {
  // FNV-1a 32-bit
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Creates a seed for a game board based on the date, dimensions, and number of mines..
 * @param {number} rows The number of rows in the board.
 * @param {number} cols The number of columns in the board.
 * @param {number} mines The number of mines in the board.
 * @returns {number} The seed value.
 */
export function dailySeed(rows: number, cols: number, mines: number): number {
  return seedFromString(dailySeedKey(rows, cols, mines));
}

/**
 * Creates a new random number generator.
 * @remarks Uses mulberry32. Not cryptographically secure, but fast and suitable for games.
 * @param {number} [seed=(Math.random() * 2 ** 32 >>> 0)] The seed value.
 * @returns {RNG} A function that generates a random number between 0 and 1.
 */
export function random(seed: number = (Math.random() * 2 ** 32) >>> 0): RNG {
  let a = seed >>> 0;
  // mulberry32
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Clamps a value (Number) between a minimum and maximum value.
 * @param {number} value The value to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Initializes a new (empty) board of size rows x cols cells of type Cell.
 * Cells are initialized with the following properties:
 * - mine: false
 * - revealed: false
 * - flagged: false
 * - adjacentMines: 0
 * @param {number} rows Number of rows.
 * @param {number} cols Number of columns.
 * @returns {Board} The new board.
 */
export function makeBoard(rows: number, cols: number): Board {
  return Array.from({ length: Math.max(5, rows) }, () =>
    Array.from(
      { length: Math.max(5, cols) },
      () =>
        ({
          mine: false,
          revealed: false,
          flagged: false,
          adjacentMines: 0,
        }) as Cell,
    ),
  );
}

/**
 * Returns the neighbors of a location in a board.
 * @param {Board} board The board.
 * @param {Location} loc The location.
 * @returns {Set<Location>} The neighbors.
 */
export function neighbors(board: Board, loc: Location): Set<Location> {
  const rows = board.length;
  const cols = board[0].length;
  const { row, col } = loc;
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return new Set<Location>();
  }
  const result = new Set<Location>();
  for (let i = Math.max(0, row - 1); i <= Math.min(rows - 1, row + 1); i++) {
    for (let j = Math.max(0, col - 1); j <= Math.min(cols - 1, col + 1); j++) {
      if (i !== row || j !== col) {
        result.add({ row: i, col: j });
      }
    }
  }
  return result;
}

/**
 * Adds mines to a board based on the first click location, so that the first click and its surrounding cells are not mines.
 * @param {Board} board The board.
 * @param {number} mines The number of mines to add.
 * @param {Location} click The location of the clicked cell.
 * @param {RNG} [rng=random()] (optional) The random number generator.
 * @remarks
 *  - Mutates `board` in place.
 *  - Initializes adjacent mine counts for each cell.
 */
export function addMines(
  board: Board,
  mines: number,
  click: Location,
  rng: RNG = random(),
): void {
  const { row, col } = click;
  const rows = board.length;
  const cols = board[0].length;
  let mineCount = 0;

  const exclude = new Set<string>();
  neighbors(board, click).forEach(({ row: nr, col: nc }) => {
    exclude.add(`${nr},${nc}`);
  });

  while (mineCount < mines) {
    const r = Math.floor(rng() * rows);
    const c = Math.floor(rng() * cols);
    if (
      !(r === row && c === col) &&
      !exclude.has(`${r},${c}`) &&
      !board[r][c].mine
    ) {
      mineCount++;
      board[r][c].mine = true;
      neighbors(board, { row: r, col: c }).forEach(({ row: nr, col: nc }) => {
        board[nr][nc].adjacentMines++;
      });
    }
  }
}

/**
 * Reveals a cell on the board, and adjacent cells if it has no adjacent mines.
 * @param {Board} board The game board.
 * @param {Location} loc The location of the cell to reveal.
 * @returns {number} The number of cells revealed, -1 if a mine is revealed.
 * @remarks
 *  - Mutates `board` in place.
 *  - Iterative (stack-based) to avoid recursion depth issues.
 *  - Only reveals mine if it is the initial location `loc`.
 */
export function reveal(board: Board, loc: Location): number {
  const stack: Location[] = [loc];
  let revealed = 0;
  while (stack.length > 0) {
    const { row: cr, col: cc } = stack.pop()!;
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;

    if (cell.mine) {
      return -1;
    }
    revealed++;
    if (cell.adjacentMines === 0) {
      for (const { row: nr, col: nc } of neighbors(board, {
        row: cr,
        col: cc,
      })) {
        stack.push({ row: nr, col: nc });
      }
    }
  }
  return revealed;
}

/**
 * Chords a cell on the board, revealing adjacent cells if the number of adjacent flags matches the number of adjacent mines.
 * @param {Board} b The game board.
 * @param {Location} loc The location of the cell to chord.
 * @returns {number} The number of cells revealed, -1 if a mine is revealed.
 * @remarks Mutates board in place.
 */
export function chord(b: Board, loc: Location): number {
  const cell = b[loc.row][loc.col];
  const neigh = neighbors(b, loc);
  let adjacentFlags = 0;
  neigh.forEach(({ row: nr, col: nc }) => {
    if (b[nr][nc].flagged) adjacentFlags++;
  });

  let revealed = 0;
  if (adjacentFlags === cell.adjacentMines) {
    for (const { row: nr, col: nc } of neigh) {
      const newlyRevealed = reveal(b, { row: nr, col: nc });
      if (newlyRevealed === -1) {
        return -1;
      } else {
        revealed += newlyRevealed;
      }
    }
  }
  return revealed;
}

/**
 * Sets all mines on the board to revealed.
 * @param {Board} board The game board.
 * @remarks Mutates board in place.
 */
export function showMines(board: Board): void {
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) {
        cell.revealed = true;
      }
    });
  });
}
