import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { Cell, Board, Location } from "./board.ts";
import {
  dailySeed,
  random,
  clamp,
  makeBoard,
  addMines,
  reveal,
  chord,
  showMines,
  neighbors,
} from "./board.ts";

const PRESETS = {
  Beginner: { rows: 9, cols: 9, mines: 10 },
  Intermediate: { rows: 16, cols: 16, mines: 40 },
  Expert: { rows: 16, cols: 30, mines: 99 },
  Daily: { rows: 20, cols: 30, mines: 130 },
};

type PresetKey = keyof typeof PRESETS;

type Daily = {
  deaths: number;
  time: number;
  won: boolean;
  date: string;
};

function Cell({
  cell,
  onHover,
  onLeave,
  onReveal,
  onFlag,
  onPress,
  testid,
  lightened,
}: {
  cell: Cell;
  onHover: () => void;
  onLeave: () => void;
  onReveal: () => void;
  onFlag: () => void;
  onPress: () => void;
  testid: string;
  lightened: boolean;
}) {
  const baseClassName =
    "w-full h-full flex items-center justify-center select-none text-2xl font-bold";
  // Stryker disable next-line ArrayDeclaration
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
      id={testid}
      className={"w-9 h-9 border-1 border-gray-950"}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      onPointerUp={(e) => {
        if (e.button == 2) return;
        onReveal();
      }}
      onPointerDown={(e) => {
        if (e.button == 0) {
          onPress();
        } else if (e.button == 2) {
          onFlag();
        }
      }}
    >
      <div
        className={`${baseClassName} ${cell.revealed ? "bg-gray-200 " + adjColors[cell.adjacentMines] : lightened ? "bg-gray-200" : "bg-gray-400 border-3 b border-b-gray-700 border-r-gray-700 border-t-gray-300 border-l-gray-300"}`}
        data-testid={testid}
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
    </div>
  );
}

