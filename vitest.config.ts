import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('1.10.0'),
    __BUILD_HASH__: JSON.stringify('f4b929d')
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.d.ts'],
      thresholds: {
        'src/state/**': {
          lines: 80,
          statements: 80,
          functions: 80
        },
        'src/systems/**': {
          lines: 60,
          statements: 60,
          functions: 60
        },
        'src/core/**': {
          lines: 70,
          statements: 70,
          functions: 70
        }
      }
    }
  }
});
