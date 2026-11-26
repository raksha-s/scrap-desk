import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5191, strictPort: true },
  test: { environment: 'node', setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});
