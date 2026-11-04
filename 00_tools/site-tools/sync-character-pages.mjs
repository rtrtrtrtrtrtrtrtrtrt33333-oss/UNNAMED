import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeReport } from './lib.mjs';

const config = loadConfig();

function getCharacterWorlds() {
  return config.worlds
    .map((world) => ({
      id: world.id,
      title: world.title,
      charactersRoot: path.join(config.sourceRootAbs, world.path, 'Characters'),
    }))
    .filter((world) => fs.existsSync(world.charactersRoot));
}

export function syncCharacterPages() {
  const synced = [];
  const skipped = [];

  for (const world of getCharacterWorlds()) {
    const templatePath = path.join(world.charactersRoot, '00_code', 'templates', 'character-page.html');

    if (!fs.existsSync(templatePath)) {
      skipped.push({ world: world.id, reason: 'missing template', path: templatePath });
      continue;
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    const entries = fs.readdirSync(world.charactersRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '00_code') continue;

      const characterRoot = path.join(world.charactersRoot, entry.name);
      const customMarker = path.join(characterRoot, 'custom-character-page.html');
      const target = path.join(characterRoot, 'character-page.html');

      if (fs.existsSync(customMarker)) {
        skipped.push({ world: world.id, character: entry.name, reason: 'custom-character-page.html exists' });
        continue;
      }

      fs.writeFileSync(target, template, 'utf8');
      synced.push({ world: world.id, character: entry.name, file: path.relative(config.sourceRootAbs, target) });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    syncedCount: synced.length,
    skippedCount: skipped.length,
    synced,
    skipped,
  };

  writeReport('character-pages-sync.json', report);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = syncCharacterPages();
  console.log(`Synced ${report.syncedCount} character pages from templates.`);
  if (report.skippedCount) {
    console.log(`Skipped ${report.skippedCount} character folders.`);
  }
  console.log('Report written to 00_tools/site-tools/reports/character-pages-sync.json');
}