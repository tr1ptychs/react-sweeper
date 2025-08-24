import { useEffect, useState, useMemo, useCallback } from "react";

type Location = {
  row: number;
  col: number;
};

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
};

type Board = Cell[][];

const PRESETS = {
  Beginner: { rows: 9, cols: 9, mines: 10 },
  Intermediate: { rows: 16, cols: 16, mines: 40 },
  Expert: { rows: 16, cols: 30, mines: 99 },
};

type PresetKey = keyof typeof PRESETS;

function makeBoard(rows: number, cols: number) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    })),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function neighbors(board: Board, row: number, col: number): Set<Location> {
  const rows = board.length;
  const cols = board[0].length;
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

function addMines(board: Board, mines: number, row: number, col: number) {
  const rows = board.length;
  const cols = board[0].length;
  let mineCount = 0;

  const exclude = new Set<string>();
  neighbors(board, row, col).forEach(({ row: nr, col: nc }) => {
    exclude.add(`${nr},${nc}`);
  });

  while (mineCount < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (
      !(r === row && c === col) &&
      !exclude.has(`${r},${c}`) &&
      !board[r][c].mine
    ) {
      mineCount++;
      board[r][c].mine = true;
      neighbors(board, r, c).forEach(({ row: nr, col: nc }) => {
        board[nr][nc].adjacentMines++;
      });
    }
  }
}

function Cell({
  cell,
  onHover,
  onReveal,
  onFlag,
}: {
  cell: Cell;
  onHover: () => void;
  onReveal: () => void;
  onFlag: () => void;
}) {
  const baseClassName =
    "w-10 h-10 flex items-center justify-center border border-slate-950 select-none text-xl font-bold";
  const adjColors = [
    "",
    "text-blue-700",
    "text-green-700",
    "text-red-700",
    "text-purple-700",
    "text-yellow-700",
    "text-cyan-700",
    "text-gray-700",
    "text-black",
  ];
  return (
    <div
      key={"id"}
      className={`${baseClassName} ${cell.revealed ? "bg-gray-100 " + adjColors[cell.adjacentMines] : "bg-gray-400 hover:bg-gray-500"}`}
      onPointerEnter={onHover}
      onClick={onReveal}
      onContextMenu={(e) => {
        e.preventDefault();
        onFlag();
      }}
    >
      {cell.revealed
        ? cell.mine
          ? "💣"
          : cell.adjacentMines > 0
            ? cell.adjacentMines
            : ""
        : cell.flagged
          ? "🚩"
          : ""}
    </div>
  );
}

function Board({
  board,
  onHover,
  onReveal,
  onFlag,
}: {
  board: Board;
  onHover: (loc: Location) => void;
  onReveal: (row: number, col: number) => void;
  onFlag: (location: Location) => void;
}) {
  const cols = board[0].length;
  return (
    <div
      className="inline-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }}
    >
      {board.map((row, r) =>
        row.map((cell, c) => (
          <Cell
            key={`${r}-${c}`}
            cell={cell}
            onHover={() => {
              onHover({ row: r, col: c });
            }}
            onReveal={() => onReveal(r, c)}
            onFlag={() => onFlag({ row: r, col: c })}
          />
        )),
      )}
    </div>
  );
}
function Face({
  status,
  onClick,
}: {
  status: "ready" | "dead" | "win" | "hmm";
  onClick: () => void;
}) {
  const map: Record<string, string> = {
    ready: "🙂",
    dead: "💀",
    win: "😎",
    hmm: "😬",
  };
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded border shadow active:translate-y-px"
    >
      <span className={"text-2xl"}>{map[status]}</span>
    </button>
  );
}

function Counter({ value }: { value: number }) {
  const v = clamp(value, -99, 999);
  return (
    <div className="font-mono text-xl bg-black text-red-500 rounded px-2 py-1 w-16 text-center select-none">
      {v.toString().padStart(3, "0")}
    </div>
  );
}

function reveal(board: Board, row: number, col: number): number {
  const stack: [number, number][] = [[row, col]];
  let revealed = 0;
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    revealed++;
    if (cell.adjacentMines === 0 && !cell.mine) {
      for (const { row: nr, col: nc } of neighbors(board, cr, cc)) {
        const ncell = board[nr][nc];
        if (!ncell.revealed && !ncell.flagged && !ncell.mine)
          stack.push([nr, nc]);
      }
    }
  }
  return revealed;
}

function useTimer(running: boolean, resetDep: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => setSecs(0), [resetDep]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => clamp(s + 1, 0, 999)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return secs;
}

