#!/usr/bin/env node
/* Ambiente de TESTE local que reproduz o que o site usa do Supabase e do Netlify:
     - API REST (subconjunto do PostgREST) executada em um PostgreSQL real, com as regras RLS de supabase/schema.sql
     - login por e-mail e senha (tokens JWT), armazenamento de fotos e URLs públicas
     - site estático com os mesmos redirecionamentos do netlify.toml, sitemap e função de metadados
   Não é usado em produção. Uso:  node tests/local-supabase/server.mjs [--demo]
   Requer PostgreSQL local com o banco preparado por tests/local-supabase/setup.sh */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUB = path.join(ROOT, 'public');
const API_PORT = +(process.env.API_PORT || 54321), SITE_PORT = +(process.env.SITE_PORT || 8888);
const API = `http://127.0.0.1:${API_PORT}`;
const SECRET = 'guarita-teste-local-nao-usar-em-producao';
const ANON_KEY = sign({ role: 'anon', iss: 'local' }, 10 * 365 * 86400);
const DEMO = process.argv.includes('--demo');
const STORE = path.join(process.env.STORE_DIR || '/tmp/guarita-storage');
fs.mkdirSync(STORE, { recursive: true });
// como o PostgREST, devolve numeric/bigint como número no JSON
pg.types.setTypeParser(1700, v => v === null ? null : Number(v)); pg.types.setTypeParser(1082, v => v); // date como texto AAAA-MM-DD, igual ao PostgREST pg.types.setTypeParser(20, v => v === null ? null : Number(v));
const pool = new pg.Pool({ host: '127.0.0.1', user: 'postgres', password: process.env.PGPASSWORD || 'postgres', database: process.env.PGDATABASE || 'guarita_test', max: 8 });

