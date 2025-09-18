// @vitest-environment jsdom
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetAllMocks();
});

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

    await user.pointer([
      { keys: "[MouseLeft>]", target: firstCell },
      { keys: "[/MouseLeft]", target: firstCell },
    ]);
    expect(boardFns.addMines).toHaveBeenCalledTimes(1);
    expect(boardFns.reveal).toHaveBeenCalledTimes(1);
  });

  it("second left click does not place more mines", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const firstCell = grid.firstElementChild as HTMLElement;
    const secondCell = screen.getByTestId("cell-8-8");

    await user.pointer([
      { keys: "[MouseLeft>]", target: firstCell },
      { keys: "[/MouseLeft]", target: firstCell },
    ]);
    const before = vi.mocked(boardFns).addMines.mock.calls.length;
    await user.pointer([
      { keys: "[MouseLeft>]", target: secondCell },
      { keys: "[/MouseLeft]", target: secondCell },
    ]);
    const after = vi.mocked(boardFns).addMines.mock.calls.length;
    expect(before).toBe(after);
  });

  it("right-click flags and updates remaining mines counter", async () => {
    render(<Minesweeper />);
    const grid = screen.getByTestId("board");
    const cell = grid.firstElementChild as HTMLElement;

    const user = userEvent.setup();
    await user.pointer({ target: cell, keys: "[MouseRight]" }); // right button
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
      fireEvent.pointerDown(first);
      fireEvent.pointerUp(first);
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("timer")).toHaveTextContent("003");

    await act(async () => {
      vi.mocked(boardFns.reveal).mockImplementationOnce(() => -1);
      fireEvent.pointerDown(second);
      fireEvent.pointerUp(second);

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
      fireEvent.pointerDown(cell);
      fireEvent.pointerUp(cell);
      await vi.advanceTimersByTimeAsync(2000);
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

    await user.keyboard("w");
    expect(cell).toHaveTextContent("");
    const before = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.keyboard("q");
    const after = vi.mocked(boardFns).reveal.mock.calls.length;
    expect(before).toBe(after);

    fireEvent.pointerEnter(cell);
    await user.keyboard("w");
    expect(cell).toHaveTextContent("🚩");
    // other keys don't flag
    await user.keyboard("d");
    expect(cell).toHaveTextContent("🚩");
    // cell doesn't reveal with flag
    await user.keyboard("q");
    expect(cell).toHaveTextContent("🚩");

    await user.keyboard("w");
    expect(cell).toHaveTextContent("");

    const callsBefore = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.keyboard("q");
    const callsAfter = vi.mocked(boardFns).reveal.mock.calls.length;
    expect(callsBefore).toBeLessThan(callsAfter);

    const beforeLeave = vi.mocked(boardFns).reveal.mock.calls.length;
    fireEvent.pointerLeave(cell);
    await user.keyboard("q");
    const afterLeave = vi.mocked(boardFns).reveal.mock.calls.length;
    expect(beforeLeave).toBe(afterLeave);
  });

  it("changing presets updates mine counter", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    expect(screen.getAllByText(/^\d{3}$/)[0]).toHaveTextContent("010");

    await user.click(screen.getByRole("button", { name: "Intermediate" }));
    expect(screen.getAllByText(/^\d{3}$/)[0]).toHaveTextContent("040");

    await user.click(screen.getByRole("button", { name: "Expert" }));
    expect(screen.getAllByText(/^\d{3}$/)[0]).toHaveTextContent("099");
  });

  it("changing presets updates board size", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);

    await user.click(screen.getByRole("button", { name: "Beginner" }));
    expect(screen.getByTestId("cell-8-8")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-9-8")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-8-9")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Intermediate" }));
    expect(screen.getByTestId("cell-15-15")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-16-15")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-15-16")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expert" }));
    expect(screen.getByTestId("cell-15-29")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-15-30")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-16-29")).not.toBeInTheDocument();
  });

  it("clicking a revealed zero triggers chord", async () => {
    const user = userEvent.setup();

    vi.mocked(boardFns.addMines).mockImplementationOnce(
      (board: boardFns.Board) => {
        board[2][0].mine = true;
        board[1][0].adjacentMines = 1;
        board[1][0].revealed = true;
        board[1][1].adjacentMines = 1;
        board[1][1].revealed = true;
        board[0][1].adjacentMines = 1;
        board[0][1].revealed = true;
      },
    );

    const real = await vi.importActual<
      typeof import("../../src/game/board.ts")
    >("../../src/game/board.ts");
    vi.spyOn(boardFns, "chord").mockImplementation((b, loc) =>
      real.chord(b, loc),
    );

    render(<Minesweeper />);

    const chordTile = screen.getByTestId("cell-1-0");
    await user.click(screen.getByTestId("cell-0-0"));
    expect(chordTile).toHaveTextContent("1");

    const correctNeighbor = screen.getByTestId("cell-2-0");
    await user.pointer({ target: correctNeighbor, keys: "[MouseRight]" }); // right button
    expect(correctNeighbor).toHaveTextContent("🚩");

    await user.click(chordTile);
    expect(vi.mocked(boardFns).chord.mock.calls.length).toBe(1);
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

    fireEvent.pointerDown(otherCell, { button: 2 });
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
    await user.pointer({ target: wrongNeighbor, keys: "[MouseRight]" }); // right button
    expect(wrongNeighbor).toHaveTextContent("🚩");

    await user.click(chordTile);

    expect(screen.getByRole("button", { name: "💀" })).toBeInTheDocument();
    expect(vi.mocked(boardFns.showMines)).toHaveBeenCalled();

    const otherCell = screen.getByTestId("cell-8-8");
    const callsBefore = vi.mocked(boardFns).reveal.mock.calls.length;
    await user.click(otherCell);
    const callsAfter = vi.mocked(boardFns).reveal.mock.calls.length;

    expect(callsAfter).toBe(callsBefore);

    fireEvent.pointerDown(otherCell, { button: 2 });
    fireEvent.pointerUp(otherCell, { button: 2 });
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

describe("Daily preset", () => {
  it("Sets correct mines and dimension when daily clicked", async () => {
    const user = userEvent.setup();
    render(<Minesweeper />);
    await user.click(screen.getByRole("button", { name: "Daily" }));
    expect(screen.getByTestId("cell-19-29")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-20-29")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-19-30")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/daily");
    await user.click(screen.getByRole("button", { name: "Beginner" }));
    expect(window.location.pathname).toBe("/");
  });

  it("Sets correct mines and dimension when navigating to /daily", async () => {
    window.history.pushState({}, "", "/daily");
    const user = userEvent.setup();
    render(<Minesweeper />);
    expect(screen.getByTestId("cell-19-29")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-20-29")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-19-30")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/daily");
    await user.click(screen.getByRole("button", { name: "Beginner" }));
    expect(window.location.pathname).toBe("/");
  });
});
