import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Components are .tsx and tsconfig keeps JSX as "preserve" for Next, so tell the test transform (oxc, Vite 8) to compile it.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'server-only': path.resolve(import.meta.dirname, './test/stubs/server-only.ts'),
    },
  },
});
