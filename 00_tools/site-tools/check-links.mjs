import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, walkFiles, writeReport } from './lib.mjs';

const config = loadConfig();
const targetRoot = fs.existsSync(config.distDirAbs) ? config.distDirAbs : config.sourceRootAbs;
const issues = [];
const ignoredLinkPatterns = (config.ignoredLinks || []).map((pattern) => new RegExp(pattern));

function isExternal(value) {
  return /^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(value);
}

function cleanUrl(value) {
  const withoutHash = value.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

function checkPath(owner, rawValue) {
  if (!rawValue || isExternal(rawValue)) return;
  const cleaned = cleanUrl(rawValue).trim();
  if (!cleaned) return;
  if (ignoredLinkPatterns.some((pattern) => pattern.test(cleaned))) return;

  const resolved = cleaned.startsWith('/')
    ? path.join(targetRoot, cleaned)
    : path.resolve(path.dirname(owner), cleaned);

  if (!fs.existsSync(resolved)) {
    issues.push({
      file: path.relative(targetRoot, owner),
      link: rawValue,
      resolved: path.relative(targetRoot, resolved),
    });
  }
}

for (const file of walkFiles(targetRoot, config.exclude)) {
  const ext = path.extname(file).toLowerCase();
  if (!['.html', '.css'].includes(ext)) continue;

  const text = fs.readFileSync(file, 'utf8');

  if (ext === '.html') {
    for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      checkPath(file, match[1]);
    }
  }

  if (ext === '.css') {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/gi)) {
      checkPath(file, match[1] || match[2] || match[3]);
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  checkedRoot: targetRoot,
  issueCount: issues.length,
  issues,
};

writeReport('link-check.json', report);

if (issues.length) {
  console.table(issues.slice(0, 50));
  console.log(`Found ${issues.length} possible broken links. Full report: 00_tools/site-tools/reports/link-check.json`);
  process.exitCode = 1;
} else {
  console.log('No broken static href/src/url links found.');
}