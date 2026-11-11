#!/usr/bin/env node
/* Visualização local com as mesmas rotas do Netlify (sem instalar nada): node tools/preview.mjs
   Abre em http://localhost:8080. Usa o banco do Supabase se config.js estiver preenchido;
   caso contrário, mostra os imóveis de demonstração. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = +(process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (/^\/imovel\/[^/]+$/.test(p) && p !== '/imovel/index.html') p = '/imovel/index.html';
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Página não encontrada'); }
  let body = fs.readFileSync(f);
  if (p === '/assets/js/config.js') body = Buffer.from(body.toString().replace('prettyUrls: false', 'prettyUrls: true'));
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body);
}).listen(PORT, () => console.log(`Site em http://localhost:${PORT}  (Ctrl+C para parar)`));
