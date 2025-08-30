import { vi, describe, it, expect, afterEach } from "vitest";
import type { Board, Location } from "../../src/game/board";
import {
  dailySeedKey,
  dailySeed,
  seedFromString,
  random,
  clamp,
  makeBoard,
  neighbors,
  addMines,
  reveal,
  chord,
  showMines,
} from "../../src/game/board";

afterEach(() => vi.restoreAllMocks());

describe("dailySeedKey", () => {
  it("Formats seed key correctly", () => {
    const key1 = dailySeedKey(9, 9, 10);
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    expect(key1).toBe(`${y}-${m}-${d}|${9}x${9}|${10}`);
  });
});

describe("seedFromString", () => {
  it("Generates seed correctly", () => {
    const seed = seedFromString("2023-04-01|30x20|130");
    const seed2 = seedFromString("2025-04-01|30x20|130");
    expect(seed).toBe(3846270382);
    expect(seed2).toBe(2565496996);
  });
});

describe("dailySeed", () => {
  it("The same day, same board produces the same seed", () => {
    const seed1 = dailySeed(9, 9, 10);
    const seed2 = dailySeed(9, 9, 10);
    expect(seed1).toBe(seed2);
  });

  it("different day produces different seed to a reasonable extent", () => {
    const now = new Date();
    const seeds = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      const newSeed = seedFromString(`${y}-${m}-${d}|30x20|130`);
      expect(seeds).not.include(newSeed);
      now.setDate(now.getDate() + 1);
    }
  });

  it("Produces correct daily seed", () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const seed = seedFromString(`${y}-${m}-${d}|30x20|130`);
    const daily = dailySeed(30, 20, 130);
    expect(daily).toBe(seed);
  });
});

