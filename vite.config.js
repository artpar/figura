import { defineConfig } from 'vite';

export default defineConfig({
  base: '/figura/',
  test: {
    environment: 'jsdom',
  },
});
