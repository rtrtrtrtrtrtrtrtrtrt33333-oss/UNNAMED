import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, walkFiles, writeReport } from './lib.mjs';

const config = loadConfig();
const sourceRoot = config.sourceRootAbs;

const groups = {
  html: ['.html'],
  css: ['.css'],
  js: ['.js', '.mjs'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'],
  audio: ['.mp3', '.m4a', '.flac', '.wav', '.ogg'],
};

function emptyCounts() {
  return Object.fromEntries(Object.keys(groups).map((key) => [key, 0]));
}

function classify(file, counts) {
  const ext = path.extname(file).toLowerCase();
  for (const [group, extensions] of Object.entries(groups)) {
    if (extensions.includes(ext)) {
      counts[group] += 1;
      return;
    }
  }
}

function countDirectories(root, exclude = []) {
  let count = 0;
  if (!fs.existsSync(root)) return count;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || exclude.includes(entry.name)) continue;
    count += 1 + countDirectories(path.join(root, entry.name), exclude);
  }

  return count;
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  total: emptyCounts(),
  worlds: [],
};

for (const world of config.worlds) {
  const worldRoot = path.join(sourceRoot, world.path);
  const counts = emptyCounts();

  if (fs.existsSync(worldRoot)) {
    for (const file of walkFiles(worldRoot, config.exclude)) {
      classify(file, counts);
      classify(file, report.total);
    }
  }

  report.worlds.push({
    id: world.id,
    title: world.title,
    path: world.path,
    directories: countDirectories(worldRoot, config.exclude),
    ...counts,
  });
}

writeReport('inventory.json', report);

console.table(report.worlds);
console.log('Inventory written to 00_tools/site-tools/reports/inventory.json');