import { useEffect, useState, useMemo, useCallback } from "react";
import type { Cell, Board, Location } from "./board.ts";
import {
  clamp,
  makeBoard,
  addMines,
  reveal,
  chord,
  showMines,
} from "./board.ts";

const PRESETS = {
  Beginner: { rows: 9, cols: 9, mines: 10 },
  Intermediate: { rows: 16, cols: 16, mines: 40 },
  Expert: { rows: 16, cols: 30, mines: 99 },
};

type PresetKey = keyof typeof PRESETS;

function Cell({
  cell,
  onHover,
  onReveal,
  onFlag,
  testid,
}: {
  cell: Cell;
  onHover: () => void;
  onReveal: () => void;
  onFlag: () => void;
  testid: string;
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
      data-testid={testid}
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
  onReveal: (loc: Location) => void;
  onFlag: (loc: Location) => void;
}) {
  const cols = board[0].length;
  return (
    <div
      className="inline-grid"
      data-testid="board"
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
            onReveal={() => onReveal({ row: r, col: c })}
            onFlag={() => onFlag({ row: r, col: c })}
            testid={`cell-${r}-${c}`}
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
      data-testid="face"
      className="px-3 py-1 rounded border shadow active:translate-y-px"
    >
      <span className={"text-2xl"}>{map[status]}</span>
    </button>
  );
}

function Counter({ value, testid }: { value: number; testid: string }) {
  const v = clamp(value, -99, 999);
  return (
    <div
      className="font-mono text-xl bg-black text-red-500 rounded px-2 py-1 w-16 text-center select-none"
      data-testid={testid}
    >
      {v.toString().padStart(3, "0")}
    </div>
  );
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

  const handleChord = useCallback((b: Board, loc: Location) => {
    const nextBoard = b.map((row) => row.map((cell) => ({ ...cell })));
    const newlyRevealed = chord(nextBoard, loc);

    // lose condition
    if (newlyRevealed === -1) {
      setAlive(false);
      showMines(nextBoard);
    } else {
      setRevealed((v) => v + newlyRevealed);
    }
    setBoard(nextBoard);
  }, []);

  const handleReveal = useCallback(
    (loc: Location) => {
      if (!alive || won || board[loc.row][loc.col].flagged) return;

      const prevBoard = board;
      const nextBoard = prevBoard.map((row) =>
        row.map((cell) => ({ ...cell })),
      );

      if (firstClick) {
        addMines(nextBoard, clamp(mines, 1, rows * cols - 9), loc);
        setFirstClick(false);
      }

      const { row, col } = loc;
      const cell = nextBoard[row][col];

      if (cell.revealed) {
        handleChord(nextBoard, loc);
        return;
      }

      const newlyRevealed = reveal(nextBoard, loc);

      // lose condition
      if (newlyRevealed === -1) {
        setAlive(false);
        showMines(nextBoard);
      } else {
        setRevealed((v) => v + newlyRevealed);
      }
      setBoard(nextBoard);
    },
    [firstClick, mines, rows, cols, alive, board, won, handleChord],
  );

  const handleFlag = useCallback(
    (loc: Location) => {
      const prevBoard = board;
      const nextBoard = prevBoard.map((row) =>
        row.map((cell) => ({ ...cell })),
      );
      const cell = nextBoard[loc.row][loc.col];

      if (!alive || won || cell.revealed) return;

      cell.flagged = !cell.flagged;
      setBoard(nextBoard);
    },
    [alive, board, won],
  );

  function reset() {
    setBoard(makeBoard(rows, cols));
    setFirstClick(true);
    setAlive(true);
    setRevealed(0);
  }

  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (!hover || !t) return;
      if (e.key === "q") {
        e.preventDefault();
        handleReveal(hover);
      }
    }
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [alive, hover, handleReveal, handleFlag]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (!hover || !t) return;

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
          <Counter value={mines - flagsUsed} testid="flags" />
          <Face status={status} onClick={reset} />
          <Counter value={secs} testid="timer" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(PRESETS).map((k) => (
            <button
              key={k}
              onClick={() => resetToPreset(k as PresetKey)}
              className={"px-3 py-1 rounded border text-sm bg-black text-white"}
            >
              {k}
            </button>
          ))}
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
