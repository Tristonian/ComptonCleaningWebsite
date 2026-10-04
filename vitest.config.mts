import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Components are .tsx and tsconfig keeps JSX as "preserve" for Next, so tell the test transform (oxc, Vite 8) to compile it.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each database test boots an in-process Postgres and runs every migration; with many files in
    // parallel that can pass the 10 s default on a busy machine without anything being wrong.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'server-only': path.resolve(import.meta.dirname, './test/stubs/server-only.ts'),
    },
  },
});
