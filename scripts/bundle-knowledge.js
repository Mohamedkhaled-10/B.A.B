import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const knowledgePath = path.join(rootDir, 'data/knowledge.json');
const widgetPath = path.join(rootDir, 'widget/bab-widget.js');

const rawKnowledge = fs.readFileSync(knowledgePath, 'utf8');
const knowledgeObj = JSON.parse(rawKnowledge);

// Minified clean JSON string for bundle
const jsonLiteral = JSON.stringify(knowledgeObj);

let widgetCode = fs.readFileSync(widgetPath, 'utf8');

const bundleMarker = '// --- BUNDLED_KNOWLEDGE_START ---';
const bundleEndMarker = '// --- BUNDLED_KNOWLEDGE_END ---';

const bundleBlock = `${bundleMarker}\nexport const BUNDLED_KNOWLEDGE = ${jsonLiteral};\n${bundleEndMarker}`;

if (widgetCode.includes(bundleMarker)) {
  const regex = new RegExp(`${bundleMarker}[\\s\\S]*?${bundleEndMarker}`, 'g');
  widgetCode = widgetCode.replace(regex, bundleBlock);
} else {
  // Insert before DandyBabWidget class
  widgetCode = widgetCode.replace(
    'export class DandyBabWidget extends BaseElement {',
    `${bundleBlock}\n\nexport class DandyBabWidget extends BaseElement {`
  );
}

fs.writeFileSync(widgetPath, widgetCode, 'utf8');
console.log('✅ Inlined BUNDLED_KNOWLEDGE into widget/bab-widget.js successfully.');
