/**
 * Asset synchronization script
 * Keeps public/assets/bab/ in exact sync with single-source files:
 * - data/knowledge.json -> public/assets/bab/data/knowledge.json
 * - widget/bab-widget.js -> public/assets/bab/widget/bab-widget.js
 * - widget/bab-widget.css -> public/assets/bab/widget/bab-widget.css
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

console.log('🔄 Synchronizing B.A.B single-source assets...');

for (const pair of syncPairs) {
  if (fs.existsSync(pair.src)) {
    const destDir = path.dirname(pair.dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(pair.src, pair.dest);
    console.log(`  ✓ Synced ${path.relative(rootDir, pair.src)} -> ${path.relative(rootDir, pair.dest)}`);
  } else {
    console.warn(`  ⚠️ Source file not found: ${pair.src}`);
  }
}

console.log('✅ Synchronization complete.');
