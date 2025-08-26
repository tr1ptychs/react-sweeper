/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import App from "../src/App";

it("renders the board", () => {
  render(<App />);
  expect(screen.getByTestId("board")).toBeInTheDocument();
});
