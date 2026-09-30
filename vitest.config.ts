import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{shared,api,web}/src/**/*.test.ts'],
  },
});
