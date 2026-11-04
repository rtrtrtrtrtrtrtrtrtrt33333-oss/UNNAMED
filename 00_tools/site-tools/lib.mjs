import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const toolRoot = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  const configPath = path.join(toolRoot, 'site.config.json');
  const configText = fs.readFileSync(configPath, 'utf8').replace(/^\\uFEFF/, '');
  const config = JSON.parse(configText);
  config.sourceRootAbs = path.resolve(toolRoot, config.sourceRoot);
  config.distDirAbs = path.resolve(toolRoot, config.distDir);
  return config;
}

export function ensureInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${parent}: ${child}`);
  }
}

export function* walkFiles(root, exclude = []) {
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath, exclude);
      continue;
    }

    yield fullPath;
  }
}

export function copyTree(source, target, exclude = []) {
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath, exclude);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

export function writeReport(name, data) {
  const reportsDir = path.join(toolRoot, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}