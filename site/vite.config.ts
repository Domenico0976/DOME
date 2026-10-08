import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// GitHub Pages: custom domain uses '/', project page uses '/<repo>/'
const base = process.env.BASE_PATH || '/';

// SPA fallback: copies index.html → 404.html for GitHub Pages
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const out = path.resolve(process.cwd(), '..', 'dist-site');
      const idx = path.join(out, 'index.html');
      if (existsSync(idx)) copyFileSync(idx, path.join(out, '404.html'));
    },
  };
}

// Copy tools-app/dist into dist-site/tools so /tools/ is reachable
function toolsCopy() {
  return {
    name: 'tools-copy',
    closeBundle() {
      const src = path.resolve(process.cwd(), '..', 'tools-app', 'dist');
      const dest = path.resolve(process.cwd(), '..', 'dist-site', 'tools');
      if (existsSync(src)) {
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallback(), toolsCopy()],
  base,
  server: { port: 5174 },
  build: { outDir: '../dist-site' },
});
