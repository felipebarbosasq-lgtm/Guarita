/* Guarita Imobiliária: painel administrativo.
   Autenticação, banco e fotos pelo Supabase. Todas as permissões são verificadas no servidor
   (regras RLS em supabase/schema.sql): sem login de administrador nada pode ser gravado,
   mesmo que alguém altere este arquivo no navegador. */
(function () {
'use strict';
const G = window.Guarita, { $, $$, esc, fmt, CONFIG } = G;
const show = id => ['v-boot', 'v-nocfg', 'v-login', 'v-denied', 'v-app'].forEach(v => $('#' + v).hidden = v !== id);
if (!G.data.hasDB || !window.supabase) { show('v-nocfg'); return; }

const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const BUCKET = CONFIG.storageBucket || 'imoveis';
let user = null, all = [], ed = null, recovering = false;

/* ---------- utilidades ---------- */
let tt; function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), bad ? 6000 : 3200); }
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
function parseNum(v) {
  v = String(v == null ? '' : v).trim().replace(/[R$\s]/g, '').replace(/m²$/, '');
  if (!v) return null;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if ((v.match(/\./g) || []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  const n = Number(v); return Number.isFinite(n) ? n : NaN;
}
const money = v => v == null ? '' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const dec = v => v == null ? '' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v);
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/duplicate key.*slug/i.test(m) || /imoveis_slug_key/.test(m)) return 'Já existe outro imóvel com este endereço de página. Altere o campo "Endereço da página".';
  if (/duplicate key.*codigo/i.test(m) || /imoveis_codigo_key/.test(m)) return 'Já existe outro imóvel com este código de referência.';
  if (/oportunidade|valor_anterior/.test(m) && /column|schema cache|coluna/i.test(m)) return 'O banco ainda não tem os campos de Oportunidade. No Supabase, abra o SQL Editor e rode o arquivo supabase/atualizacao-02-oportunidade.sql (uma vez só).';
  if (/valor_anterior_maior/.test(m)) return 'O valor anterior ("de") precisa ser maior que o valor atual.';
  if (/row-level security|permission denied|42501|acesso negado/i.test(m)) return 'Sua conta não tem permissão para esta ação.';
  if (/JWT|session/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return 'Não foi possível concluir: ' + m;
}
function confirmBox(title, text, yes = 'Excluir') {
  return new Promise(res => {
    const m = $('#modal'), last = document.activeElement;
    $('#m-t').textContent = title; $('#m-p').textContent = text; $('#m-yes').textContent = yes; m.hidden = false; $('#m-no').focus();
    const done = v => { m.hidden = true; $('#m-yes').onclick = $('#m-no').onclick = null; removeEventListener('keydown', k); last && last.focus(); res(v); };
    const k = e => { if (e.key === 'Escape') done(false); };
    $('#m-yes').onclick = () => done(true); $('#m-no').onclick = () => done(false); addEventListener('keydown', k);
  });
}

/* ---------- autenticação ---------- */
async function enter(session) {
  user = session && session.user;
  if (!user) { show('v-login'); $('#f-login').hidden = recovering; $('#f-reset').hidden = !recovering; return; }
  if (recovering) { show('v-login'); $('#f-login').hidden = true; $('#f-reset').hidden = false; $('#r-pass').focus(); return; }
  const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) { $('#d-email').textContent = user.email; show('v-denied'); return; }
  $('#u-email').textContent = user.email;
  show('v-app');
  if (!all.length) await load();
}
sb.auth.onAuthStateChange((evt, session) => {
  if (evt === 'PASSWORD_RECOVERY') { recovering = true; enter(session); }
  else if (evt === 'SIGNED_OUT') { user = null; all = []; show('v-login'); $('#f-login').hidden = false; $('#f-reset').hidden = true; }
});
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#l-email').value.trim(), password = $('#l-pass').value, err = $('#l-err'), b = $('button[type=submit]', e.target);
  err.textContent = '';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) { err.textContent = 'Informe e-mail e senha.'; return; }
  b.disabled = true; b.textContent = 'Entrando…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  b.disabled = false; b.textContent = 'Entrar';
  if (error) { err.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : errMsg(error); $('#l-pass').select(); return; }
  $('#l-pass').value = ''; enter(data.session);
});
$('#l-forgot').onclick = async () => {
  const email = $('#l-email').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { $('#l-err').textContent = 'Digite seu e-mail acima e clique novamente em "Esqueci minha senha".'; $('#l-email').focus(); return; }
  await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast('Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
};
$('#f-reset').addEventListener('submit', async e => {
  e.preventDefault();
  const p = $('#r-pass').value; if (p.length < 10) { $('#r-err').textContent = 'Use pelo menos 10 caracteres.'; return; }
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) { $('#r-err').textContent = errMsg(error); return; }
  recovering = false; history.replaceState(null, '', location.pathname); toast('Senha alterada.');
  const { data } = await sb.auth.getSession(); enter(data.session);
});
$$('[data-logout]').forEach(b => b.onclick = async () => { if (ed && ed.dirty && !(await confirmBox('Sair sem salvar?', 'As alterações deste imóvel serão perdidas.', 'Sair'))) return; await discardUploads(); ed = null; await sb.auth.signOut(); });

