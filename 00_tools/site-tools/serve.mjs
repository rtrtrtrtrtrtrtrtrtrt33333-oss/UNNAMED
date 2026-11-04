import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadConfig } from './lib.mjs';

const config = loadConfig();
const args = new Set(process.argv.slice(2));
const serveDist = args.has('--dist');
const requestedRoot = serveDist && fs.existsSync(config.distDirAbs)
  ? config.distDirAbs
  : config.sourceRootAbs;

const host = process.env.HOST || '127.0.0.1';
const startPort = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.mp4', 'video/mp4'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

function getSafeFilePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const cleanPath = decoded.replace(/^\/+/, '');
  const filePath = path.resolve(requestedRoot, cleanPath);
  const relative = path.relative(requestedRoot, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return filePath;
}

function serveFile(req, res, filePath) {
  let target = filePath;

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const ext = path.extname(target).toLowerCase();
  const headers = {
    'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
    'Cache-Control': 'no-store',
  };

  if (req.method === 'HEAD') {
    send(res, 200, '', headers);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(target).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/__tools/status') {
      json(res, 200, {
        ok: true,
        root: requestedRoot,
        mode: requestedRoot === config.distDirAbs ? 'dist' : 'source',
        worlds: config.worlds,
      });
      return;
    }

    const filePath = getSafeFilePath(requestUrl.pathname);
    if (!filePath) {
      send(res, 400, 'Bad path', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    serveFile(req, res, filePath);
  });
}

function listen(port) {
  const server = createServer();

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, host, () => {
    console.log(`Mini server running at http://${host}:${port}/`);
    console.log(`Serving ${requestedRoot}`);
    console.log('Status endpoint: /__tools/status');
    console.log('Press Ctrl+C to stop.');
  });
}

listen(startPort);