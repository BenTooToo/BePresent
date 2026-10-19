const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const assetRoot = path.join(root, 'assets') + path.sep;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const filename = pathname === '/' || pathname === '/index.html'
    ? path.join(root, 'index.html') : path.resolve(root, '.' + pathname);
  if (filename !== path.join(root, 'index.html') && !filename.startsWith(assetRoot)) {
    res.writeHead(404); res.end(); return;
  }
  fs.readFile(filename, (error, data) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
