import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.ts', 'src/core/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/modules/registry.ts'],
      // Each module owns its own gate (the team plan §3.17): run with `--coverage.include=src/modules/<m>/**`.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
