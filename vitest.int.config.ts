import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/database/**/*.int-spec.ts'],
    environment: 'node',
    setupFiles: ['test/helpers/load-env.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
