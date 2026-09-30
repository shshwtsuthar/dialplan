import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{shared,api,web}/src/**/*.test.ts'],
    // Handlers log as they would in Lambda; only show that for failing tests.
    silent: 'passed-only',
  },
});
