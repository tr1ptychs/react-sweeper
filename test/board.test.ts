import { describe, it, expect } from "vitest";
import type { Board, Location } from "../src/game/board";
import {
  random,
  clamp,
  makeBoard,
  neighbors,
  addMines,
  reveal,
} from "../src/game/board";

describe("clamp", () => {
  it("clamps values to the range [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("makeBoard", () => {
  it("makes a board with specified dimensions", () => {
    const boardFiveFive = makeBoard(5, 5);
    expect(boardFiveFive).toHaveLength(5);
    expect(boardFiveFive[0]).toHaveLength(5);

    const boardTenFive = makeBoard(10, 5);
    expect(boardTenFive).toHaveLength(10);
    expect(boardTenFive[0]).toHaveLength(5);

    const boardFiveTen = makeBoard(5, 10);
    expect(boardFiveTen).toHaveLength(5);
    expect(boardFiveTen[0]).toHaveLength(10);
  });

  it("board with invalid dimensions (r || c < 5) returns a 5x5 board", () => {
    const invalidRowCol = makeBoard(3, 4);
    expect(invalidRowCol).toHaveLength(5);
    expect(invalidRowCol[0]).toHaveLength(5);

    const invalidRow = makeBoard(3, 5);
    expect(invalidRow).toHaveLength(5);
    expect(invalidRow[0]).toHaveLength(5);

    const invalidCol = makeBoard(5, -5);
    expect(invalidCol).toHaveLength(5);
    expect(invalidCol[0]).toHaveLength(5);
  });
});

describe("neighbors", () => {
  const board = makeBoard(5, 5);
  it("gives 8 locations in the middle, fewer on edges", () => {
    expect(neighbors(board, { row: 1, col: 1 }).size).toBe(8);
    expect(neighbors(board, { row: 0, col: 0 }).size).toBe(3);
    expect(neighbors(board, { row: 0, col: 1 }).size).toBe(5);
    expect(neighbors(board, { row: 4, col: 4 }).size).toBe(3);
    expect(neighbors(board, { row: 3, col: 4 }).size).toBe(5);
  });

  it("invalid locations return empty set", () => {
    expect(neighbors(board, { row: -1, col: 0 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 0, col: -1 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 5, col: 0 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 0, col: 5 })).toEqual(new Set<Location>());
  });

  it("neighbors of corners", () => {
    expect(neighbors(board, { row: 0, col: 0 })).toEqual(
      new Set<Location>([
        { row: 1, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ]),
    );
    expect(neighbors(board, { row: 0, col: 4 })).toEqual(
      new Set<Location>([
        { row: 1, col: 4 },
        { row: 0, col: 3 },
        { row: 1, col: 3 },
      ]),
    );
    expect(neighbors(board, { row: 4, col: 0 })).toEqual(
      new Set<Location>([
        { row: 3, col: 0 },
        { row: 4, col: 1 },
        { row: 3, col: 1 },
      ]),
    );
    expect(neighbors(board, { row: 4, col: 4 })).toEqual(
      new Set<Location>([
        { row: 3, col: 4 },
        { row: 4, col: 3 },
        { row: 3, col: 3 },
      ]),
    );
  });

  it("neighbors of center", () => {
    expect(neighbors(board, { row: 2, col: 2 })).toEqual(
      new Set<Location>([
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 1, col: 3 },
        { row: 2, col: 1 },
        { row: 2, col: 3 },
        { row: 3, col: 1 },
        { row: 3, col: 2 },
        { row: 3, col: 3 },
      ]),
    );
  });
});

const countMines = (b: Board) =>
  b.flat().reduce((n, c) => n + (c.mine ? 1 : 0), 0);
export function blockedSet(b: Board, safe: Location) {
  const s = new Set<string>([`${safe.row},${safe.col}`]);
  neighbors(b, safe).forEach((l) => s.add(`${l.row},${l.col}`));
  return s;
}

describe("addMines", () => {
  it("places exactly M mines and keeps the 3x3 safe area clean, seed = 1, 5x5 board, 5 mines", () => {
    const b = makeBoard(5, 5);
    const safe = { row: 2, col: 2 };
    addMines(b, 5, safe, random(1));
    expect(countMines(b)).toBe(5);

    neighbors(b, safe).forEach(({ row: nr, col: nc }) => {
      expect(b[nr][nc].mine).toBe(false);
    });
  });

  it("places M mines, 3x4 safe area clean, seed = 1, 5x5 board, maximum mines (16 = 25-9)", () => {
    const b = makeBoard(5, 5);
    const safe = { row: 2, col: 2 };
    addMines(b, 25 - 9, safe, random(1));
    expect(countMines(b)).toBe(25 - 9);

    neighbors(b, safe).forEach(({ row: nr, col: nc }) => {
      expect(b[nr][nc].mine).toBe(false);
    });
  });

  describe("seed sweep invariants", () => {
    const rows = 16,
      cols = 30,
      safe = { row: 8, col: 15 };
    for (let seed = 0; seed < 200; seed++) {
      it(`seed=${seed} respects invariants`, () => {
        const b = makeBoard(rows, cols);
        addMines(b, 99, safe, random(seed));

        const blocked = blockedSet(b, safe);
        for (const key of blocked) {
          const [r, c] = key.split(",").map(Number);
          expect(b[r][c].mine).toBe(false);
        }

        expect(countMines(b)).toBe(99);

        // adjacency consistent
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            if (b[r][c].mine) continue;
            let m = 0;
            neighbors(b, { row: r, col: c }).forEach((l) => {
              if (b[l.row][l.col].mine) m++;
            });
            expect(b[r][c].adjacentMines).toBe(m);
          }
      });
    }
  });
});

describe("reveal", () => {
  it("Reveals everything but [0][0] when only mine is [0][0]", () => {
    const b: Board = makeBoard(5, 5);
    b[0][0].mine = true;
    b[1][1].adjacentMines = 1;
    b[0][1].adjacentMines = 1;
    b[1][0].adjacentMines = 1;

    const count = reveal(b, { row: 4, col: 4 });
    expect(count).toBe(24);
    b.forEach((row) => {
      row.forEach((cell) => {
        if (cell.mine) {
          expect(cell.revealed).toBe(false);
        } else {
          expect(cell.revealed).toBe(true);
        }
      });
    });
  });

  it("does not count already revealed cells again", () => {
    // no mines
    const b = makeBoard(5, 5);
    const c1 = reveal(b, { row: 0, col: 0 });
    const c2 = reveal(b, { row: 1, col: 1 });
    expect(c1).toBe(25);
    expect(c2).toBe(0);
  });
});
