// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

vi.mock("../../src/game/board.ts", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/game/board.ts")
  >("../../src/game/board.ts");
  return {
    ...actual,
    makeBoard: vi.fn((rows: number, cols: number) =>
      Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
          revealed: false,
          flagged: false,
          mine: false,
          adjacentMines: 0,
        })),
      ),
    ),
    addMines: vi.fn(),
    reveal: vi.fn((b: boardFns.Board, loc: { row: number; col: number }) => {
      b[loc.row][loc.col].revealed = true;
      return 1;
    }),
    showMines: vi.fn((b: boardFns.Board) => {
      b[0][0].mine = true;
      b[0][0].revealed = true;
    }),
  };
});

import Minesweeper from "../../src/game/Minesweeper";
import * as boardFns from "../../src/game/board.ts";

describe("Minesweeper", () => {
  it("renders Beginner preset with counters and ready face", () => {
    render(<Minesweeper />);
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🙂" })).toBeInTheDocument();
    const counters = screen.getAllByText(/^\d{3}$/);
    expect(counters[0]).toHaveTextContent("010");
    expect(counters[1]).toHaveTextContent("000");
  });

  it("first left-click places mines and reveals", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const firstCell = grid.firstElementChild as HTMLElement;

    await user.click(firstCell);
    expect(boardFns.addMines).toHaveBeenCalledTimes(1);
    expect(boardFns.reveal).toHaveBeenCalledTimes(1);
  });

  it("right-click flags and updates remaining mines counter", async () => {
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    fireEvent.contextMenu(cell);
    expect(cell).toHaveTextContent("🚩");
    expect(screen.getAllByText(/^\d{3}$/)[0]).toHaveTextContent("009");
  });

  it("timer runs after first reveal and stops on loss", async () => {
    vi.useFakeTimers();

    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const first = grid.firstElementChild as HTMLElement;
    const second = first.nextElementSibling as HTMLElement;

    await act(async () => {
      fireEvent.click(first);

      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("timer")).toHaveTextContent("003");

    await act(async () => {
      vi.mocked(boardFns.reveal).mockImplementationOnce(() => -1);
      fireEvent.click(second);

      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByRole("button", { name: "💀" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("timer")).toHaveTextContent("003");

    vi.useRealTimers();
  });

  it("reset via face returns to ready and clears timer/flags", async () => {
    vi.useFakeTimers();

    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    await act(async () => {
      fireEvent.click(cell);
      await vi.advanceTimersByTimeAsync(2000);
      fireEvent.contextMenu(cell);
      fireEvent.click(screen.getByRole("button", { name: "😬" }));
    });

    expect(screen.getByRole("button", { name: "🙂" })).toBeInTheDocument();
    const [minesLeft, time] = screen.getAllByText(/^\d{3}$/);
    expect(minesLeft).toHaveTextContent("010");
    expect(time).toHaveTextContent("000");
    vi.useRealTimers();
  });

  it("keyboard shortcuts q (reveal) and w (flag) act on hovered cell", async () => {
    const user = userEvent.setup();

    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    fireEvent.pointerEnter(cell);
    await user.keyboard("w");
    expect(cell).toHaveTextContent("🚩");

    await user.keyboard("q");
    expect(vi.mocked(boardFns.reveal)).toHaveBeenCalled();
  });

  it("changing presets updates mine counter", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    await user.click(screen.getByRole("button", { name: "Intermediate" }));
    expect(screen.getAllByText(/^\d{3}$/)[0]).toHaveTextContent("040");
  });

  it("chording a revealed zero triggers neighbor reveals", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    await user.click(cell);
    const callsBefore = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.click(cell);
    const callsAfter = vi.mocked(boardFns).reveal.mock.calls.length;

    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it("renders the adjacent number after reveal", async () => {
    const user = userEvent.setup();
    vi.mocked(boardFns.addMines).mockImplementationOnce(
      (board: boardFns.Board) => {
        board[0][0].adjacentMines = 2;
      },
    );
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    await user.click(cell);

    expect(cell).toHaveTextContent("2");
  });

  it("renders win correctly, with no more reveal nor flag", async () => {
    const user = userEvent.setup();
    vi.mocked(boardFns.reveal).mockImplementationOnce(() => 71);
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    await user.click(cell);

    expect(screen.getByRole("button", { name: "😎" })).toBeInTheDocument();

    const otherCell = screen.getByTestId("cell-8-8");
    const callsBefore = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.click(otherCell);
    const callsAfter = vi.mocked(boardFns).reveal.mock.calls.length;

    expect(callsAfter).toBe(callsBefore);

    expect(callsAfter).toBe(callsBefore);

    fireEvent.contextMenu(otherCell);
    expect(otherCell).toHaveTextContent("");
  });

  it("fails correctly on incorrect chord, with no more reveal nor flag", async () => {
    const user = userEvent.setup();

    vi.mocked(boardFns.addMines).mockImplementationOnce(
      (board: boardFns.Board) => {
        board[2][0].mine = true;
        board[1][0].adjacentMines = 1;
      },
    );

    const real = await vi.importActual<
      typeof import("../../src/game/board.ts")
    >("../../src/game/board.ts");
    vi.spyOn(boardFns, "reveal").mockImplementation((b, loc) =>
      real.reveal(b, loc),
    );

    render(<Minesweeper />);

    const chordTile = screen.getByTestId("cell-1-0");
    await user.click(chordTile);
    expect(chordTile).toHaveTextContent("1");

    const wrongNeighbor = screen.getByTestId("cell-2-1");
    fireEvent.contextMenu(wrongNeighbor);
    expect(wrongNeighbor).toHaveTextContent("🚩");

    await user.click(chordTile);

    expect(screen.getByRole("button", { name: "💀" })).toBeInTheDocument();
    expect(vi.mocked(boardFns.showMines)).toHaveBeenCalled();

    const otherCell = screen.getByTestId("cell-8-8");
    const callsBefore = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.click(otherCell);
    const callsAfter = vi.mocked(boardFns).reveal.mock.calls.length;

    expect(callsAfter).toBe(callsBefore);

    fireEvent.contextMenu(otherCell);
    expect(otherCell).toHaveTextContent("");

    fireEvent.pointerEnter(otherCell);
    await user.keyboard("w");
    expect(otherCell).toHaveTextContent("");

    await user.keyboard("q");
    const before = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.keyboard("q");
    const after = vi.mocked(boardFns).reveal.mock.calls.length;
    expect(before).toBe(after);
  });
});
