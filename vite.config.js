import { defineConfig } from 'vite';

export default defineConfig({
  base: '/figura/',
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
  },
});
