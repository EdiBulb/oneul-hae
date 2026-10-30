import { defineConfig } from 'vite';

export default defineConfig({
  // three.js가 커서 경고 기준만 올림 (gzip 약 150KB)
  build: { chunkSizeWarningLimit: 800 },
  server: { host: true },
});