function Board({
  board,
  onHover,
  onLeave,
  onReveal,
  onFlag,
  setPressing,
  pressedSet,
}: {
  board: Board;
  onHover: (loc: Location) => void;
  onLeave: () => void;
  onReveal: (loc: Location) => void;
  onFlag: (loc: Location) => void;
  setPressing: () => void;
  pressedSet: Set<string>;
}) {
  const cols = board[0].length;
  return (
    <div
      className="inline-grid"
      data-testid="board"
      style={{ gridTemplateColumns: `repeat(${cols}, 2.25rem)` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {board.map((row, r) =>
        row.map((cell, c) => (
          <Cell
            key={`${r}-${c}`}
            cell={cell}
            onHover={() => {
              onHover({ row: r, col: c });
            }}
            onLeave={() => {
              onLeave();
            }}
            onReveal={() => onReveal({ row: r, col: c })}
            onFlag={() => onFlag({ row: r, col: c })}
            onPress={() => setPressing()}
            lightened={pressedSet.has(`${r}-${c}`)}
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

function Toast({ show, message }: { show: boolean; message: string }) {
  return (
    <div
      aria-live="polite"
      role="status"
      className={`fixed left-1/2 top-6 -translate-x-1/2 z-50
                  px-4 py-2 rounded-lg bg-black text-white text-sm shadow
                  transition-opacity duration-0 ${show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      {message}
    </div>
  );
}

export function FloatingFlag({
  flagMode,
  setFlagMode,
}: {
  flagMode: boolean;
  setFlagMode: (v: boolean) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const vv = window.visualViewport as VisualViewport;
    const el = ref.current as HTMLElement;
    if (!vv || !el) return;

    const MARGIN = 75; // css px from right/bottom inside visual viewport

    function layout() {
      // Where the bottom-right corner of the visual viewport currently is
      const x = vv.offsetLeft + vv.width - MARGIN;
      const y = vv.offsetTop + vv.height - MARGIN;

      // Place relative to (0,0) with a transform so we can compensate scale
      el.style.position = "fixed";
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.transformOrigin = "right bottom";

      // Inverse-scale so it doesn't grow/shrink with pinch zoom
      const s = vv.scale || 1;
      el.style.transform = `translate(${x}px, ${y}px) scale(${1 / s}) translateZ(0)`;
    }

    layout();
    vv.addEventListener("resize", layout);
    vv.addEventListener("scroll", layout);
    return () => {
      vv.removeEventListener("resize", layout);
      vv.removeEventListener("scroll", layout);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0">
      <button
        ref={ref}
        className={`pointer-events-auto md:hidden rounded-full px-4 py-3 shadow-lg font-semibold`}
        aria-pressed={flagMode}
        aria-label="Toggle flag mode"
        onClick={() => setFlagMode(!flagMode)}
      >
        {flagMode ? "🚩" : "🔎"}
      </button>
    </div>
  );
}

export default function Minesweeper() {
  const [preset, setPreset] = useState<PresetKey>("Beginner");
  const [rows, setRows] = useState(PRESETS[preset].rows);
  const [cols, setCols] = useState(PRESETS[preset].cols);
  const [mines, setMines] = useState(PRESETS[preset].mines);
  const [seed, setSeed] = useState<number | null>(null);

  const [hover, setHover] = useState<Location | null>(null);

  const [board, setBoard] = useState<Board>(() => makeBoard(rows, cols));
  const [firstClick, setFirstClick] = useState(true);
  const [alive, setAlive] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const totalSafe = rows * cols - mines;
  const won = alive && revealed === totalSafe;

  const running = alive && !firstClick && !won;
  const secs = useTimer(running, firstClick);

  const [pressing, setPressing] = useState(false);

  const [toast, setToast] = useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });
  const toastTimer = useRef<number | null>(null);

  function notify(msg: string, ms = 1800) {
    setToast({ show: true, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast({ show: false, msg: "" }),
      ms,
    );
  }

  const [flagMode, setFlagMode] = useState(false);

  const [dailyScores, setDailyScores] = useState<Daily[]>(() => {
    try {
      const saved = localStorage.getItem("dailyScores");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const hasTodayDaily = dailyScores.find(
    (score) => score.date === new Date().toISOString().slice(0, 10),
  );

  if (!hasTodayDaily) {
    const newDailyScores = [...dailyScores];
    newDailyScores.push({
      date: new Date().toISOString().slice(0, 10),
      won: false,
      time: 0,
      deaths: 0,
    });
    setDailyScores(newDailyScores);
  }

  useEffect(() => {
    const hasWonTodayDaily = dailyScores.find(
      (score) => score.date === new Date().toISOString().slice(0, 10),
    )?.won;

    const newDailyScores = [...dailyScores];
    if (!alive && preset === "Daily" && !hasWonTodayDaily) {
      const todayDaily = newDailyScores.find(
        (score) => score.date === new Date().toISOString().slice(0, 10),
      );
      if (todayDaily) {
        todayDaily.time += secs;
        todayDaily.deaths += 1;
      }
    } else if (alive && won && preset === "Daily" && !hasWonTodayDaily) {
      const todayDaily = newDailyScores.find(
        (score) => score.date === new Date().toISOString().slice(0, 10),
      );
      if (todayDaily) {
        todayDaily.won = true;
        todayDaily.time += secs;
      }
    }
    setDailyScores(newDailyScores);
  }, [alive, won]);

  useEffect(() => {
    localStorage.setItem("dailyScores", JSON.stringify(dailyScores));
  }, [dailyScores]);

  // clear press on mouse/touch release anywhere
  useEffect(() => {
    if (!pressing) return;
    const up = () => setPressing(false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [pressing]);

  const pressedSet = useMemo(() => {
    const set = new Set<string>();
    if (!pressing || !hover || !alive || won || flagMode) return set;

    const { row, col } = hover;
    const base = board[row][col];

    const key = (r: number, c: number) => `${r}-${c}`;
    if (base.flagged) return set;
    if (!base.revealed) {
      set.add(key(row, col));
      return set;
    }
    if (base.adjacentMines > 0) {
      for (const { row: nr, col: nc } of neighbors(board, {
        row: row,
        col: col,
      })) {
        const n = board[nr][nc];
        if (!n.revealed && !n.flagged) set.add(key(nr, nc));
      }
    }
    return set;
  }, [pressing, hover, board, alive, won, flagMode]);

  useEffect(() => {
    if (location.pathname.endsWith("/daily")) {
      setPreset("Daily");
      const r = PRESETS["Daily"].rows;
      const c = PRESETS["Daily"].cols;
      const m = PRESETS["Daily"].mines;
      setRows(r);
      setCols(c);
      setMines(m);
      setSeed(dailySeed(r, c, m));
    }
  }, []);

  useEffect(() => {
    setBoard(makeBoard(rows, cols));
    setFirstClick(true);
    setAlive(true);
    setRevealed(0);
    setFlagMode(false);
  }, [rows, cols, mines]);

  function resetToPreset(k: PresetKey) {
    setPreset(k);
    setRows(PRESETS[k].rows);
    setCols(PRESETS[k].cols);
    setMines(PRESETS[k].mines);
    setFlagMode(false);
    if (k === "Daily") {
      const r = PRESETS[k].rows,
        c = PRESETS[k].cols,
        m = PRESETS[k].mines;
      setSeed(dailySeed(r, c, m));
      history.replaceState(null, "", `/daily`);
    } else {
      setSeed(null);
      history.replaceState(null, "", "/");
    }
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

  const handleReveal = useCallback(
    (loc: Location) => {
      if (flagMode && !board[loc.row][loc.col].revealed) {
        handleFlag(loc);
        return;
      }

      if (!alive || won || board[loc.row][loc.col].flagged) return;

      const prevBoard = board;
      const nextBoard = prevBoard.map((row) =>
        row.map((cell) => ({ ...cell })),
      );

      if (firstClick) {
        addMines(
          nextBoard,
          clamp(mines, 1, rows * cols - 9),
          loc,
          seed ? random(seed) : undefined,
        );
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
    [
      firstClick,
      mines,
      rows,
      cols,
      alive,
      board,
      won,
      handleChord,
      seed,
      handleFlag,
      flagMode,
    ],
  );

  function reset() {
    setBoard(makeBoard(rows, cols));
    setFirstClick(true);
    setAlive(true);
    setRevealed(0);
    setFlagMode(false);
  }

  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.key === "q") {
        setPressing(false);
        if (!hover || !t || !alive) return;
        e.preventDefault();
        handleReveal(hover);
      }
    }
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [alive, hover, handleReveal, handleFlag]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (!hover || !alive) return;

      if (e.key === "w") {
        e.preventDefault();
        handleFlag(hover);
      } else if (e.key === "q") {
        e.preventDefault();
        setPressing(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alive, hover, handleFlag]);

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

  const todayStats = dailyScores.find(
    (score) => score.date === new Date().toISOString().slice(0, 10),
  ) as Daily;

  const handleShareDailyWin = async () => {
    const text = `⏰: ${todayStats.time}\n💀: ${todayStats.deaths}`;
    const date = new Date().toLocaleDateString();

    try {
      await navigator.clipboard.writeText(
        `Daily Minesweeper Challenge: ${date}\n${"https://react-sweeper-snowy.vercel.app/daily"}\n${text}`,
      );
      notify("Results copied to clipboard");
    } catch {
      notify("Failed to write to clipboard");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="bg-neutral-800 border border-stone-700 rounded-2xl shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Counter value={mines - flagsUsed} testid="flags" />
          <Face status={status} onClick={reset} />
          <Counter value={secs} testid="timer" />
        </div>

        <Toast show={toast.show} message={toast.msg} />
        <FloatingFlag flagMode={flagMode} setFlagMode={setFlagMode} />

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(PRESETS).map(
              (k) =>
                k !== "Daily" && (
                  <button
                    key={k}
                    onClick={() => resetToPreset(k as PresetKey)}
                    className={
                      "px-3 py-1 rounded border text-sm bg-black text-white"
                    }
                  >
                    {k}
                  </button>
                ),
            )}
          </div>
          <div className="flex gap-5">
            {todayStats && preset === "Daily" && (
              <>
                {todayStats.won && (
                  <button
                    onClick={handleShareDailyWin}
                    className="px-3 py-1.5 rounded border text-white"
                    aria-label="Share today's Daily board"
                  >
                    Share
                  </button>
                )}
                <div className="flex flex-col">
                  <div className="text-sm text-white text-left">
                    {`⏰: ${todayStats.time}`}
                  </div>
                  <div className="text-sm text-white text-left">{`💀: ${todayStats.deaths}`}</div>
                </div>
              </>
            )}
            <button
              title={"Set seed game, new seed every day at UTC 00:00"}
              key={"Daily"}
              onClick={() => resetToPreset("Daily" as PresetKey)}
              className={"px-3 py-1 rounded border text-sm bg-black text-white"}
            >
              {"Daily"}
            </button>
          </div>
        </div>

        <Board
          board={board}
          onReveal={handleReveal}
          onFlag={handleFlag}
          onHover={setHover}
          onLeave={() => {
            setHover(null);
          }}
          setPressing={() => {
            setPressing(true);
          }}
          pressedSet={pressedSet}
        />
      </div>
    </div>
  );
}
