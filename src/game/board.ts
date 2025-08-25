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

export function random(a: number = (Math.random() * 2 ** 32) >>> 0): RNG {
  a = a >>> 0;
  // mulberry32
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function makeBoard(rows: number, cols: number): Board {
  if (rows < 5 || cols < 5) {
    return Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
      })),
    );
  }
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    })),
  );
}

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

export function reveal(board: Board, loc: Location): number {
  const firstCell = board[loc.row][loc.col];
  if (firstCell.mine) {
    firstCell.revealed = true;
    return -1;
  }

  const stack: Location[] = [loc];
  let revealed = 0;
  while (stack.length > 0) {
    const { row: cr, col: cc } = stack.pop()!;
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;

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

export function showMines(board: Board): void {
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) {
        cell.revealed = true;
      }
    });
  });
}