/* ---------- JWT HS256 ---------- */
function b64u(b) { return Buffer.from(b).toString('base64url'); }
function sign(payload, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
function verify(t) {
  const [h, p, s] = String(t || '').split('.');
  if (!s || crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp > Date.now() / 1000 ? c : null;
}

/* ---------- utilidades HTTP ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer,accept,x-client-info,x-upsert,cache-control,accept-profile,content-profile,x-supabase-api-version,range', 'Access-Control-Expose-Headers': 'content-range' };
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body), data = body === undefined || body === null ? '' : isBuf ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { ...CORS, ...(isBuf || typeof body === 'string' ? {} : { 'Content-Type': 'application/json' }), ...headers });
  res.end(data);
}
const readBody = req => new Promise((ok, ko) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', ko); });
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('identificador inválido: ' + s), { status: 400 }); return `"${s}"`; };

/* executa como o papel do usuário (anon/authenticated) com as claims do JWT: as regras RLS valem */
async function asUser(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${claims.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
function claimsOf(req) {
  if (!req.headers.apikey) throw Object.assign(new Error('No API key found in request'), { status: 401 });
  const tok = (req.headers.authorization || '').replace(/^Bearer /i, '') || req.headers.apikey;
  const c = verify(tok);
  if (!c) throw Object.assign(new Error('JWT expired or invalid'), { status: 401, code: 'PGRST301' });
  return c;
}
function pgErr(res, e, claims) {
  const map = { '42501': claims && claims.role === 'authenticated' ? 403 : 401, '23505': 409, '23514': 400, '23502': 400, '22P02': 400, '23503': 409 };
  send(res, e.status || map[e.code] || 400, { code: e.code || 'PGRST', message: e.message, details: e.detail || null, hint: null });
}

/* ---------- PostgREST (subconjunto usado pelo site) ---------- */
let colTypes = null;
async function types(table) {
  if (!colTypes) {
    const r = await pool.query(`select table_name, column_name, data_type from information_schema.columns where table_schema='public'`);
    colTypes = {}; r.rows.forEach(x => (colTypes[x.table_name] ||= {})[x.column_name] = x.data_type);
  }
  return colTypes[table] || {};
}
function where(sp, args) {
  const conds = [];
  for (const [k, v] of sp) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    const m = v.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|ilike|like)\.(.*)$/s);
    if (!m) throw Object.assign(new Error('filtro não suportado: ' + k), { status: 400 });
    const [, not, op, val] = m, col = ident(k);
    let c;
    if (op === 'is') c = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') { args.push(val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))); c = `${col}::text = any($${args.length})`; }
    else { args.push(op.endsWith('like') ? val.replace(/\*/g, '%') : val); c = `${col} ${{ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ilike', like: 'like' }[op]} $${args.length}`; }
    conds.push(not ? `not (${c})` : c);
  }
  return conds.length ? ' where ' + conds.join(' and ') : '';
}
const selectCols = s => !s || s === '*' ? '*' : s.split(',').map(x => ident(x.trim())).join(',');
function orderBy(o) {
  if (!o) return '';
  return ' order by ' + o.split(',').map(p => { const [c, d, n] = p.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}${n === 'nullsfirst' ? ' nulls first' : n === 'nullslast' ? ' nulls last' : ''}`; }).join(',');
}
async function rest(req, res, url) {
  const claims = claimsOf(req);
  const parts = url.pathname.replace(/^\/rest\/v1\//, '').split('/');
  const sp = url.searchParams, prefer = req.headers.prefer || '', single = /vnd\.pgrst\.object/.test(req.headers.accept || '');
  const body = ['POST', 'PATCH'].includes(req.method) ? JSON.parse((await readBody(req)).toString() || 'null') : null;
  try {
    if (parts[0] === 'rpc') {
      const fn = ident(parts[1]), args = [], names = [];
      Object.entries(body || {}).forEach(([k, v]) => { args.push(v); names.push(`${ident(k)} => $${args.length}`); });
      // como o PostgREST: função que retorna tabela -> lista de objetos; função escalar/void -> o valor
      const r = await asUser(claims, c => c.query(`select * from public.${fn}(${names.join(',')})`, args));
      const nome = parts[1];
      if (r.fields.length === 1 && r.fields[0].name === nome) return send(res, 200, r.rows[0] ? (r.rows[0][nome] === '' ? null : r.rows[0][nome]) : null);
      return send(res, 200, r.rows);
    }
    const table = ident(parts[0]), tt = await types(parts[0]);
    const val = (k, v) => tt[k] === 'jsonb' || tt[k] === 'json' ? JSON.stringify(v) : v;
    const ret = /return=representation/.test(prefer), args = [];
    let sql;
    if (req.method === 'GET' || req.method === 'HEAD') {
      sql = `select ${selectCols(sp.get('select'))} from public.${table}${where(sp, args)}${orderBy(sp.get('order'))}${sp.get('limit') ? ' limit ' + (+sp.get('limit')) : ''}${sp.get('offset') ? ' offset ' + (+sp.get('offset')) : ''}`;
    } else if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body], cols = [...new Set(rows.flatMap(Object.keys))];
      const vals = rows.map(r => '(' + cols.map(k => { if (!(k in r)) return 'default'; args.push(val(k, r[k])); return `$${args.length}`; }).join(',') + ')');
      sql = `insert into public.${table} (${cols.map(ident).join(',')}) values ${vals.join(',')} returning ${ret ? selectCols(sp.get('select')) : '1'}`;
    } else if (req.method === 'PATCH') {
      const sets = Object.entries(body).map(([k, v]) => { args.push(val(k, v)); return `${ident(k)} = $${args.length}`; });
      sql = `update public.${table} set ${sets.join(',')}${where(sp, args)} returning ${ret ? selectCols(sp.get('select')) : '1'}`;
    } else if (req.method === 'DELETE') {
      sql = `delete from public.${table}${where(sp, args)} returning ${ret ? selectCols(sp.get('select')) : '1'}`;
    } else return send(res, 405, { message: 'método não suportado' });
    const r = await asUser(claims, c => c.query(sql, args));
    const status = req.method === 'POST' ? 201 : 200;
    if (req.method !== 'GET' && !ret) return send(res, req.method === 'POST' ? 201 : 204, null);
    if (single) {
      if (r.rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${r.rows.length} rows`, hint: null });
      return send(res, status, r.rows[0]);
    }
    return send(res, status, r.rows, { 'Content-Range': `0-${Math.max(0, r.rows.length - 1)}/*` });
  } catch (e) { return pgErr(res, e, claims); }
}