describe("random", () => {
  it("same seed produces same sequence", () => {
    const r1 = random(12345);
    const r2 = random(12345);

    for (let i = 0; i < 100; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("different seeds produce different sequences", () => {
    const r1 = random(1);
    const r2 = random(2);

    const vals1 = Array.from({ length: 10 }, () => r1());
    const vals2 = Array.from({ length: 10 }, () => r2());

    expect(vals1).not.toEqual(vals2);
  });

  it("outputs are in [0,1)", () => {
    const r = random(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("sequence matches reference", () => {
    const r = random(42);
    const expected = [
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
      0.6697340414393693, 0.17481389874592423,
    ];
    expect(expected.map(() => r())).toEqual(expected);
  });

  it("auto-seeding calls Math.random once and never during generation", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const rng = random(); // should call Math.random here
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    for (let i = 0; i < 10; i++) rng();
    expect(spy).not.toHaveBeenCalled();
  });

  it("auto-seed sequence equals explicit-seed sequence", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.3141592653);

    const implicit = random();
    const seed = (0.3141592653 * 2 ** 32) >>> 0;
    const explicit = random(seed);

    const a = Array.from({ length: 8 }, () => implicit());
    const b = Array.from({ length: 8 }, () => explicit());

    expect(a).toEqual(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("different auto-seeds lead to different sequences", () => {
    const spy = vi.spyOn(Math, "random");
    spy.mockReturnValueOnce(0.1);
    const r1 = random();
    spy.mockReturnValueOnce(0.9);
    const r2 = random();

    const s1 = Array.from({ length: 6 }, () => r1());
    const s2 = Array.from({ length: 6 }, () => r2());
    expect(s1).not.toEqual(s2);
  });

  it("auto-seed clamps to uint32 space", () => {
    vi.spyOn(Math, "random").mockReturnValue(1 - Number.EPSILON);
    const implicit = random();

    const seed = ((1 - Number.EPSILON) * 2 ** 32) >>> 0;
    const explicit = random(seed);

    const a = Array.from({ length: 5 }, () => implicit());
    const b = Array.from({ length: 5 }, () => explicit());
    expect(a).toEqual(b);
  });

  it("seeded generators are deterministic and independent of Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.42);
    const seeded = random(123456789);
    spy.mockClear();

    const out = Array.from({ length: 5 }, () => seeded());
    expect(spy).not.toHaveBeenCalled();

    const seededAgain = random(123456789);
    const again = Array.from({ length: 5 }, () => seededAgain());
    expect(out).toEqual(again);
  });
});

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

  describe("board with invalid dimensions (r || c < 5)", () => {
    it("returns a 5x5 board", () => {
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

    it("returns a board full of default cells", () => {
      const board = makeBoard(3, 3);
      board.forEach((row) => {
        row.forEach((cell) => {
          expect(cell).toEqual({
            mine: false,
            revealed: false,
            flagged: false,
            adjacentMines: 0,
          });
        });
      });
    });
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

  it("invalid location", () => {
    expect(neighbors(board, { row: -1, col: 0 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 0, col: -1 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 5, col: 0 })).toEqual(new Set<Location>());
    expect(neighbors(board, { row: 0, col: 5 })).toEqual(new Set<Location>());
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

  it("places M mines, 3x3 safe area clean, seed = 1, 5x5 board, maximum mines (16 = 25-9)", () => {
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
    for (let seed = 0; seed < 50; seed++) {
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

function countRevealed(board: Board): number {
  let count = 0;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c].revealed) count++;
    }
  }
  return count;
}

describe("reveal", () => {
  it("Reveals everything but [0][0] when only mine is [0][0]", () => {
    const b: Board = makeBoard(5, 5);
    b[0][0].mine = true;
    b[1][1].adjacentMines = 1;
    b[0][1].adjacentMines = 1;
    b[1][0].adjacentMines = 1;

    const count = reveal(b, { row: 4, col: 4 });
    expect(count).toBe(24);
    expect(count).toBe(countRevealed(b));
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

  it("Does not count already revealed cells again", () => {
    // no mines
    const b = makeBoard(5, 5);
    const c1 = reveal(b, { row: 0, col: 0 });
    const c2 = reveal(b, { row: 1, col: 1 });
    expect(c1).toBe(25);
    expect(c1).toBe(countRevealed(b));
    expect(c2).toBe(0);
  });

  it("ends if mine is revealed and returns -1", () => {
    const b = makeBoard(5, 5);
    b[0][0].mine = true;
    const count = reveal(b, { row: 0, col: 0 });
    expect(count).toBe(-1);
    expect(b[0][0].revealed).toBe(true);
    expect(countRevealed(b)).toBe(1);
  });

  it("ends if square with adjacent mine is revealed", () => {
    const b = makeBoard(5, 5);
    b[0][0].adjacentMines = 1;
    const count = reveal(b, { row: 0, col: 0 });
    expect(count).toBe(1);
    expect(b[0][0].revealed).toBe(true);
  });

  it("does not count already revealed cells", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    const count = reveal(b, { row: 1, col: 1 });
    expect(count).toBe(0);
    expect(b[1][1].revealed).toBe(true);

    const count2 = reveal(b, { row: 2, col: 2 });
    expect(count2).toBe(24);
    expect(b[2][2].revealed).toBe(true);
    expect(countRevealed(b)).toBe(25);
  });

  it("does not count nor reveal flagged cells", () => {
    const b = makeBoard(5, 5);
    b[1][1].flagged = true;
    const count = reveal(b, { row: 1, col: 1 });
    expect(count).toBe(0);
    expect(b[1][1].revealed).toBe(false);

    const count2 = reveal(b, { row: 2, col: 2 });
    expect(count2).toBe(24);
    expect(b[2][2].revealed).toBe(true);
    expect(b[1][1].revealed).toBe(false);
    expect(countRevealed(b)).toBe(24);
  });
});

describe("showMines", () => {
  it("shows all mines", () => {
    const b = makeBoard(5, 5);
    b[0][0].mine = true;
    b[0][1].mine = true;
    b[0][2].mine = true;
    b[1][0].mine = true;
    b[1][1].mine = true;
    b[1][2].mine = true;
    b[2][0].mine = true;
    b[2][1].mine = true;
    b[2][2].mine = true;
    showMines(b);
    expect(b[0][0].revealed).toBe(true);
    expect(b[0][1].revealed).toBe(true);
    expect(b[0][2].revealed).toBe(true);
    expect(b[1][0].revealed).toBe(true);
    expect(b[1][1].revealed).toBe(true);
    expect(b[1][2].revealed).toBe(true);
    expect(b[2][0].revealed).toBe(true);
    expect(b[2][1].revealed).toBe(true);
    expect(b[2][2].revealed).toBe(true);
  });

  it("doesn't reveal extra squares", () => {
    const b = makeBoard(5, 5);
    showMines(b);
    expect(countRevealed(b)).toBe(0);
    addMines(b, 8, { row: 0, col: 0 });
    showMines(b);
    expect(countRevealed(b)).toBe(8);
  });
});

describe("chord", () => {
  it("does not reveal on no adjacent flags", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 1;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(countRevealed(b)).toBe(1);
    expect(revealed).toBe(0);
  });

  it("does not reveal on (adjacent flags < adjacentMines)", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 2;
    b[1][2].flagged = true;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(countRevealed(b)).toBe(1);
    expect(revealed).toBe(0);
  });

  it("does not reveal on (adjacent flags > adjacentMines)", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 1;
    b[1][2].flagged = true;
    b[2][2].flagged = true;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(countRevealed(b)).toBe(1);
    expect(revealed).toBe(0);
  });

  it("does not reveal flagged squares", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 1;
    b[1][2].flagged = true;
    b[4][4].flagged = true;
    b[3][3].flagged = true;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(countRevealed(b)).toBe(22);
    expect(revealed).toBe(21);
    expect(b[1][2].revealed).toBe(false);
  });

  it("returns -1 on revealing mine", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 1;
    b[1][2].flagged = true;
    b[2][2].mine = true;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(revealed).toBe(-1);
    expect(b[1][2].revealed).toBe(false);
  });

  it("reveals correct squares", () => {
    const b = makeBoard(5, 5);
    b[1][1].revealed = true;
    b[1][1].adjacentMines = 1;
    neighbors(b, { row: 1, col: 1 }).forEach((n) => {
      b[n.row][n.col].adjacentMines = 1;
    });
    b[2][2].adjacentMines = 0;
    b[0][0].adjacentMines = 0;
    b[2][2].mine = true;
    b[2][2].flagged = true;
    const revealed = chord(b, { row: 1, col: 1 });
    expect(countRevealed(b)).toBe(8);
    expect(revealed).toBe(7);
    neighbors(b, { row: 1, col: 1 }).forEach((n) => {
      if (n.row === 2 && n.col === 2) return;
      expect(b[n.row][n.col].revealed).toBe(true);
    });
    expect(b[1][1].revealed).toBe(true);
    expect(b[2][2].revealed).toBe(false);
  });
});
