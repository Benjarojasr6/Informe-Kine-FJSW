/* Chat flotante entre administradores (v1.7.0): un botón muy transparente que se puede mover y que abre
   un panel para dejar notas y comentarios a los demás administradores. Los mensajes viven en Firestore
   (colección "chat"); el cuerpo técnico no lo ve. Sin nube (modo local) no aparece. */
(function () {
  const K = window.K;
  const POS = 'k-chat-pos', FIRMA = 'k-chat-firma', VISTO = 'k-chat-visto', DISP = 'k-chat-disp';
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sigue */ } }
  };
  const disp = () => { let d = ls.get(DISP, ''); if (!d) { d = Math.random().toString(36).slice(2, 10); ls.set(DISP, d); } return d; };
  const S = { abierto: false, msgs: [], unsub: null, err: '', api: null, x: null, y: null, enviando: false };
  const TAM = 48;

  const api = () => (K.nube && K.nube.chatApi ? K.nube.chatApi() : null);
  const hora = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const sinLeer = () => { const v = Number(ls.get(VISTO, '0')) || 0, yo = disp(); return S.msgs.filter((m) => m.ts > v && m.disp !== yo).length; };

  function pos() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (S.x == null) { try { const p = JSON.parse(ls.get(POS, 'null')); if (p) { S.x = p.x; S.y = p.y; } } catch (e) { /* nada */ } }
    if (S.x == null) { S.x = vw - TAM - 10; S.y = vh - TAM - 150; }
    S.x = Math.max(4, Math.min(vw - TAM - 4, S.x)); S.y = Math.max(4, Math.min(vh - TAM - 4, S.y));
    return { x: S.x, y: S.y, vw, vh };
  }

  function raiz() {
    let r = document.getElementById('k-chat');
    if (!r) {
      r = document.createElement('div'); r.id = 'k-chat'; r.className = 'no-print';
      r.innerHTML = `<button type="button" class="chat-fab" aria-label="Chat de administradores" title="Chat de administradores">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/></svg><i class="chat-badge" hidden></i></button>
        <div class="chat-panel" hidden role="dialog" aria-label="Chat de administradores"></div>`;
      document.body.appendChild(r);
      enlazar(r);
    }
    return r;
  }

  function enlazar(r) {
    const fab = r.querySelector('.chat-fab');
    let d = null;
    fab.addEventListener('pointerdown', (e) => {
      const p = pos(); d = { sx: e.clientX, sy: e.clientY, x: p.x, y: p.y, mov: false, id: e.pointerId };
      try { fab.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
      fab.classList.add('arr');
    });
    fab.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.mov && Math.hypot(dx, dy) < 7) return;
      d.mov = true; S.x = d.x + dx; S.y = d.y + dy; colocar();
    });
    const fin = (e) => {
      if (!d) return;
      const mov = d.mov; d = null; fab.classList.remove('arr');
      if (mov) { ls.set(POS, JSON.stringify({ x: S.x, y: S.y })); colocar(); } else if (e.type === 'pointerup') alternar();
    };
    fab.addEventListener('pointerup', fin); fab.addEventListener('pointercancel', fin);
    fab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chat]'); if (!b) return;
      const a = b.dataset.chat;
      if (a === 'cerrar') alternar(false);
      else if (a === 'enviar') enviar();
      else if (a === 'borrar') borrar(b.dataset.id);
    });
    r.addEventListener('keydown', (e) => {
      if (e.target.matches('[data-chat-txt]') && e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 700) { e.preventDefault(); enviar(); }
    });
    r.addEventListener('change', (e) => { if (e.target.matches('[data-chat-firma]')) ls.set(FIRMA, e.target.value.trim().slice(0, 24)); });
    window.addEventListener('resize', colocar);
  }

  function colocar() {
    const r = document.getElementById('k-chat'); if (!r) return;
    const p = pos(), fab = r.querySelector('.chat-fab'), pn = r.querySelector('.chat-panel');
    fab.style.left = p.x + 'px'; fab.style.top = p.y + 'px';
    if (!S.abierto) return;
    const W = Math.min(340, p.vw - 16), arriba = p.y > p.vh / 2;
    pn.style.width = W + 'px';
    pn.style.left = Math.max(8, Math.min(p.vw - W - 8, p.x + TAM - W)) + 'px';
    if (arriba) { pn.style.bottom = (p.vh - p.y + 8) + 'px'; pn.style.top = 'auto'; pn.style.maxHeight = Math.max(220, p.y - 16) + 'px'; }
    else { pn.style.top = (p.y + TAM + 8) + 'px'; pn.style.bottom = 'auto'; pn.style.maxHeight = Math.max(220, p.vh - p.y - TAM - 16) + 'px'; }
  }

  function pintarPanel(abajo) {
    const r = document.getElementById('k-chat'); if (!r) return;
    const pn = r.querySelector('.chat-panel'); if (pn.hidden) return;
    const yo = disp(), lista = pn.querySelector('.chat-lista');
    const ta0 = pn.querySelector('[data-chat-txt]'), fi0 = pn.querySelector('[data-chat-firma]');
    const txt = ta0 ? ta0.value : '', enfoque = ta0 && document.activeElement === ta0, firma0 = fi0 ? fi0.value : ls.get(FIRMA, '');
    const antes = lista ? lista.scrollTop : 0, pegado = !lista || (lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40);
    const msgs = S.err ? `<p class="chat-aviso">${K.esc(S.err)}</p>` : S.msgs.length ? S.msgs.map((m) => `<div class="chat-msg${m.disp === yo ? ' mio' : ''}${m.pendiente ? ' pend' : ''}">
        <div class="chat-meta"><b>${K.esc(m.firma || 'Administrador')}</b> · ${hora(m.ts)}${m.pendiente ? ' · enviando…' : ''}${m.disp === yo && !m.pendiente ? `<button type="button" class="chat-x" data-chat="borrar" data-id="${K.esc(m.id)}" aria-label="Borrar mensaje">×</button>` : ''}</div>
        <div class="chat-txt">${K.esc(m.texto).replace(/\n/g, '<br>')}</div></div>`).join('') : '<p class="chat-aviso">Aún no hay mensajes. Escribe una nota o comentario para los otros administradores.</p>';
    pn.innerHTML = `<div class="chat-cab"><b>Notas entre administradores</b><button type="button" class="chat-x" data-chat="cerrar" aria-label="Cerrar">×</button></div>
      <div class="chat-lista">${msgs}</div>
      <div class="chat-pie"><input type="text" class="chat-firma" data-chat-firma maxlength="24" placeholder="Firmo como… (ej. Benja)" value="${K.esc(firma0)}" aria-label="Tu nombre">
      <div class="chat-fila"><textarea data-chat-txt rows="2" maxlength="1000" placeholder="Escribe una nota…" aria-label="Mensaje">${K.esc(txt)}</textarea><button type="button" class="btn chico" data-chat="enviar"${S.enviando ? ' disabled' : ''}>Enviar</button></div></div>`;
    const l2 = pn.querySelector('.chat-lista'); l2.scrollTop = (abajo || pegado) ? l2.scrollHeight : antes;
    if (enfoque) { const t2 = pn.querySelector('[data-chat-txt]'); t2.focus(); t2.setSelectionRange(t2.value.length, t2.value.length); }
  }

  function badge() {
    const r = document.getElementById('k-chat'); if (!r) return;
    const n = S.abierto ? 0 : sinLeer(), b = r.querySelector('.chat-badge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); r.classList.toggle('con-nuevos', n > 0);
  }

  function marcarVisto() { const mx = S.msgs.reduce((a, m) => Math.max(a, m.ts), 0); if (mx) ls.set(VISTO, String(mx)); }

  function alternar(v) {
    S.abierto = v == null ? !S.abierto : v;
    const r = raiz(), pn = r.querySelector('.chat-panel');
    pn.hidden = !S.abierto; r.classList.toggle('abierto', S.abierto);
    if (S.abierto) { marcarVisto(); colocar(); pintarPanel(true); } 
    badge();
    if (S.abierto) setTimeout(() => { const t = pn.querySelector('[data-chat-txt]'); if (t && window.innerWidth >= 700) t.focus(); }, 50);
  }

  async function enviar() {
    const r = document.getElementById('k-chat'); if (!r || S.enviando) return;
    const t = r.querySelector('[data-chat-txt]'), f = r.querySelector('[data-chat-firma]');
    const texto = (t.value || '').trim(); if (!texto) return;
    const firma = (f.value || '').trim().slice(0, 24); ls.set(FIRMA, firma);
    if (!S.api) { K.aviso && K.aviso('El chat necesita conexión con la nube', true); return; }
    S.enviando = true;
    t.value = ''; // se vacía antes: el panel se vuelve a dibujar cuando llega el mensaje
    try { await S.api.enviar({ texto, firma, disp: disp() }); S.err = ''; }
    catch (e) { const t2 = document.querySelector('#k-chat [data-chat-txt]'); if (t2 && !t2.value) t2.value = texto;  K.aviso && K.aviso(e && e.code === 'permission-denied' ? 'Faltan las reglas nuevas de Firebase para el chat' : 'No se pudo enviar el mensaje', true); }
    S.enviando = false; pintarPanel(true);
  }

  function borrar(id) {
    if (!S.api || !id) return;
    S.api.borrar(id).catch(() => { K.aviso && K.aviso('No se pudo borrar el mensaje', true); });
  }

  function alMensajes(lista) {
    S.msgs = lista; S.err = '';
    if (S.abierto) { marcarVisto(); pintarPanel(false); }
    badge();
  }
  function alError(e) {
    S.err = e && e.code === 'permission-denied' ? 'El chat necesita las reglas nuevas de Firebase (están en el archivo firestore.rules). Mientras no se publiquen, no funciona.' : 'No se pudo cargar el chat.';
    if (S.abierto) pintarPanel(false);
  }

  function iniciar() {
    if (K.rol !== 'admin' || window.K_ARTEFACTO) return;
    const a = api(); if (!a) return;
    raiz(); colocar();
    if (S.api === a) return;
    if (S.unsub) { try { S.unsub(); } catch (e) { /* nada */ } }
    S.api = a; S.unsub = a.escuchar(alMensajes, alError);
  }
  K.chat = { iniciar, alternar, _estado: S, _pos: pos };

  const r0 = K.render;
  K.render = function () { const o = r0.apply(this, arguments); try { iniciar(); } catch (e) { /* el chat nunca rompe la app */ } return o; };
})();
