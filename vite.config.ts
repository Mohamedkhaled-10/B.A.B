import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// Single-source asset synchronization plugin
function syncBabAssetsPlugin() {
  return {
    name: 'sync-bab-assets',
    buildStart() {
      const rootDir = import.meta.dirname || path.resolve('.');
      const syncPairs = [
        {
          src: path.join(rootDir, 'data/knowledge.json'),
          dest: path.join(rootDir, 'public/assets/bab/data/knowledge.json'),
        },
        {
          src: path.join(rootDir, 'widget/bab-widget.js'),
          dest: path.join(rootDir, 'public/assets/bab/widget/bab-widget.js'),
        },
        {
          src: path.join(rootDir, 'widget/bab-widget.css'),
          dest: path.join(rootDir, 'public/assets/bab/widget/bab-widget.css'),
        },
      ];

      for (const pair of syncPairs) {
        if (fs.existsSync(pair.src)) {
          const destDir = path.dirname(pair.dest);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(pair.src, pair.dest);
        }
      }
    },
  };
}

export default defineConfig(() => {
  const rootPath = import.meta.dirname || path.resolve('.');
  return {
    plugins: [syncBabAssetsPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': rootPath,
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootPath, 'index.html'),
          dashboard: path.resolve(rootPath, 'dashboard/index.html'),
          preview: path.resolve(rootPath, 'preview/index.html'),
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