/* ---------- Auth (GoTrue: e-mail e senha) ---------- */
const refresh = new Map();
function session(u) {
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at, email_confirmed_at: u.created_at };
  const rt = crypto.randomBytes(16).toString('hex'); refresh.set(rt, u);
  return { access_token: sign({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated' }, 3600), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: rt, user };
}
const authErr = (res, status, msg, code) => send(res, status, { code: status, error_code: code, msg, message: msg, error: code, error_description: msg });
async function auth(req, res, url) {
  const ep = url.pathname.replace(/^\/auth\/v1\//, '');
  const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse((await readBody(req)).toString() || '{}') : {};
  if (ep === 'token' && url.searchParams.get('grant_type') === 'password') {
    const r = await pool.query(`select id, email, created_at from auth.users where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)`, [body.email || '', body.password || '']);
    if (!r.rows[0]) return authErr(res, 400, 'Invalid login credentials', 'invalid_credentials');
    return send(res, 200, session(r.rows[0]));
  }
  if (ep === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const u = refresh.get(body.refresh_token); if (!u) return authErr(res, 400, 'Invalid Refresh Token', 'refresh_token_not_found');
    refresh.delete(body.refresh_token); return send(res, 200, session(u));
  }
  const c = verify((req.headers.authorization || '').replace(/^Bearer /i, ''));
  if (ep === 'user' && req.method === 'GET') {
    if (!c || !c.sub) return authErr(res, 401, 'invalid JWT', 'bad_jwt');
    const r = await pool.query('select id, email, created_at from auth.users where id = $1', [c.sub]);
    return r.rows[0] ? send(res, 200, session(r.rows[0]).user) : authErr(res, 404, 'User not found', 'user_not_found');
  }
  if (ep === 'user' && req.method === 'PUT') {
    if (!c || !c.sub) return authErr(res, 401, 'invalid JWT', 'bad_jwt');
    if (body.password) await pool.query(`update auth.users set encrypted_password = crypt($2, gen_salt('bf')) where id = $1`, [c.sub, body.password]);
    const r = await pool.query('select id, email, created_at from auth.users where id = $1', [c.sub]);
    return send(res, 200, session(r.rows[0]).user);
  }
  if (ep === 'logout') return send(res, 204, null);
  if (ep === 'recover') return send(res, 200, {});
  return authErr(res, 404, 'endpoint não simulado: ' + ep, 'not_found');
}

/* ---------- Storage ---------- */
async function storage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\//, ''));
  let m;
  if (req.method === 'GET' && (m = p.match(/^object\/public\/([^/]+)\/(.+)$/))) {
    const b = await pool.query('select public from storage.buckets where id = $1', [m[1]]);
    const f = path.join(STORE, m[1], m[2]);
    if (!b.rows[0] || !b.rows[0].public || !f.startsWith(STORE) || !fs.existsSync(f)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    const meta = JSON.parse(fs.readFileSync(f + '.meta', 'utf8'));
    return send(res, 200, fs.readFileSync(f), { 'Content-Type': meta.type, 'Cache-Control': meta.cache || 'no-cache' });
  }
  const claims = claimsOf(req);
  try {
    if (req.method === 'POST' && (m = p.match(/^object\/([^/]+)\/(.+)$/))) {
      let data = await readBody(req), type = req.headers['content-type'] || 'application/octet-stream';
      let cache = req.headers['cache-control'];
      const bm = type.match(/^multipart\/form-data;\s*boundary=(.+)$/);
      if (bm) { // o supabase-js envia Blob/File como FormData, igual ao Storage real
        const sep = Buffer.from('--' + bm[1]); let pos = data.indexOf(sep), file = null;
        while (pos >= 0) {
          const next = data.indexOf(sep, pos + sep.length); if (next < 0) break;
          const part = data.subarray(pos + sep.length + 2, next - 2), he = part.indexOf('\r\n\r\n');
          const head = part.subarray(0, he).toString(), content = part.subarray(he + 4);
          if (/filename=/.test(head)) file = { type: (head.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || 'application/octet-stream', content };
          else if (/name="cacheControl"/.test(head)) cache = content.toString();
          pos = next;
        }
        if (!file) return send(res, 400, { statusCode: '400', error: 'invalid', message: 'arquivo ausente' });
        data = file.content; type = file.type;
      }
      req.headers['cache-control'] = cache;
      const b = await pool.query('select * from storage.buckets where id = $1', [m[1]]);
      if (!b.rows[0]) return send(res, 404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
      if (b.rows[0].file_size_limit && data.length > b.rows[0].file_size_limit) return send(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
      if (b.rows[0].allowed_mime_types && !b.rows[0].allowed_mime_types.includes(type)) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported` });
      const r = await asUser(claims, c => c.query(`insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3) returning id`, [m[1], m[2], { mimetype: type, size: data.length }]));
      const f = path.join(STORE, m[1], m[2]); fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, data); fs.writeFileSync(f + '.meta', JSON.stringify({ type, cache: req.headers['cache-control'] ? 'max-age=' + req.headers['cache-control'] : null }));
      return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: r.rows[0].id });
    }
    if (req.method === 'DELETE' && (m = p.match(/^object\/([^/]+)$/))) {
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || '{}');
      const r = await asUser(claims, c => c.query(`delete from storage.objects where bucket_id = $1 and name = any($2) returning name`, [m[1], prefixes]));
      r.rows.forEach(x => { const f = path.join(STORE, m[1], x.name); fs.rmSync(f, { force: true }); fs.rmSync(f + '.meta', { force: true }); });
      return send(res, 200, r.rows.map(x => ({ name: x.name, bucket_id: m[1] })));
    }
  } catch (e) {
    const st = e.code === '42501' ? 403 : e.code === '23505' ? 409 : 400;
    return send(res, st, { statusCode: String(st), error: e.code === '42501' ? 'Unauthorized' : 'Error', message: e.code === '42501' ? 'new row violates row-level security policy' : e.message });
  }
  return send(res, 404, { message: 'endpoint de storage não simulado' });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, API);
  if (req.method === 'OPTIONS') return send(res, 204, null);
  try {
    if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url);
    if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url);
    if (url.pathname.startsWith('/storage/v1/')) return await storage(req, res, url);
    send(res, 404, { message: 'not found' });
  } catch (e) { send(res, e.status || 500, { message: e.message, code: e.code }); }
}).listen(API_PORT, '127.0.0.1');

/* ---------- site estático com as regras do netlify.toml ---------- */
process.env.SUPABASE_URL = DEMO ? '' : API; process.env.SUPABASE_ANON_KEY = DEMO ? '' : ANON_KEY; process.env.SITE_URL = `http://127.0.0.1:${SITE_PORT}`;
globalThis.Netlify = { env: { get: k => process.env[k] } };
const sitemapFn = (await import(path.join(ROOT, 'netlify/functions/sitemap.mjs'))).default;
const metaFn = (await import(path.join(ROOT, 'netlify/edge-functions/imovel-meta.js'))).default;
const dwvFn = (await import(path.join(ROOT, 'netlify/functions/dwv.mjs'))).default;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.svg': 'image/svg+xml' };
function serveFile(file, status = 200) {
  let body = fs.readFileSync(file);
  if (file.endsWith(path.join('assets', 'js', 'config.js')) && !DEMO) {
    body = Buffer.from(body.toString().replace(/supabaseUrl: '[^']*'/, `supabaseUrl: '${API}'`).replace(/supabaseAnonKey: '[^']*'/, `supabaseAnonKey: '${ANON_KEY}'`).replace(/prettyUrls: false/, 'prettyUrls: true').replace(/siteUrl: '[^']*'/, `siteUrl: '${process.env.SITE_URL}'`));
  } else if (file.endsWith(path.join('assets', 'js', 'config.js'))) {
    body = Buffer.from(body.toString().replace(/prettyUrls: false/, 'prettyUrls: true'));
  }
  return new Response(body, { status, headers: { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' } });
}
async function site(req) {
  const url = new URL(req.url);
  let p = decodeURIComponent(url.pathname);
  if (p === '/sitemap.xml') return sitemapFn(req);
  if (p === '/api/dwv') return dwvFn(req);
  if (p === '/admin') return new Response(null, { status: 301, headers: { Location: '/admin/' } });
  if (p.startsWith('/imovel/')) return metaFn(req, { next: async () => serveFile(path.join(PUB, 'imovel', 'index.html')) });
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('Página não encontrada', { status: 404 });
  return serveFile(f);
}
http.createServer(async (req, res) => {
  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : undefined;
    const r = await site(new Request(`http://127.0.0.1:${SITE_PORT}${req.url}`, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(SITE_PORT, '127.0.0.1', () => console.log(`Site: http://127.0.0.1:${SITE_PORT}  (${DEMO ? 'modo demonstração' : 'Supabase local em ' + API})`));
