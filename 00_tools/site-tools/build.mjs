  import fs from 'node:fs';
import path from 'node:path';
import { copyTree, ensureInside, loadConfig, writeReport } from './lib.mjs';

const config = loadConfig();
const sourceRoot = config.sourceRootAbs;
const distRoot = config.distDirAbs;

ensureInside(sourceRoot, distRoot);

if (fs.existsSync(distRoot)) {
  fs.rmSync(distRoot, { recursive: true, force: true });
}

fs.mkdirSync(distRoot, { recursive: true });

const copied = [];

for (const file of config.copyRootFiles) {
  const source = path.join(sourceRoot, file);
  const target = path.join(distRoot, file);
  if (!fs.existsSync(source)) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  copied.push(file);
}

for (const world of config.worlds) {
  const source = path.join(sourceRoot, world.path);
  const target = path.join(distRoot, world.path);
  if (!fs.existsSync(source)) continue;
  copyTree(source, target, config.exclude);
  copied.push(world.path);
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  distRoot,
  copied,
};

writeReport('build.json', report);

console.log(`Built static site into ${distRoot}`);
console.log('Build report written to 00_tools/site-tools/reports/build.json');