import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./setup-tests.ts"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "vite-env.d.ts", "**/*.d.ts"],
    },
  },
});
