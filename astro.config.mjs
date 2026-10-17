// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://cervanlojistik.com',
  trailingSlash: 'always',
  vite: {
    server: {
      proxy: {
        '/cerplus/api': { target: 'http://127.0.0.1:4322', changeOrigin: false },
      },
    },
  },
});
