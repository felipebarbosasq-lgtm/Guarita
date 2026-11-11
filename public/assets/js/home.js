/* Guarita Imobiliária: página inicial (abertura, carrossel de imóveis, atendimento). */
(function () {
'use strict';
const G = window.Guarita, { $, $$, reduce, wa, CONFIG } = G;
G.chrome();

/* ===== ABERTURA: até 4 paisagens, ~6 s cada, fade suave com zoom discreto e loop infinito ===== */
(() => {
  const sl = $$('.slide'), ds = $$('#dots button');
  if (sl.length < 2) return;
  const SHOW = 6000;
  let i = 0, tm = null, vis = true, busy = false;
  const img = k => $('img', sl[k]);
  const ready = k => { const m = img(k); return m.complete && m.naturalWidth ? (m.decode ? m.decode().catch(() => {}) : Promise.resolve()) : new Promise(r => { m.addEventListener('load', r, { once: true }); m.addEventListener('error', r, { once: true }); }); };
  async function go(n) {
    n = (n + sl.length) % sl.length;
    if (n === i || busy) return;
    busy = true;
    await ready(n); // nunca troca para uma foto que ainda não carregou (sem tela preta)
    const old = sl[i];
    sl.forEach(s => s !== old && s.classList.remove('prev'));
    old.classList.remove('on'); old.classList.add('prev');
    sl[n].classList.add('on');
    ds[i].classList.remove('on'); ds[i].setAttribute('aria-pressed', 'false');
    ds[n].classList.add('on'); ds[n].setAttribute('aria-pressed', 'true');
    i = n;
    setTimeout(() => { old.classList.remove('prev'); busy = false; }, reduce ? 50 : 1700);
  }
  function auto() { clearTimeout(tm); if (!reduce && vis && !document.hidden) tm = setTimeout(async () => { await go(i + 1); auto(); }, SHOW); }
  ds.forEach((d, k) => d.onclick = async () => { await go(k); auto(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { vis = e[0].isIntersecting; auto(); }).observe($('.hero'));
  document.addEventListener('visibilitychange', auto);
  // o relógio só começa depois que a primeira foto apareceu
  const first = img(0);
  if (first.complete) auto(); else first.addEventListener('load', auto, { once: true });
})();

/* ===== CARROSSEL DE IMÓVEIS =====
   Movimento contínuo da esquerda para a direita, loop infinito sem saltos (cópias da lista),
   arrastar com o dedo/mouse, rolagem horizontal do touchpad, setas e teclado. Interações pausam
   o movimento, que volta suavemente alguns segundos depois. Com "movimento reduzido" não anda sozinho. */
function Carousel(root) {
  const vp = $('.car-vp', root), track = $('.car-track', root), pp = $('.car-pp', root);
  const SPEED = () => innerWidth < 641 ? 26 : 36; // px por segundo
  let list = [], count = 0, setW = 0, step = 0, x = 0, v = 0, isStatic = true;
  let hold = 0, hover = false, focus = false, manual = false, inView = true, drag = null, tween = null, fling = 0, raf = 0, last = 0, moved = false;
  const now = () => performance.now();
  const pauseFor = ms => { hold = Math.max(hold, now() + ms); };

  function per() { return parseFloat(getComputedStyle(root).getPropertyValue('--per')) || 3; }
  function render(items) {
    if (items) list = items;
    count = list.length;
    const keep = setW ? x / setW : null;
    if (!count) { root.classList.add('static'); track.innerHTML = ''; return; }
    const one = list.map(im => G.card(im)).join('');
    track.innerHTML = one; track.style.transform = '';
    isStatic = count <= Math.floor(per());
    root.classList.toggle('static', isStatic);
    vp.setAttribute('tabindex', isStatic ? '-1' : '0');
    if (isStatic) { cancelAnimationFrame(raf); raf = 0; return; }
    const first = track.children[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    step = first + gap; setW = step * count;
    const sets = 3 + Math.ceil(vp.clientWidth / setW);
    let html = '';
    for (let s = 0; s < sets; s++) html += s === 1 ? one : one.replace(/<article class="prop"/g, '<article class="prop" aria-hidden="true"').replace(/<a class="btn"/g, '<a class="btn" tabindex="-1"'); // cópias: clicáveis, fora do Tab e do leitor de tela
    track.innerHTML = html;
    x = keep !== null ? keep * setW : -setW; norm(); paint();
    if (!raf) { last = now(); raf = requestAnimationFrame(loop); }
  }
  function norm() { while (x > 0) x -= setW; while (x <= -2 * setW) x += setW; }
  function paint() { track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; }
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (tween) {
      const p = Math.min(1, (t - tween.t0) / tween.d), e = 1 - Math.pow(1 - p, 3);
      x = tween.from + (tween.to - tween.from) * e; if (p >= 1) tween = null;
    } else if (!drag) {
      if (Math.abs(fling) > 5) { x += fling * dt; fling *= Math.pow(.004, dt); }
      else fling = 0;
      const running = !reduce && !manual && !hover && !focus && inView && !document.hidden && t > hold;
      v += ((running ? SPEED() : 0) - v) * Math.min(1, dt * 1.6); // acelera e desacelera suavemente
      x += v * dt;
    }
    norm(); paint();
    raf = requestAnimationFrame(loop);
  }
  function move(dir) {
    if (isStatic) return;
    pauseFor(5000); v = 0; fling = 0;
    const base = tween ? tween.to : x;
    const to = Math.round(base / step) * step - dir * step;
    tween = { from: x, to, t0: now(), d: reduce ? 1 : 650 };
  }
  $('.car-prev', root).onclick = () => move(-1);
  $('.car-next', root).onclick = () => move(1);
  vp.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); move(1); } });
  pp.onclick = () => { manual = !manual; pp.setAttribute('aria-pressed', manual); $('span', pp).textContent = manual ? 'Retomar' : 'Pausar'; pp.querySelector('svg').innerHTML = manual ? '<path d="M3 1.5v9l7.5-4.5z"/>' : '<path d="M3 1.5h2v9H3zM7 1.5h2v9H7z"/>'; };
  if (reduce) pp.hidden = true;

  /* arrastar (dedo, caneta ou mouse) */
  vp.addEventListener('pointerdown', e => {
    if (isStatic || e.button > 0) return;
    tween = null; fling = 0; moved = false;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: x, lx: e.clientX, lt: now(), vel: 0, on: false, type: e.pointerType };
  });
  vp.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dx) < 6) return;
      if (drag.type === 'touch' && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // rolagem vertical da página
      drag.on = true; moved = true; vp.classList.add('drag'); try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const t = now(), d = t - drag.lt;
    if (d > 0) drag.vel = .8 * ((e.clientX - drag.lx) / d * 1000) + .2 * drag.vel;
    drag.lx = e.clientX; drag.lt = t;
    x = drag.start + dx; v = 0; pauseFor(4000);
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.on) { fling = Math.max(-2500, Math.min(2500, drag.vel)); pauseFor(3500); }
    drag = null; vp.classList.remove('drag');
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end); vp.addEventListener('lostpointercapture', end);
  vp.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  vp.addEventListener('dragstart', e => e.preventDefault());
  /* touchpad / roda horizontal */
  vp.addEventListener('wheel', e => {
    if (isStatic || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); tween = null; fling = 0; v = 0; x -= e.deltaX; pauseFor(3500);
  }, { passive: false });
  /* pausa enquanto o mouse está sobre os cartões ou o foco está no carrossel */
  vp.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
  vp.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = false; pauseFor(800); } });
  root.addEventListener('focusin', e => {
    if (!e.target.matches(':focus-visible')) return; // clique do mouse não pausa; só a navegação pelo teclado
    focus = true;
    const c = e.target.closest('.prop');
    if (!c || isStatic) return;
    vp.scrollLeft = 0; // o navegador não deve rolar a área oculta
    const l = c.offsetLeft, w = c.offsetWidth;
    if (l + x < 0 || l + w + x > vp.clientWidth) { tween = null; x = -l + (vp.clientWidth - w) / 2; norm(); paint(); }
  });
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { focus = false; pauseFor(1500); } });
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { inView = e[0].isIntersecting; }).observe(vp);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => render(), 150); });
  return { render };
}

