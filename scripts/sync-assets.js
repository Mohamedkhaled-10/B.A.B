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
  {
    src: path.join(rootDir, 'widget/assets/dandy-logo.png'),
    dest: path.join(rootDir, 'public/assets/bab/images/dandy-logo.png'),
  },
  {
    src: path.join(rootDir, 'widget/assets/dandy-logo-white.png'),
    dest: path.join(rootDir, 'public/assets/bab/images/dandy-logo-white.png'),
  },
  {
    src: path.join(rootDir, 'widget/assets/dandy-logo.svg'),
    dest: path.join(rootDir, 'public/assets/bab/images/dandy-logo.svg'),
  },
  {
    src: path.join(rootDir, 'widget/assets/dandy-logo-white.svg'),
    dest: path.join(rootDir, 'public/assets/bab/images/dandy-logo-white.svg'),
  },
];

console.log('🔄 Synchronizing B.A.B single-source assets...');

// Step 1: Ensure BUNDLED_KNOWLEDGE is inlined into widget/bab-widget.js
try {
  const knowledgePath = path.join(rootDir, 'data/knowledge.json');
  const widgetPath = path.join(rootDir, 'widget/bab-widget.js');
  if (fs.existsSync(knowledgePath) && fs.existsSync(widgetPath)) {
    const rawKnowledge = fs.readFileSync(knowledgePath, 'utf8');
    const jsonLiteral = JSON.stringify(JSON.parse(rawKnowledge));
    let widgetCode = fs.readFileSync(widgetPath, 'utf8');
    const bundleMarker = '// --- BUNDLED_KNOWLEDGE_START ---';
    const bundleEndMarker = '// --- BUNDLED_KNOWLEDGE_END ---';
    const bundleBlock = `${bundleMarker}\nexport const BUNDLED_KNOWLEDGE = ${jsonLiteral};\n${bundleEndMarker}`;

    if (widgetCode.includes(bundleMarker)) {
      const regex = new RegExp(`${bundleMarker}[\\s\\S]*?${bundleEndMarker}`, 'g');
      widgetCode = widgetCode.replace(regex, bundleBlock);
    } else {
      widgetCode = widgetCode.replace(
        'export class DandyBabWidget extends BaseElement {',
        `${bundleBlock}\n\nexport class DandyBabWidget extends BaseElement {`
      );
    }
    fs.writeFileSync(widgetPath, widgetCode, 'utf8');
    console.log('  ✓ Inlined bundled knowledge base into widget/bab-widget.js');
  }
} catch (err) {
  console.warn('  ⚠️ Could not inline bundled knowledge:', err.message);
}

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
