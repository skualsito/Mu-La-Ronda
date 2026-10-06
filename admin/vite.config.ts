import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Mu La Ronda's admin panel: its own small Vite app (like the register page),
 * served by nginx on admin.<DOMAIN> from dist-admin/, with /api proxied to
 * admin/server/main.ts.
 *
 * Dev: `bun run dev:admin` (port 5175) proxies /api to a local
 * `bun run admin-api` on 3200.
 */

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../dist-admin', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: { '/api': 'http://127.0.0.1:3200' },
  },
});
