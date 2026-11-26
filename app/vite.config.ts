import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5191, strictPort: true },
  // screen tests can take several seconds on a busy machine
  test: { environment: 'node', setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], testTimeout: 20_000 },
});
