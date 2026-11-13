/* Guarita Imobiliária: CRM do painel (clientes, equipe, histórico, distribuição e painel do gestor).
   As permissões valem no banco (regras RLS em supabase/schema.sql): o corretor só recebe do servidor
   os próprios clientes; transferir, excluir e mexer na equipe só funcionam para gestores. */
(function () {
'use strict';
const G = window.Guarita, A = window.GuaritaAdmin, { $, $$, esc } = G;
if (!A) return;
const sb = A.sb;
const ETAPAS = [['novo', 'Novo contato'], ['atendimento', 'Em atendimento'], ['visita', 'Visita agendada'], ['proposta', 'Proposta'], ['fechado', 'Fechado'], ['perdido', 'Perdido']];
const ETAPA = Object.fromEntries(ETAPAS);
const ATIVAS = ['novo', 'atendimento', 'visita', 'proposta'];
const INTERESSE = { comprar: 'Comprar', alugar: 'Alugar', anunciar: 'Anunciar', investir: 'Investir' };
const TIPO = { ligacao: '📞 Ligação', whatsapp: '💬 WhatsApp', visita: '🏠 Visita', email: '✉️ E-mail', nota: '📝 Anotação', sistema: '⚙️ Sistema', site: '🌐 Site' };
let equipe = [], clientes = [], cfg = null, crmOk = true, histOk = true, cur = null, curDirty = false, filtroEtapa = '';

const hoje = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const digitos = v => { let d = String(v || '').replace(/\D/g, ''); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); return d; };
const fone = d => (d = digitos(d)).length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
const dataBR = s => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR') : '';
const dataHoraBR = s => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const nomeDe = id => { const m = equipe.find(e => e.user_id === id); return m ? (m.nome || m.email) : ''; };
const vencido = c => c.proximo_contato && c.proximo_contato < hoje() && ATIVAS.includes(c.etapa);
const semTabela = e => e && (/does not exist|schema cache|PGRST20[45]|42P01/i.test((e.message || '') + (e.code || '')));
const me = () => A.me || {};

/* ---------- abas ---------- */
const SECOES = ['s-list', 's-edit', 's-clientes', 's-cliente', 's-equipe', 's-painel'];
async function aba(nome) {
  if (!(await A.liberar())) return;
  if (curDirty && !(await A.confirmBox('Sair sem salvar o cliente?', 'As alterações deste cliente ainda não foram salvas.', 'Sair'))) return;
  curDirty = false; cur = null;
  SECOES.forEach(id => $('#' + id).hidden = true);
  $$('.adm-tabs [data-tab]').forEach(b => b.dataset.tab === nome ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (nome === 'imoveis') { $('#s-list').hidden = false; return; }
  $('#s-' + nome).hidden = false; scrollTo(0, 0);
  await carregar();
  if (nome === 'clientes') renderClientes();
  if (nome === 'equipe') renderEquipe();
  if (nome === 'painel') renderPainel();
}
$$('.adm-tabs [data-tab]').forEach(b => b.onclick = () => aba(b.dataset.tab));

/* ---------- dados ---------- */
async function carregar() {
  const [e, c, f] = await Promise.all([
    sb.from('admins').select('*').order('nome'),
    sb.from('clientes').select('*').order('updated_at', { ascending: false }),
    sb.from('crm_config').select('*').eq('id', 1).maybeSingle()
  ]);
  crmOk = !semTabela(c.error);
  $('#crm-off').hidden = crmOk;
  if (e.data) equipe = e.data;
  clientes = c.data || [];
  if (c.error && crmOk) A.toast(A.errMsg(c.error), true);
  cfg = f.error ? null : f.data; histOk = !f.error;
  atualizarContador();
}
function atualizarContador() {
  const n = me().gestor ? clientes.filter(c => !c.corretor_id).length : clientes.filter(c => c.etapa === 'novo' && c.corretor_id === me().user_id).length;
  const el = $('#n-clientes'); el.hidden = !n; el.textContent = n;
  el.title = me().gestor ? 'Contatos aguardando distribuição' : 'Clientes novos para você';
}

/* ---------- lista de clientes ---------- */
function opcoesCorretores(sel, incluirSem) {
  return (incluirSem ? '<option value="">— Sem corretor —</option>' : '') + equipe.filter(m => m.ativo !== false).map(m => `<option value="${esc(m.user_id)}"${m.user_id === sel ? ' selected' : ''}>${esc(m.nome || m.email)}${m.papel === 'gestor' ? ' (gestor)' : ''}</option>`).join('');
}
function filtrados() {
  const q = $('#cl-q').value.trim().toLowerCase(), qd = digitos(q), et = $('#cl-etapa').value || filtroEtapa, co = $('#cl-corretor').value, at = $('#cl-atrasados').checked;
  return clientes.filter(c => (!q || c.nome.toLowerCase().includes(q) || (qd.length >= 3 && c.whatsapp.includes(qd)) || (c.email || '').includes(q))
    && (!et || (et === 'ativos' ? ATIVAS.includes(c.etapa) : c.etapa === et))
    && (!co || (co === '_sem' ? !c.corretor_id : c.corretor_id === co))
    && (!at || vencido(c)));
}
function linhaCliente(c, extra = '') {
  const v = vencido(c);
  return `<li class="row cl-row" data-id="${esc(c.id)}">
    <span class="et-dot et-${c.etapa}" aria-hidden="true"></span>
    <div class="nm"><b>${esc(c.nome)}${c.origem === 'site' ? ' <span class="badge">Site</span>' : ''}</b>
     <small>${esc(fone(c.whatsapp))} · ${INTERESSE[c.interesse] || ''}${me().gestor ? ' · ' + (c.corretor_id ? esc(nomeDe(c.corretor_id)) : '<b class="warn">sem corretor</b>') : ''}${c.proximo_contato ? ` · <span class="${v ? 'warn' : ''}">retorno ${dataBR(c.proximo_contato)}${v ? ' (vencido)' : ''}</span>` : ''}</small></div>
    <span class="et-pill et-${c.etapa}">${ETAPA[c.etapa]}</span>
    <div class="acts">${extra}<a class="ib" href="https://wa.me/55${esc(c.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp" aria-label="Conversar com ${esc(c.nome)} no WhatsApp">💬</a><button type="button" class="ib" data-abrir title="Abrir ficha" aria-label="Abrir ficha de ${esc(c.nome)}">✎</button></div>
   </li>`;
}
function renderClientes() {
  const sel = $('#cl-corretor'); const v = sel.value;
  sel.innerHTML = '<option value="">Todos os corretores</option><option value="_sem">⚠ Sem corretor</option>' + opcoesCorretores(v, false); sel.value = v;
  const etSel = $('#cl-etapa'); if (etSel.options.length < 3) etSel.insertAdjacentHTML('beforeend', ETAPAS.map(([k, n]) => `<option value="${k}">${n}</option>`).join(''));
  const base = clientes;
  $('#cl-etapas').innerHTML = ETAPAS.map(([k, n]) => `<button type="button" class="et-chip et-${k}${filtroEtapa === k ? ' on' : ''}" data-et="${k}"><span>${n}</span><b>${base.filter(c => c.etapa === k).length}</b></button>`).join('');
  const l = filtrados();
  $('#cl-count').textContent = `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}${me().gestor ? ' no total' : ' com você'} · ${clientes.filter(vencido).length} retornos vencidos`;
  $('#cl-list').innerHTML = l.map(c => linhaCliente(c)).join('');
  $('#cl-empty').hidden = !!l.length || !crmOk;
}
['#cl-q', '#cl-etapa', '#cl-corretor', '#cl-atrasados'].forEach(s => $(s).addEventListener('input', () => { if (s === '#cl-etapa') filtroEtapa = ''; renderClientes(); }));
$('#cl-etapas').addEventListener('click', e => { const b = e.target.closest('[data-et]'); if (!b) return; filtroEtapa = filtroEtapa === b.dataset.et ? '' : b.dataset.et; $('#cl-etapa').value = ''; renderClientes(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-abrir]'); if (!b) return; const c = clientes.find(x => x.id === b.closest('[data-id]').dataset.id); if (c) abrirCliente(c); });
$('#b-novo-cliente').onclick = () => { if (!crmOk) return A.toast('Rode antes as atualizações 3 e 4 do banco (veja o aviso).', true); abrirCliente(null); };

/* ---------- ficha do cliente ---------- */
const FC = n => $('#f-cliente').elements[n];
function abrirCliente(c) {
  cur = c ? { ...c } : { id: null, nome: '', whatsapp: '', interesse: 'comprar', etapa: 'novo', imoveis: [], corretor_id: me().gestor ? '' : me().user_id };
  ['nome', 'email', 'interesse', 'faixa_valor', 'regiao', 'observacoes', 'etapa', 'motivo_perda', 'proximo_contato'].forEach(k => FC(k).value = cur[k] == null ? '' : cur[k]);
  FC('whatsapp').value = cur.whatsapp ? fone(cur.whatsapp) : '';
  $('#c-etapa').innerHTML = ETAPAS.map(([k, n]) => `<option value="${k}">${n}</option>`).join(''); $('#c-etapa').value = cur.etapa;
  const cs = $('#c-corretor');
  if (me().gestor) { cs.innerHTML = opcoesCorretores(cur.corretor_id, true); cs.value = cur.corretor_id || ''; cs.disabled = false; $('#c-corretor-help').textContent = c ? 'Para transferir, escolha outro corretor e salve.' : ''; }
  else { cs.innerHTML = `<option value="${esc(cur.corretor_id || '')}">${esc(nomeDe(cur.corretor_id) || me().nome || 'Você')}</option>`; cs.disabled = true; $('#c-corretor-help').textContent = 'Só o gestor transfere clientes.'; }
  $('#c-motivo-f').hidden = cur.etapa !== 'perdido';
  $('#cl-titulo').textContent = c ? c.nome : 'Novo cliente';
  $('#cl-dup').hidden = true; $('#c-err').textContent = ''; $$('#f-cliente .bad').forEach(x => x.classList.remove('bad')); $$('#f-cliente .err').forEach(x => x.textContent = '');
  $('#b-cl-wa').hidden = !c; if (c) $('#b-cl-wa').href = `https://wa.me/55${c.whatsapp}`;
  $('#b-cl-excluir').hidden = !c || !me().gestor;
  $('#cl-meta').textContent = c ? `${c.origem === 'site' ? 'Chegou pelo site' : 'Cadastrado no painel'} em ${dataHoraBR(c.created_at)}.` : '';
  $('#c-imv-q').value = ''; renderImoveis();
  $('#cl-hist-box').hidden = !c || !histOk; if (c && histOk) carregarHistorico();
  SECOES.forEach(id => $('#' + id).hidden = id !== 's-cliente'); scrollTo(0, 0); curDirty = false; FC('nome').focus();
}
function renderImoveis() {
  const q = $('#c-imv-q').value.trim().toLowerCase(), sel = new Set(cur.imoveis || []);
  const l = A.imoveis.filter(i => !q || [i.nome, i.complemento, i.cidade, i.bairro, i.codigo].join(' ').toLowerCase().includes(q));
  $('#c-imoveis').innerHTML = l.length ? l.map(i => `<label class="imv"><input type="checkbox" value="${esc(i.id)}"${sel.has(i.id) ? ' checked' : ''}><span><b>${esc(i.nome)}${i.complemento ? ' ' + esc(i.complemento) : ''}</b><small>${esc(i.codigo)} · ${esc(G.fmt.loc(i))} · ${esc(G.fmt.price(i))}</small></span></label>`).join('') : '<p class="muted">Nenhum imóvel encontrado.</p>';
}
$('#c-imv-q').addEventListener('input', renderImoveis);
$('#c-imoveis').addEventListener('change', e => { const s = new Set(cur.imoveis || []); e.target.checked ? s.add(e.target.value) : s.delete(e.target.value); cur.imoveis = [...s]; curDirty = true; });
$('#f-cliente').addEventListener('input', e => { if (e.target.closest('.hist-add') || e.target.id === 'c-imv-q') return; curDirty = true; if (e.target.id === 'c-etapa') $('#c-motivo-f').hidden = e.target.value !== 'perdido'; if (e.target.classList.contains('bad')) { e.target.classList.remove('bad'); const er = e.target.parentElement.querySelector('.err'); if (er) er.textContent = ''; } });
FC('whatsapp').addEventListener('input', () => { const i = FC('whatsapp'), d = digitos(i.value).slice(0, 11); i.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length > 10 ? 7 : 6)}-${d.slice(d.length > 10 ? 7 : 6)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; });
$('#b-cl-voltar').onclick = () => aba('clientes');

async function mostrarDono(whatsapp, email) {
  const { data } = await sb.rpc('cliente_dono', { p_whatsapp: whatsapp, p_email: email || null });
  const d = Array.isArray(data) ? data[0] : data;
  if (!d) return false;
  const box = $('#cl-dup');
  box.innerHTML = d.meu
    ? `<b>Este cliente já está na sua carteira</b> (cadastrado em ${dataBR(d.desde)}).${d.cliente_id ? ' <button type="button" class="btn line" data-dup-abrir="' + esc(d.cliente_id) + '">Abrir ficha</button>' : ''}`
    : `<b>🚫 Cadastro bloqueado: este cliente já está sendo atendido por ${esc(d.corretor_nome)}</b> desde ${dataBR(d.desde)}.<br>Para evitar atendimento em dobro, só o gestor pode transferir o cliente.${d.cliente_id ? ' <button type="button" class="btn line" data-dup-abrir="' + esc(d.cliente_id) + '">Abrir ficha</button>' : ''}`;
  box.hidden = false; box.scrollIntoView({ block: 'center' });
  return true;
}
$('#cl-dup').addEventListener('click', e => { const b = e.target.closest('[data-dup-abrir]'); if (!b) return; const c = clientes.find(x => x.id === b.dataset.dupAbrir); if (c) { curDirty = false; abrirCliente(c); } });

$('#f-cliente').addEventListener('submit', async e => {
  e.preventDefault(); if (!cur) return;
  $('#cl-dup').hidden = true; $('#c-err').textContent = '';
  const o = { nome: FC('nome').value.trim(), whatsapp: digitos(FC('whatsapp').value), email: FC('email').value.trim().toLowerCase() || null, interesse: FC('interesse').value,
    faixa_valor: FC('faixa_valor').value.trim() || null, regiao: FC('regiao').value.trim() || null, observacoes: FC('observacoes').value.trim(), etapa: FC('etapa').value,
    motivo_perda: FC('etapa').value === 'perdido' ? (FC('motivo_perda').value.trim() || null) : null, proximo_contato: FC('proximo_contato').value || null, imoveis: cur.imoveis || [] };
  const bad = (n, m) => { FC(n).classList.add('bad'); const er = FC(n).parentElement.querySelector('.err'); if (er) er.textContent = m; };
  let ok = true;
  if (o.nome.length < 2) { bad('nome', 'Informe o nome.'); ok = false; }
  if (o.whatsapp.length < 10 || o.whatsapp.length > 11) { bad('whatsapp', 'Informe o WhatsApp com DDD.'); ok = false; }
  if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) { bad('email', 'E-mail inválido.'); ok = false; }
  if (!ok) { $('#f-cliente .bad').focus(); return; }
  if (me().gestor) o.corretor_id = $('#c-corretor').value || null;
  const b = $('#b-cl-salvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    const mudouContato = !cur.id || o.whatsapp !== cur.whatsapp || (o.email || null) !== (cur.email || null);
    if (mudouContato) {
      const outro = await (async () => { const { data } = await sb.rpc('cliente_dono', { p_whatsapp: o.whatsapp, p_email: o.email }); const d = Array.isArray(data) ? data[0] : data; return d && !(cur.id && d.cliente_id === cur.id) ? d : null; })();
      if (outro) { await mostrarDono(o.whatsapp, o.email); return; }
    }
    const r = cur.id ? await sb.from('clientes').update(o).eq('id', cur.id).select().single() : await sb.from('clientes').insert(o).select().single();
    if (r.error) {
      if (/duplicate|23505|unique/i.test(r.error.message + r.error.code) && (await mostrarDono(o.whatsapp, o.email))) return;
      $('#c-err').textContent = A.errMsg(r.error); return;
    }
    A.toast(cur.id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    await carregar(); curDirty = false; abrirCliente(clientes.find(c => c.id === r.data.id) || r.data);
  } finally { b.disabled = false; b.textContent = 'Salvar cliente'; }
});
$('#b-cl-excluir').onclick = async () => {
  if (!cur || !cur.id) return;
  if (!(await A.confirmBox(`Excluir ${cur.nome}?`, 'A ficha e todo o histórico de atendimento deste cliente serão apagados. Esta ação não pode ser desfeita.'))) return;
  const { error } = await sb.from('clientes').delete().eq('id', cur.id);
  if (error) return A.toast(A.errMsg(error), true);
  A.toast('Cliente excluído.'); curDirty = false; aba('clientes');
};

/* ---------- histórico ---------- */
async function carregarHistorico() {
  const { data, error } = await sb.from('atendimentos').select('*').eq('cliente_id', cur.id).order('created_at', { ascending: false });
  if (error) { $('#cl-hist').innerHTML = `<li class="muted">${esc(A.errMsg(error))}</li>`; return; }
  $('#cl-hist').innerHTML = data.length ? data.map(h => `<li class="h h-${h.tipo}"><div class="h-top"><b>${TIPO[h.tipo] || h.tipo}</b><span>${dataHoraBR(h.created_at)}${h.autor_id ? ' · ' + esc(nomeDe(h.autor_id)) : ''}</span></div><p>${esc(h.texto).replace(/\n/g, '<br>')}</p></li>`).join('') : '<li class="muted">Nenhum registro ainda.</li>';
}
$('#b-hist').onclick = async () => {
  const t = $('#h-texto').value.trim(); if (!t) { $('#h-texto').focus(); return; }
  const b = $('#b-hist'); b.disabled = true;
  const { error } = await sb.from('atendimentos').insert({ cliente_id: cur.id, tipo: $('#h-tipo').value, texto: t });
  b.disabled = false;
  if (error) return A.toast(A.errMsg(error), true);
  $('#h-texto').value = ''; A.toast('Atendimento registrado.'); carregarHistorico();
  if (cur.etapa === 'novo') A.toast('Atendimento registrado. Lembre de mudar a etapa para "Em atendimento".');
};

/* ---------- equipe ---------- */
function renderEquipe() {
  $$('.dist-o').forEach(b => { const on = cfg && String(cfg.rodizio) === b.dataset.rodizio; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('.dist').hidden = !cfg;
  const conta = id => clientes.filter(c => c.corretor_id === id && ATIVAS.includes(c.etapa)).length;
  $('#eq-list').innerHTML = equipe.map(m => `<li class="row eq-row${m.ativo === false ? ' off' : ''}" data-uid="${esc(m.user_id)}">
    <span class="eq-av" aria-hidden="true">${esc((m.nome || m.email || '?').trim()[0].toUpperCase())}</span>
    <div class="nm"><b>${esc(m.nome || m.email)} <span class="badge${m.papel === 'gestor' ? ' g' : ''}">${m.papel === 'gestor' ? 'Gestor' : 'Corretor'}</span>${m.ativo === false ? ' <span class="badge off">Desativado</span>' : ''}</b><small>${esc(m.email)}${m.telefone ? ' · ' + esc(m.telefone) : ''} · ${conta(m.user_id)} clientes em andamento</small></div>
    <label class="sw sm" title="Participa do rodízio"><input type="checkbox" data-rod${m.recebe_rodizio ? ' checked' : ''}${m.ativo === false ? ' disabled' : ''}><span></span>Rodízio</label>
    <div class="acts"><button type="button" class="ib" data-eq-edit title="Editar" aria-label="Editar ${esc(m.nome || m.email)}">✎</button></div>
   </li>`).join('');
}
async function salvarMembro(m) {
  const { error } = await sb.rpc('equipe_salvar', { p_email: m.email, p_nome: m.nome, p_papel: m.papel, p_telefone: m.telefone || null, p_ativo: m.ativo !== false, p_recebe_rodizio: !!m.recebe_rodizio });
  if (error) { const msg = error.message || ''; throw new Error(/Não existe login|gestor|nome|Papel/.test(msg) ? msg : A.errMsg(error)); }
}
$('#eq-list').addEventListener('change', async e => {
  if (!e.target.matches('[data-rod]')) return;
  const m = equipe.find(x => x.user_id === e.target.closest('[data-uid]').dataset.uid);
  try { await salvarMembro({ ...m, recebe_rodizio: e.target.checked }); m.recebe_rodizio = e.target.checked; A.toast(e.target.checked ? `${m.nome} entrou no rodízio.` : `${m.nome} saiu do rodízio.`); }
  catch (err) { e.target.checked = !e.target.checked; A.toast(err.message, true); }
});
$('#eq-list').addEventListener('click', e => {
  if (!e.target.closest('[data-eq-edit]')) return;
  const m = equipe.find(x => x.user_id === e.target.closest('[data-uid]').dataset.uid);
  $('#eq-email').value = m.email; $('#eq-email').readOnly = true; $('#eq-nome').value = m.nome || ''; $('#eq-tel').value = m.telefone || '';
  $('#eq-papel').value = m.papel || 'corretor'; $('#eq-rodizio').checked = !!m.recebe_rodizio; $('#eq-ativo').checked = m.ativo !== false;
  $('#eq-form-t').textContent = 'Editar: ' + (m.nome || m.email); $('#f-equipe').scrollIntoView({ block: 'center' }); $('#eq-nome').focus();
});
function limparEquipe() { $('#f-equipe').reset(); $('#eq-email').readOnly = false; $('#eq-form-t').textContent = 'Adicionar pessoa à equipe'; $('#eq-err').textContent = ''; }
$('#eq-limpar').onclick = limparEquipe;
$('#eq-papel').addEventListener('change', () => { $('#eq-rodizio').checked = $('#eq-papel').value === 'corretor'; });
$('#f-equipe').addEventListener('submit', async e => {
  e.preventDefault(); $('#eq-err').textContent = '';
  const m = { email: $('#eq-email').value.trim().toLowerCase(), nome: $('#eq-nome').value.trim(), telefone: $('#eq-tel').value.trim(), papel: $('#eq-papel').value, ativo: $('#eq-ativo').checked, recebe_rodizio: $('#eq-rodizio').checked };
  if (!/^\S+@\S+\.\S+$/.test(m.email)) { $('#eq-err').textContent = 'Informe o e-mail do login.'; return; }
  if (m.nome.length < 2) { $('#eq-err').textContent = 'Informe o nome.'; return; }
  try { await salvarMembro(m); A.toast(`${m.nome} salvo na equipe.`); limparEquipe(); await carregar(); renderEquipe(); }
  catch (err) { $('#eq-err').textContent = err.message; }
});
$$('.dist-o').forEach(b => b.onclick = async () => {
  const v = b.dataset.rodizio === 'true';
  const { error } = await sb.from('crm_config').update({ rodizio: v, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return A.toast(A.errMsg(error), true);
  cfg = { ...cfg, rodizio: v }; renderEquipe();
  A.toast(v ? 'Rodízio automático ligado: os contatos do site vão direto para os corretores.' : 'Distribuição manual ligada: os contatos do site ficam em "Sem corretor" para você enviar.');
});

/* ---------- painel do gestor ---------- */
function renderPainel() {
  const at = clientes.filter(c => ATIVAS.includes(c.etapa)), sem = clientes.filter(c => !c.corretor_id && ATIVAS.includes(c.etapa)), venc = clientes.filter(vencido);
  const mes = hoje().slice(0, 7), fechMes = clientes.filter(c => c.etapa === 'fechado' && String(c.updated_at).slice(0, 7) === mes).length;
  const novos7 = clientes.filter(c => (Date.now() - new Date(c.created_at)) < 7 * 864e5).length;
  $('#pn-kpis').innerHTML = [['Em andamento', at.length], ['Novos (7 dias)', novos7], ['Sem corretor', sem.length, sem.length ? 'warn' : ''], ['Retornos vencidos', venc.length, venc.length ? 'warn' : ''], ['Fechados no mês', fechMes, 'ok'],
    ['Distribuição do site', cfg ? (cfg.rodizio ? 'Rodízio' : 'Manual') : '—']].map(([t, v, c]) => `<div class="kpi ${c || ''}"><b>${v}</b><span>${t}</span></div>`).join('');
  const pessoas = equipe.filter(m => m.ativo !== false || clientes.some(c => c.corretor_id === m.user_id));
  $('#pn-tbl').innerHTML = `<thead><tr><th>Corretor</th>${ETAPAS.map(([, n]) => `<th>${n}</th>`).join('')}<th>Vencidos</th><th>Total</th></tr></thead><tbody>` +
    pessoas.map(m => { const cs = clientes.filter(c => c.corretor_id === m.user_id); return `<tr><th>${esc(m.nome || m.email)}</th>${ETAPAS.map(([k]) => `<td>${cs.filter(c => c.etapa === k).length || ''}</td>`).join('')}<td class="${cs.filter(vencido).length ? 'warn' : ''}">${cs.filter(vencido).length || ''}</td><td><b>${cs.length}</b></td></tr>`; }).join('') + '</tbody>';
  $('#pn-sem').innerHTML = sem.map(c => linhaCliente(c, `<select class="crm-input sm" data-enviar aria-label="Enviar ${esc(c.nome)} para">${'<option value="">Enviar para…</option>' + opcoesCorretores('', false)}</select>`)).join('');
  $('#pn-sem-vazio').hidden = !!sem.length;
  $('#pn-atr').innerHTML = venc.sort((a, b) => a.proximo_contato.localeCompare(b.proximo_contato)).map(c => linhaCliente(c)).join('');
  $('#pn-atr-vazio').hidden = !!venc.length;
}
$('#pn-sem').addEventListener('change', async e => {
  if (!e.target.matches('[data-enviar]') || !e.target.value) return;
  const id = e.target.closest('[data-id]').dataset.id, para = e.target.value;
  const { error } = await sb.from('clientes').update({ corretor_id: para }).eq('id', id);
  if (error) return A.toast(A.errMsg(error), true);
  A.toast(`Cliente enviado para ${nomeDe(para)}.`); await carregar(); renderPainel();
});

/* ---------- início ---------- */
document.addEventListener('guarita:pronto', async () => { await carregar(); });
document.addEventListener('guarita:saiu', () => { equipe = []; clientes = []; cfg = null; cur = null; curDirty = false; });
})();