(async () => {
  const root = $('#car'), msg = $('#car-msg');
  const car = Carousel(root);
  try {
    const list = await G.data.list();
    if (!list.length) { msg.hidden = false; root.hidden = true; return; }
    car.render(list);
  } catch (err) {
    console.warn(err);
    msg.hidden = false; root.hidden = true;
  }
})();

G.reveal();

/* ===== ABAS DE ATENDIMENTO: Comprar | Alugar | Anunciar meu imóvel ===== */
const tabs = $$('[role=tab]');
function selectTab(t, focus) { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }); if (focus) t.focus(); }
tabs.forEach((t, k) => {
  t.onclick = () => selectTab(t);
  t.onkeydown = e => {
    const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (m) { e.preventDefault(); selectTab(tabs[(k + m + tabs.length) % tabs.length], true); }
    if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); } if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
  };
});

/* cartões de região: abrem o atendimento de compra já com a região escolhida */
$$('[data-regiao]').forEach(a => a.addEventListener('click', () => {
  selectTab($('#tab-comprar')); $('#c-reg').value = a.dataset.regiao;
  setTimeout(() => $('#c-nome').focus({ preventScroll: true }), reduce ? 0 : 700);
}));

/* ===== FORMULÁRIOS: validação e envio pelo WhatsApp (sem e-mail do visitante) ===== */
$$('input[type=tel]').forEach(i => i.addEventListener('input', () => {
  const d = i.value.replace(/\D/g, '').slice(0, 11);
  i.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length > 10 ? 7 : 6)}-${d.slice(d.length > 10 ? 7 : 6)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
}));
function check(form) {
  let ok = true, first = null;
  $$('.bad', form).forEach(x => x.classList.remove('bad')); $$('.err', form).forEach(x => x.textContent = '');
  const fail = (el, msg, err) => { ok = false; el.classList.add('bad'); (err || el.nextElementSibling).textContent = msg; first = first || el; };
  const nm = $('[name=Nome]', form), tel = $('[type=tel]', form);
  if (nm.value.trim().length < 2) fail(nm, 'Informe seu nome.');
  const dig = tel.value.replace(/\D/g, '');
  if (dig.length < 10 || dig.length > 11) fail(tel, 'Informe um WhatsApp com DDD.');
  $$('select[required]', form).forEach(s => { if (!s.value) fail(s, 'Selecione uma opção.'); });
  $$('fieldset[data-required]', form).forEach(fs => { if (!$('input:checked', fs)) fail($('input', fs), 'Selecione uma opção.', $('.err', fs)); });
  const c = $('[name=consent]', form); if (!c.checked) fail(c, 'Autorize o contato para enviar.', $('[data-for=consent]', form));
  if (first) first.focus(); return ok;
}
$$('form.lead').forEach(form => {
  form.addEventListener('input', e => {
    const el = e.target; if (!el.classList.contains('bad') && !(el.type === 'radio' && $('.bad', el.closest('fieldset') || form))) return;
    if (el.type === 'radio') { const fs = el.closest('fieldset'); $$('.bad', fs).forEach(b => b.classList.remove('bad')); const er = $('.err', fs); if (er) er.textContent = ''; return; }
    el.classList.remove('bad'); const er = el.type === 'checkbox' ? $('[data-for=consent]', form) : el.nextElementSibling; if (er) er.textContent = '';
  });
  form.addEventListener('change', () => form.dispatchEvent(new Event('input', { bubbles: true })));
  form.addEventListener('submit', e => {
    e.preventDefault(); if (!check(form)) return;
    if (form._honey.value) return; // robô
    const tipo = form.dataset.tipo, dataF = {}, seen = new Set();
    $$('input[name],select[name]', form).forEach(el => {
      const n = el.name; if (n === 'consent' || n === '_honey' || seen.has(n)) return;
      if (el.type === 'radio') { const c = $(`[name="${n}"]:checked`, form); seen.add(n); if (c) dataF[n] = c.value; return; }
      if (el.value.trim()) dataF[n] = el.value.trim();
    });
    const txt = `Olá! Vim pelo site da Guarita Imobiliária.\n\nInteresse: ${tipo}\n` + Object.entries(dataF).map(([k, v]) => `${k}: ${v}`).join('\n');
    const link = wa(txt); window.open(link, '_blank', 'noopener'); // abre a conversa já preenchida
    if (CONFIG.leadCopyEndpoint) {
      try {
        fetch(CONFIG.leadCopyEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ _subject: `Novo contato pelo site: ${tipo}`, _template: 'table', _captcha: 'false', Interesse: tipo, ...dataF }) }).catch(() => {});
      } catch (_) {}
    }
    const panel = form.closest('.panel'), done = $('.done', panel);
    $('[data-done-wa]', done).href = link; form.hidden = true; done.hidden = false; done.setAttribute('tabindex', '-1'); done.focus({ preventScroll: true });
  });
});
$$('[data-reset]').forEach(b => b.onclick = () => { const p = b.closest('.panel'), f = $('form', p); f.reset(); f.hidden = false; $('.done', p).hidden = true; $('[name=Nome]', f).focus(); });
})();
