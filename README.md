# react-sweeper

A fast, deterministic minesweeper built with React + TypeScript. Features first-click safety, chording, keyboard play with Q/W, and a Daily seeded challenge at `/daily`. Core board logic is fully unit and mutation tested and documented.

[Live via Vercel](https://react-sweeper-snowy.vercel.app/)

## Features

- **First-click safety:** First clicked cell and surrounding cells will never be a mine.
- **Chording:** Click a revealed number to reveal its remaining neighbors when number of neighboringe flags matches the number.
- **Keyboard play with Q/W:** Playing on your laptop? Use `q` for left click, and `w` for right click.
- **Daily seeded challenge at `/daily`:** Addicted to the daily game modes? We have one too. Larger-than-expert board with slightly higher mine density, on a set seed. 
- **Performance:** Iterative reveal for no deep recursion

## Controls

- Reveal: Left‑click or Q (hovered tile)
- Flag: Right‑click, W (hovered)
- Chord: Click a revealed number when flag count matches
- Reset: Click the face

## Running Locally

ezpz. no lemon squeezy required.
```
# install deps
npm i

# dev
npm run dev

# production
npm run build
npm run preview
```

## Testing
This repo uses [Vitest](https://vitest.dev/) for unit tests and [Stryker](https://stryker-mutator.io/) for mutation tests.
```
npm run test         # watch mode
npm run test:ci      # run once with coverage report
npx run test:mutant  # run mutation tests
```
**Testing goals:** 100% branch/stmt/func/line, 100% mutant score on `board.ts`, ~90% everywhere else.