/* ---------- lista ---------- */
const byOrder = (a, b) => (b.destaque - a.destaque) || (a.ordem - b.ordem) || String(b.created_at).localeCompare(String(a.created_at));
async function load() {
  const { data, error } = await sb.from('imoveis').select('*').order('destaque', { ascending: false }).order('ordem').order('created_at', { ascending: false });
  if (error) { toast(errMsg(error), true); return; }
  all = data.sort(byOrder); renderList();
}
function filtered() {
  const q = norm($('#q').value.trim()), f = $('#flt').value;
  return all.filter(i => (!q || norm([i.nome, i.cidade, i.bairro, i.codigo, i.complemento].join(' ')).includes(q))
    && (!f || (f === 'pub' && i.publicado) || (f === 'draft' && !i.publicado) || (f === 'dest' && i.destaque)));
}
function renderList() {
  const l = filtered(), canOrder = !$('#q').value.trim() && !$('#flt').value;
  $('#list-count').textContent = `${all.length} ${all.length === 1 ? 'imóvel cadastrado' : 'imóveis cadastrados'} · ${all.filter(i => i.publicado).length} publicados`;
  $('#list-empty').hidden = !!l.length;
  $('#order-hint').hidden = !canOrder || all.length < 2;
  $('#list').innerHTML = l.map((i, k) => {
    const f = (i.fotos || [])[0], prevSame = canOrder && l[k - 1] && l[k - 1].destaque === i.destaque, nextSame = canOrder && l[k + 1] && l[k + 1].destaque === i.destaque;
    return `<li class="row" data-id="${esc(i.id)}" ${canOrder ? 'draggable="true"' : ''}>
      <span class="hd" aria-hidden="true" title="Arraste para reordenar">${canOrder ? '⋮⋮' : ''}</span>
      ${f ? `<img class="th" src="${esc(G.src(f.th || f.md))}" alt="" loading="lazy">` : '<span class="th"></span>'}
      <div class="nm"><b>${esc(i.nome)}${i.complemento ? ' · ' + esc(i.complemento) : ''}</b><small>${esc(i.codigo)} · ${esc(fmt.loc(i))} · ${esc(fmt.price(i))}${fmt.status(i) ? ' · ' + fmt.status(i) : ''}</small></div>
      <div class="flags"><button type="button" class="pill" data-act="pub" aria-pressed="${!!i.publicado}">${i.publicado ? 'Publicado' : 'Não publicado'}</button><button type="button" class="pill gold" data-act="dest" aria-pressed="${!!i.destaque}">★ Destaque</button><button type="button" class="pill opo-p" data-act="opo" aria-pressed="${!!i.oportunidade}">Oportunidade</button></div>
      <div class="acts">
       <button type="button" class="ib" data-act="up" aria-label="Subir ${esc(i.nome)}" ${prevSame ? '' : 'disabled'}>↑</button>
       <button type="button" class="ib" data-act="down" aria-label="Descer ${esc(i.nome)}" ${nextSame ? '' : 'disabled'}>↓</button>
       ${i.publicado ? `<a class="ib" href="${esc(G.imovelUrl(i))}" target="_blank" rel="noopener" aria-label="Ver ${esc(i.nome)} no site" title="Ver no site">↗</a>` : ''}
       <button type="button" class="ib" data-act="edit" aria-label="Editar ${esc(i.nome)}" title="Editar">✎</button>
       <button type="button" class="ib danger" data-act="del" aria-label="Excluir ${esc(i.nome)}" title="Excluir">🗑</button>
      </div></li>`;
  }).join('');
}
$('#q').addEventListener('input', renderList); $('#flt').addEventListener('change', renderList);
$('#list').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('.row').dataset.id, im = all.find(i => i.id === id); if (!im) return;
  const act = b.dataset.act;
  if (act === 'edit') return openEditor(im);
  if (act === 'del') return removeImovel(im);
  if (act === 'pub' || act === 'dest' || act === 'opo') {
    const field = { pub: 'publicado', dest: 'destaque', opo: 'oportunidade' }[act], val = !im[field];
    if (field === 'publicado' && val && !(im.fotos || []).length) { toast('Para publicar, envie ao menos uma foto do imóvel.', true); return; }
    b.disabled = true;
    const { error } = await sb.from('imoveis').update({ [field]: val }).eq('id', id);
    b.disabled = false;
    if (error) return toast(errMsg(error), true);
    im[field] = val; all.sort(byOrder); renderList();
    toast({ publicado: val ? 'Imóvel publicado no site.' : 'Imóvel retirado do site.', destaque: val ? 'Imóvel em destaque.' : 'Destaque removido.', oportunidade: val ? 'Selo "Oportunidade" ativado.' : 'Selo "Oportunidade" removido.' }[field]);
  }
  if (act === 'up' || act === 'down') move(id, act === 'up' ? -1 : 1);
});
async function saveOrder() {
  all.forEach((i, k) => i.ordem = k + 1);
  const { error } = await sb.rpc('reordenar_imoveis', { ids: all.map(i => i.id) });
  if (error) { toast(errMsg(error), true); await load(); } else toast('Ordem atualizada.');
}
function move(id, d) {
  const k = all.findIndex(i => i.id === id), j = k + d;
  if (j < 0 || j >= all.length || all[j].destaque !== all[k].destaque) return;
  [all[k], all[j]] = [all[j], all[k]]; renderList();
  const btn = $(`.row[data-id="${id}"] [data-act=${d < 0 ? 'up' : 'down'}]`); (btn && !btn.disabled ? btn : $(`.row[data-id="${id}"] [data-act=edit]`)).focus();
  saveOrder();
}
/* arrastar e soltar na lista (computador) */
let dragId = null;
$('#list').addEventListener('dragstart', e => { const r = e.target.closest('.row'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
$('#list').addEventListener('dragend', () => { $$('.row').forEach(r => r.classList.remove('dragging', 'over')); dragId = null; });
$('#list').addEventListener('dragover', e => { const r = e.target.closest('.row'); if (!r || !dragId) return; e.preventDefault(); $$('.row.over').forEach(x => x !== r && x.classList.remove('over')); r.classList.add('over'); });
$('#list').addEventListener('drop', e => {
  e.preventDefault(); const r = e.target.closest('.row'); if (!r || !dragId || r.dataset.id === dragId) return;
  const from = all.findIndex(i => i.id === dragId), to = all.findIndex(i => i.id === r.dataset.id);
  if (all[from].destaque !== all[to].destaque) { toast('Imóveis em destaque ficam sempre antes dos demais. Tire ou coloque o destaque para mudar de grupo.', true); return; }
  const [it] = all.splice(from, 1); all.splice(to, 0, it); renderList(); saveOrder();
});

async function removeImovel(im) {
  if (!(await confirmBox(`Excluir "${im.nome}${im.complemento ? ' ' + im.complemento : ''}"?`, 'O anúncio sai do site e as fotos enviadas pelo painel são apagadas. Esta ação não pode ser desfeita.'))) return;
  const { error } = await sb.from('imoveis').delete().eq('id', im.id);
  if (error) return toast(errMsg(error), true);
  const files = (im.fotos || []).flatMap(f => f.files || []);
  if (files.length) await sb.storage.from(BUCKET).remove(files);
  all = all.filter(i => i.id !== im.id); renderList();
  if (ed && ed.id === im.id) { ed = null; showList(); }
  toast('Imóvel excluído.');
}

/* ---------- editor ---------- */
const F = name => $('#f-edit').elements[name];
const NUM = ['valor', 'valor_anterior', 'area_privativa', 'area_total'], INT = ['dormitorios', 'suites', 'banheiros', 'vagas'];
const TXT = ['nome', 'codigo', 'tipo', 'complemento', 'endereco', 'bairro', 'cidade', 'estado', 'descricao', 'info_complementar', 'finalidade', 'status', 'slug'];
function showList() { $('#s-edit').hidden = true; $('#s-list').hidden = false; scrollTo(0, 0); }
function openEditor(im) {
  const isNew = !im;
  im = im || { id: uid(), nome: '', tipo: 'Apartamento', finalidade: 'venda', status: 'disponivel', cidade: 'Balneário Camboriú', estado: 'SC', fotos: [], caracteristicas: [], publicado: false, destaque: false, oportunidade: false };
  ed = { id: im.id, isNew, fotos: (im.fotos || []).map(f => ({ ...f })), removed: [], uploaded: [], busy: 0, dirty: false, slugTouched: !isNew, orig: im };
  TXT.forEach(k => F(k).value = im[k] == null ? '' : im[k]);
  F('valor').value = money(im.valor); F('valor_anterior').value = money(im.valor_anterior); F('oportunidade').checked = !!im.oportunidade; F('area_privativa').value = dec(im.area_privativa); F('area_total').value = dec(im.area_total);
  INT.forEach(k => F(k).value = im[k] == null ? '' : im[k]);
  F('caracteristicas').value = (im.caracteristicas || []).join('\n');
  F('publicado').checked = !!im.publicado; F('destaque').checked = !!im.destaque;
  $$('#f-edit .bad').forEach(x => x.classList.remove('bad')); $$('#f-edit .err, #e-err, #ph-err').forEach(x => x.textContent = '');
  $('#e-title').textContent = isNew ? 'Novo imóvel' : `Editar: ${im.nome}`;
  $('#b-del').hidden = isNew;
  $('#b-view').hidden = isNew || !im.publicado; $('#b-view').href = G.imovelUrl(im);
  $('#s-list').hidden = true; $('#s-edit').hidden = false; scrollTo(0, 0);
  renderPhotos(); preview(); F('nome').focus();
}
function collect() {
  const o = {};
  TXT.forEach(k => { const v = F(k).value.trim(); o[k] = v || null; });
  o.estado = (o.estado || '').toUpperCase();
  NUM.forEach(k => o[k] = parseNum(F(k).value));
  INT.forEach(k => { const v = F(k).value.trim(); o[k] = v === '' ? null : Number(v); });
  o.caracteristicas = F('caracteristicas').value.split('\n').map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  o.descricao = o.descricao || ''; o.info_complementar = o.info_complementar || '';
  o.publicado = F('publicado').checked; o.destaque = F('destaque').checked; o.oportunidade = F('oportunidade').checked;
  o.fotos = ed.fotos.filter(f => !f.tmp).map(({ lg, md, th, w, h, alt, files }) => ({ lg, md, th, w, h, alt: alt || '', files: files || [] }));
  return o;
}
function validate(o) {
  const errs = [];
  const bad = (k, m) => { const el = F(k); el.classList.add('bad'); const er = el.closest('.f').querySelector('.err'); if (er) er.textContent = m; errs.push(el); };
  $$('#f-edit .bad').forEach(x => x.classList.remove('bad')); $$('#f-edit .f .err').forEach(x => x.textContent = '');
  if (!o.nome || o.nome.length < 2) bad('nome', 'Informe o nome do empreendimento.');
  if (!o.tipo) bad('tipo', 'Informe o tipo de imóvel.');
  if (!o.cidade || o.cidade.length < 2) bad('cidade', 'Informe a cidade.');
  if (!/^[A-Z]{2}$/.test(o.estado)) bad('estado', 'Use a sigla do estado, ex.: SC.');
  NUM.forEach(k => { if (Number.isNaN(o[k]) || (o[k] != null && o[k] < 0)) bad(k, 'Número inválido. Ex.: 1.250.000,00'); });
  if (o.area_privativa === 0) bad('area_privativa', 'Deixe em branco ou informe a área.');
  if (o.valor_anterior === 0) o.valor_anterior = null;
  if (o.valor_anterior != null && !Number.isNaN(o.valor_anterior) && (o.valor == null || o.valor_anterior <= o.valor)) bad('valor_anterior', o.valor == null ? 'Informe também o valor atual ("por").' : 'Precisa ser maior que o valor atual.');
  if (o.area_total === 0) bad('area_total', 'Deixe em branco ou informe a área.');
  INT.forEach(k => { if (o[k] != null && (!Number.isInteger(o[k]) || o[k] < 0 || o[k] > 50)) bad(k, 'Use um número inteiro entre 0 e 50.'); });
  if (o.suites != null && o.dormitorios != null && o.suites > o.dormitorios) bad('suites', 'Não pode ser maior que o número de dormitórios.');
  if (!o.slug) o.slug = slugify([o.nome, o.tipo, o.complemento].filter(Boolean).join(' '));
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.slug)) bad('slug', 'Use só letras minúsculas, números e hífens.');
  if (o.publicado && !o.fotos.length) { errs.push(F('publicado')); $('#e-err').textContent = 'Para publicar, envie ao menos uma foto do imóvel.'; }
  return errs;
}
function preview() {
  const o = collect(); if (Number.isNaN(o.valor)) o.valor = null;
  o.slug = o.slug || slugify([o.nome, o.tipo, o.complemento].filter(Boolean).join(' ')) || 'novo-imovel';
  o.nome = o.nome || 'Nome do empreendimento';
  $('#pv').innerHTML = G.card(o);
  $('#lbl-valor').textContent = (F('finalidade').value === 'locacao' ? 'Aluguel mensal (R$)' : 'Valor (R$)') + (F('valor_anterior').value.trim() ? ', "por"' : '');
}
$('#f-edit').addEventListener('input', e => {
  if (!ed) return; ed.dirty = true;
  if (e.target.name === 'slug') ed.slugTouched = !!e.target.value;
  if (!ed.slugTouched && ['nome', 'tipo', 'complemento'].includes(e.target.name)) F('slug').value = slugify([F('nome').value, F('tipo').value, F('complemento').value].filter(Boolean).join(' '));
  if (e.target.classList.contains('bad')) { e.target.classList.remove('bad'); const er = e.target.closest('.f') && e.target.closest('.f').querySelector('.err'); if (er) er.textContent = ''; }
  $('#e-err').textContent = '';
  preview();
});
['valor', 'valor_anterior', 'area_privativa', 'area_total'].forEach(k => F(k).addEventListener('blur', () => { const v = parseNum(F(k).value); if (v != null && !Number.isNaN(v)) F(k).value = k.startsWith('valor') ? money(v) : dec(v); }));
F('estado').addEventListener('input', () => F('estado').value = F('estado').value.toUpperCase());

$('#f-edit').addEventListener('submit', async e => {
  e.preventDefault(); if (!ed) return;
  if (ed.busy) { $('#e-err').textContent = 'Aguarde terminar o envio das fotos.'; return; }
  const o = collect(), errs = validate(o);
  if (errs.length) { errs[0].focus(); if (!$('#e-err').textContent) $('#e-err').textContent = 'Revise os campos destacados.'; return; }
  F('slug').value = o.slug;
  const b = $('#b-save'); b.disabled = true; b.textContent = 'Salvando…';
  let res;
  if (ed.isNew) {
    o.id = ed.id; o.ordem = (Math.max(0, ...all.map(i => i.ordem || 0))) + 1;
    if (!o.codigo) delete o.codigo; // o banco gera GUA-0002, GUA-0003…
    res = await sb.from('imoveis').insert(o).select().single();
  } else {
    if (!o.codigo) o.codigo = ed.orig.codigo;
    res = await sb.from('imoveis').update(o).eq('id', ed.id).select().single();
  }
  b.disabled = false; b.textContent = 'Salvar';
  if (res.error) { $('#e-err').textContent = errMsg(res.error); return; }
  if (ed.removed.length) await sb.storage.from(BUCKET).remove(ed.removed);
  const saved = res.data, k = all.findIndex(i => i.id === saved.id);
  if (k >= 0) all[k] = saved; else all.push(saved);
  all.sort(byOrder);
  toast(ed.isNew ? `Imóvel cadastrado (${saved.codigo}).` + (saved.publicado ? ' Já está no site.' : '') : 'Alterações salvas.' + (saved.publicado ? ' O site já mostra a nova versão.' : ''));
  ed.uploaded = []; ed.removed = []; ed.dirty = false;
  openEditor(saved);
});
$('#b-back').onclick = async () => {
  if (ed && ed.dirty && !(await confirmBox('Descartar alterações?', 'As alterações deste imóvel ainda não foram salvas.', 'Descartar'))) return;
  await discardUploads(); ed = null; renderList(); showList();
};
$('#b-new').onclick = () => openEditor(null);
$('#b-del').onclick = () => { const im = all.find(i => i.id === ed.id); if (im) removeImovel(im); };
addEventListener('beforeunload', e => { if (ed && (ed.dirty || ed.busy)) { e.preventDefault(); e.returnValue = ''; } });
async function discardUploads() { if (ed && ed.uploaded.length) { await sb.storage.from(BUCKET).remove(ed.uploaded); ed.uploaded = []; } }

/* ---------- fotos: seleção múltipla, validação, otimização, miniaturas e envio ---------- */
const MAX_MB = 30, MIN_PX = 800, SIZES = { lg: 1920, md: 960, th: 400 };
function renderPhotos() {
  const ul = $('#photos'), list = ed.fotos;
  ul.innerHTML = list.map((f, k) => `<li class="ph-i${f.fail ? ' fail' : ''}" draggable="${!f.tmp}" data-k="${k}">
     <img src="${esc(f.preview || G.src(f.th || f.md))}" alt="${esc(f.alt || 'Foto ' + (k + 1))}">
     ${k === 0 && !f.tmp ? '<span class="cap">Capa</span>' : ''}
     ${f.tmp ? `<div class="prog">${esc(f.msg || 'Otimizando…')}</div>` : ''}
     <div class="bar">
      <button type="button" class="ib" data-p="cover" aria-label="Usar foto ${k + 1} como capa" title="Usar como capa" ${k === 0 || f.tmp ? 'disabled' : ''}>★</button>
      <button type="button" class="ib" data-p="left" aria-label="Mover foto ${k + 1} para antes" ${k === 0 || f.tmp ? 'disabled' : ''}>←</button>
      <button type="button" class="ib" data-p="right" aria-label="Mover foto ${k + 1} para depois" ${k === list.length - 1 || f.tmp ? 'disabled' : ''}>→</button>
      <button type="button" class="ib danger" data-p="del" aria-label="Remover foto ${k + 1}" title="Remover" ${f.tmp && !f.fail ? 'disabled' : ''}>✕</button>
     </div></li>`).join('');
  preview();
}
$('#photos').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  const k = +b.closest('.ph-i').dataset.k, L = ed.fotos, p = b.dataset.p;
  if (p === 'cover') L.unshift(...L.splice(k, 1));
  if (p === 'left' && k > 0) [L[k - 1], L[k]] = [L[k], L[k - 1]];
  if (p === 'right' && k < L.length - 1) [L[k + 1], L[k]] = [L[k], L[k + 1]];
  if (p === 'del') { const [f] = L.splice(k, 1); if (f.files) ed.removed.push(...f.files); }
  ed.dirty = true; renderPhotos();
});
let phDrag = null;
$('#photos').addEventListener('dragstart', e => { const li = e.target.closest('.ph-i'); if (!li) return; phDrag = +li.dataset.k; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'foto'); });
$('#photos').addEventListener('dragend', () => { phDrag = null; $$('.ph-i').forEach(x => x.classList.remove('dragging', 'over')); });
$('#photos').addEventListener('dragover', e => { const li = e.target.closest('.ph-i'); if (li && phDrag !== null) { e.preventDefault(); $$('.ph-i.over').forEach(x => x.classList.remove('over')); li.classList.add('over'); } });
$('#photos').addEventListener('drop', e => {
  const li = e.target.closest('.ph-i'); if (!li || phDrag === null) return; e.preventDefault(); e.stopPropagation();
  const to = +li.dataset.k, [f] = ed.fotos.splice(phDrag, 1); ed.fotos.splice(to, 0, f); phDrag = null; ed.dirty = true; renderPhotos();
});
const drop = $('#drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.classList.add('on'); } }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('on')));
drop.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
$('#e-files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
/* reduz em etapas (melhor nitidez), sem nunca ampliar e sem cortar */
function resize(src, w0, h0, max) {
  const r = Math.min(1, max / Math.max(w0, h0)), W = Math.round(w0 * r), H = Math.round(h0 * r);
  let cur = src, cw = w0, ch = h0;
  while (cw / 2 >= W * 1.05) {
    const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, W, H);
  return c;
}
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
async function encode(c, q) {
  let b = await toBlob(c, 'image/webp', q);
  if (!b || b.type !== 'image/webp') b = await toBlob(c, 'image/jpeg', q + .04); // navegadores sem WebP
  return b;
}
async function processImage(file) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)) throw new Error('formato não aceito (use JPG, PNG, WebP ou HEIC)');
  if (file.size > MAX_MB * 1048576) throw new Error(`arquivo maior que ${MAX_MB} MB`);
  let bmp; try { bmp = await decode(file); } catch (_) { throw new Error(/hei[cf]/i.test(file.type + file.name) ? 'HEIC não é aberto por este navegador; envie em JPG' : 'não foi possível abrir a imagem'); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if (Math.max(w, h) < MIN_PX) throw new Error(`resolução baixa (${w}×${h} px; mínimo ${MIN_PX} px no lado maior)`);
  const lg = resize(bmp, w, h, SIZES.lg), md = resize(lg, lg.width, lg.height, SIZES.md), th = resize(md, md.width, md.height, SIZES.th);
  const out = { lg: await encode(lg, .84), md: await encode(md, .82), th: await encode(th, .78), w: lg.width, h: lg.height };
  if (bmp.close) bmp.close();
  return out;
}
async function upload(item, file) {
  const r = await processImage(file);
  item.msg = 'Enviando…'; renderPhotos();
  const key = `${ed.id}/${uid()}`, files = {};
  await Promise.all(['lg', 'md', 'th'].map(async v => {
    const blob = r[v], ext = blob.type === 'image/webp' ? 'webp' : 'jpg', path = `${key}-${v}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    files[v] = path; ed.uploaded.push(path);
  }));
  const url = p => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  Object.assign(item, { lg: url(files.lg), md: url(files.md), th: url(files.th), w: r.w, h: r.h, alt: '', files: Object.values(files), tmp: false, msg: '' });
}
async function addFiles(list) {
  if (!ed) return;
  const files = [...list], errs = [];
  if (ed.fotos.length + files.length > 60) { $('#ph-err').textContent = 'Cada imóvel aceita até 60 fotos.'; return; }
  $('#ph-err').textContent = '';
  const items = files.map(f => ({ tmp: true, msg: 'Na fila…', preview: URL.createObjectURL(f), name: f.name }));
  ed.fotos.push(...items); ed.busy += items.length; ed.dirty = true; renderPhotos();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++, it = items[k];
      it.msg = 'Otimizando…'; renderPhotos();
      try { await upload(it, files[k]); }
      catch (e) { it.fail = true; it.msg = 'Não enviada'; errs.push(`${files[k].name}: ${e.message ? (e.message.includes('row-level') ? 'sem permissão' : e.message) : e}`); }
      finally { URL.revokeObjectURL(it.preview); delete it.preview; ed.busy--; renderPhotos(); }
    }
  };
  await Promise.all([worker(), worker()]);
  ed.fotos = ed.fotos.filter(f => !f.fail); renderPhotos();
  if (errs.length) $('#ph-err').textContent = 'Algumas fotos não foram aceitas: ' + errs.join('; ') + '.';
  else toast(`${items.length} ${items.length === 1 ? 'foto enviada' : 'fotos enviadas'}. Clique em Salvar para gravar o imóvel.`);
}

/* ---------- importar do DWV (link de compartilhamento) ---------- */
$('#b-dwv').onclick = async () => {
  if (!ed) return;
  const texto = $('#dwv-texto').value.trim(), err = $('#dwv-err'), st = $('#dwv-status'), b = $('#b-dwv');
  err.textContent = ''; st.textContent = '';
  if (!/lp\.dwvapp\.com\.br\//i.test(texto)) { err.textContent = 'Cole o link de compartilhamento do DWV (começa com https://lp.dwvapp.com.br/).'; $('#dwv-texto').focus(); return; }
  if (F('nome').value.trim() && !(await confirmBox('Substituir os dados?', 'Os campos deste cadastro serão preenchidos com os dados do DWV. As fotos do DWV serão adicionadas às que já estão aqui.', 'Importar'))) return;
  b.disabled = true; b.textContent = 'Importando…'; st.textContent = 'Lendo o anúncio no DWV…';
  try {
    const { data: { session } } = await sb.auth.getSession();
    let r;
    try { r = await fetch('/api/dwv', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session && session.access_token) }, body: JSON.stringify({ texto }) }); }
    catch (_) { throw new Error('Sem conexão. Verifique a internet e tente de novo.'); }
    const out = await r.json().catch(() => ({ erro: r.status === 404 ? 'A importação só funciona no site publicado no Netlify.' : 'Resposta inválida do servidor.' }));
    if (!r.ok) throw new Error(out.erro || 'Não foi possível importar.');
    const im = out.imovel;
    ['nome', 'complemento', 'tipo', 'finalidade', 'status', 'endereco', 'bairro', 'cidade', 'estado', 'descricao', 'info_complementar'].forEach(k => { if (im[k] != null) F(k).value = im[k]; });
    F('valor').value = money(im.valor); F('area_privativa').value = dec(im.area_privativa); F('area_total').value = dec(im.area_total);
    INT.forEach(k => F(k).value = im[k] == null ? '' : im[k]);
    F('caracteristicas').value = (im.caracteristicas || []).join('\n');
    if (!ed.slugTouched || !F('slug').value) { ed.slugTouched = false; F('slug').value = slugify([im.nome, im.tipo, im.complemento].filter(Boolean).join(' ')); }
    ed.dirty = true; preview();
    /* fotos: baixadas direto do DWV pelo navegador e otimizadas/enviadas como num envio normal */
    const urls = (out.fotos || []).slice(0, Math.max(0, 60 - ed.fotos.length)), files = [];
    let feitos = 0, falhas = 0, next = 0;
    st.textContent = `Dados preenchidos. Baixando ${urls.length} fotos do DWV…`;
    const baixar = async () => {
      while (next < urls.length) {
        const k = next++;
        try {
          const res = await fetch(urls[k], { mode: 'cors' }); if (!res.ok) throw new Error();
          const blob = await res.blob(); files[k] = new File([blob], urls[k].split('/').pop() || `foto-${k + 1}.jpg`, { type: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg' });
        } catch (_) { falhas++; }
        st.textContent = `Dados preenchidos. Baixando fotos do DWV: ${++feitos} de ${urls.length}…`;
      }
    };
    await Promise.all([baixar(), baixar(), baixar(), baixar()]);
    const ok = files.filter(Boolean);
    if (ok.length) { st.textContent = `Otimizando e salvando ${ok.length} fotos…`; await addFiles(ok); }
    const faltou = (out.fotos || []).length - urls.length;
    st.textContent = `✓ Importado do DWV: ${ok.length} ${ok.length === 1 ? 'foto' : 'fotos'}${falhas ? ` (${falhas} não baixaram)` : ''}${faltou > 0 ? ` (${faltou} ficaram de fora: limite de 60 por imóvel)` : ''}. Confira os dados${im.bairro ? '' : ', preencha o bairro'}, escolha a capa e toque em Salvar. O imóvel só aparece no site quando você ligar "Publicado no site".`;
    if (!im.bairro) { F('bairro').classList.add('bad'); }
  } catch (e) {
    err.textContent = e.message; st.textContent = '';
  } finally { b.disabled = false; b.textContent = 'Importar do DWV'; }
};

/* ---------- início ---------- */
(async () => {
  if (/type=recovery/.test(location.hash)) recovering = true;
  const { data } = await sb.auth.getSession();
  enter(data.session);
})();
})();