export default function Minesweeper() {
  const [preset, setPreset] = useState<PresetKey>("Beginner");
  const [rows, setRows] = useState(PRESETS[preset].rows);
  const [cols, setCols] = useState(PRESETS[preset].cols);
  const [mines, setMines] = useState(PRESETS[preset].mines);

  const [hover, setHover] = useState<Location | null>(null);

  const [board, setBoard] = useState<Board>(() => makeBoard(rows, cols));
  const [firstClick, setFirstClick] = useState(true);
  const [alive, setAlive] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const totalSafe = rows * cols - mines;
  const won = alive && revealed === totalSafe && totalSafe > 0;

  const running = alive && !firstClick && !won;
  const secs = useTimer(running, firstClick);

  useEffect(() => {
    setBoard(makeBoard(rows, cols));
    setFirstClick(true);
    setAlive(true);
    setRevealed(0);
  }, [rows, cols, mines]);

  function resetToPreset(k: PresetKey) {
    setPreset(k);
    setRows(PRESETS[k].rows);
    setCols(PRESETS[k].cols);
    setMines(PRESETS[k].mines);
  }

  const chord = useCallback(
    (b: Board, row: number, col: number, cell: Cell) => {
      const neigh = neighbors(b, row, col);
      let adjacentFlags = 0;
      neigh.forEach(({ row: nr, col: nc }) => {
        if (b[nr][nc].flagged) adjacentFlags++;
      });
      if (adjacentFlags === cell.adjacentMines) {
        neigh.forEach(({ row: nr, col: nc }) => {
          const nCell = board[nr][nc];
          if (nCell.flagged) return;
          if (nCell.mine) {
            nCell.revealed = true;
            setAlive(false);
            setBoard(board);
          }
          if (!nCell.revealed) {
            const newlyRevealed = reveal(board, nr, nc);
            setRevealed((v) => v + newlyRevealed);
          }
        });
      }
    },
    [board],
  );

  const handleReveal = useCallback(
    (row: number, col: number) => {
      if (!alive) return;

      const prevBoard = board;
      const nextBoard = prevBoard.map((row) =>
        row.map((cell) => ({ ...cell })),
      );

      if (firstClick) {
        addMines(nextBoard, clamp(mines, 1, rows * cols - 1), row, col);
        setFirstClick(false);
      }

      const cell = nextBoard[row][col];
      if (cell.flagged) return;

      if (cell.revealed) {
        chord(nextBoard, row, col, cell);
        return;
      }

      if (cell.mine) {
        cell.revealed = true;
        setAlive(false);
        setBoard(nextBoard);
      } else {
        const newlyRevealed = reveal(nextBoard, row, col);
        setBoard(nextBoard);
        setRevealed((v) => v + newlyRevealed);
      }
    },
    [firstClick, mines, rows, cols, alive, board, chord],
  );

  const handleFlag = useCallback(
    (location: Location) => {
      if (!alive) return;
      const { row, col } = location;

      const prevBoard = board;
      const nextBoard = prevBoard.map((row) =>
        row.map((cell) => ({ ...cell })),
      );
      const cell = nextBoard[row][col];
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      setBoard(nextBoard);
    },
    [alive, board],
  );

  function reset() {
    setBoard(makeBoard(rows, cols));
    setFirstClick(true);
    setAlive(true);
    setRevealed(0);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (!alive || !hover) return;
      if (e.key === "q") {
        e.preventDefault();
        handleReveal(hover.row, hover.col);
      }
      if (e.key === "w") {
        e.preventDefault();
        handleFlag(hover);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alive, hover, handleReveal, handleFlag]);

  const flagsUsed = useMemo(
    () => board.flat().filter((c) => c.flagged).length,
    [board],
  );
  const status: "ready" | "dead" | "win" | "hmm" = !alive
    ? "dead"
    : won
      ? "win"
      : firstClick
        ? "ready"
        : "hmm";
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="bg-neutral-800 border border-stone-700 rounded-2xl shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Counter value={mines - flagsUsed} />
          <Face status={status} onClick={reset} />
          <Counter value={secs} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(PRESETS).map((k) => (
            <button
              key={k}
              onClick={() => resetToPreset(k as PresetKey)}
              className={`px-3 py-1 rounded border text-sm ${preset === k ? "bg-black text-white" : "bg-white"}`}
            >
              {k}
            </button>
          ))}
          <div className="flex items-center gap-2 text-sm">
            <label>
              Rows{" "}
              <input
                className="border px-1 w-14"
                type="number"
                value={rows}
                min={5}
                max={99}
                onChange={(e) =>
                  setRows(clamp(parseInt(e.target.value || "0"), 5, 99))
                }
              />
            </label>
            <label>
              Cols{" "}
              <input
                className="border px-1 w-14"
                type="number"
                value={cols}
                min={5}
                max={99}
                onChange={(e) =>
                  setCols(clamp(parseInt(e.target.value || "0"), 5, 99))
                }
              />
            </label>
            <label>
              Mines{" "}
              <input
                className="border px-1 w-16"
                type="number"
                value={mines}
                min={1}
                max={rows * cols - 1}
                onChange={(e) =>
                  setMines(
                    clamp(parseInt(e.target.value || "0"), 1, rows * cols - 1),
                  )
                }
              />
            </label>
          </div>
        </div>

        <Board
          board={board}
          onReveal={handleReveal}
          onFlag={handleFlag}
          onHover={setHover}
        />
      </div>
    </div>
  );
}
