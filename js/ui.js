/* Utilidades de interfaz: avisos, ventanas, formularios. */
(function () {
  const K = window.K;
  const e = K.esc;

  let tTimer;
  K.aviso = function (msg, mal) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'on' + (mal ? ' mal' : '');
    clearTimeout(tTimer);
    tTimer = setTimeout(() => (t.className = ''), mal ? 4200 : 2200);
  };

  // Aviso con un botón (ej. “Deshacer”): dura más y se puede tocar.
  K.avisoAccion = function (msg, etiqueta, fn, ms) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${e(msg)}</span><button type="button" class="toast-accion">${e(etiqueta)}</button>`;
    t.className = 'on accion';
    clearTimeout(tTimer);
    const cerrar = () => { clearTimeout(tTimer); t.className = ''; };
    t.querySelector('button').onclick = () => { cerrar(); fn(); };
    tTimer = setTimeout(() => { t.className = ''; }, ms || 6000);
  };

  /* ---------- Ventanas (hoja inferior en móvil / centrada en escritorio) ---------- */
  const pila = []; let nHoja = 0;
  /* Accesibilidad de las ventanas: foco al primer campo al abrir, el foco no se escapa (Tab), Escape cierra y el foco vuelve a quien la abrió. */
  const FOCO = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const firma = (el) => {
    if (!el || !el.getAttribute) return '';
    if (el.id) return '#' + el.id;
    const parts = ['data-acc', 'data-id', 'data-caso', 'data-jid', 'data-j', 'data-v', 'data-nav', 'data-cat', 'data-selj-abrir', 'name'].filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${String(el.getAttribute(a)).replace(/"/g, '\\"')}"]`);
    return parts.length ? el.tagName.toLowerCase() + parts.join('') : '';
  };
  const devolverFoco = (el, sig) => {
    try {
      let t = el && document.contains(el) && visible(el) ? el : null;
      if (!t && sig) { const c = document.querySelectorAll(sig); t = Array.from(c).find(visible) || null; }
      if (!t) t = document.getElementById('view');
      if (t) t.focus({ preventScroll: true });
    } catch (x) { /* nada */ }
  };
  K.modal = function (o) {
    const root = document.getElementById('modal-root');
    const alCerrarExtra = K._modalAlCerrar; K._modalAlCerrar = null; // lo deja K.enInforme (pestaña Kine) para restaurar el informe activo
    const vel = document.createElement('div'); vel.className = 'vel';
    const hoja = document.createElement('div'); hoja.className = 'hoja'; hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true'); hoja.tabIndex = -1;
    const abridor = document.activeElement && document.activeElement !== document.body ? document.activeElement : null, sigAbridor = firma(abridor);
    hoja.setAttribute('aria-labelledby', 'hoja-t' + (++nHoja));
    const botones = (o.botones || []);
    hoja.innerHTML = `<header><h2 id="hoja-t${nHoja}">${e(o.titulo || '')}</h2><button type="button" data-cerrar aria-label="Cerrar">${K.uiIco('cerrar', 20)}</button></header>
      <div class="cuerpo">${o.cuerpo || ''}</div>
      ${botones.length ? `<footer>${botones.map((b, i) => `<button type="button" class="btn ${b.cls || ''}${/peligro/.test(b.cls || '') && i === 0 && botones.length > 1 && !/sec/.test((botones[i + 1] || {}).cls || '') ? ' aparte' : ''}" data-b="${i}">${b.txt}</button>`).join('')}</footer>` : ''}`;
    root.appendChild(vel); root.appendChild(hoja);
    requestAnimationFrame(() => { vel.classList.add('on'); hoja.classList.add('on'); });
    const api = {
      el: hoja,
      cuerpo: hoja.querySelector('.cuerpo'),
      cerrar() {
        vel.classList.remove('on'); hoja.classList.remove('on');
        setTimeout(() => { vel.remove(); hoja.remove(); }, 200);
        const i = pila.indexOf(api); if (i >= 0) pila.splice(i, 1);
        o.alCerrar && o.alCerrar();
        if (alCerrarExtra) alCerrarExtra();
        if (!api._cerrada) { api._cerrada = true; if (!pila.length || i === pila.length) devolverFoco(abridor, sigAbridor); }
      }
    };
    pila.push(api);
    vel.addEventListener('click', () => api.cerrar());
    hoja.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-cerrar]')) return api.cerrar();
      const b = ev.target.closest('[data-b]');
      if (b) {
        const def = botones[Number(b.dataset.b)];
        const r = def.fn ? def.fn(api, hoja) : null;
        if (r !== false && def.cerrar !== false) api.cerrar();
      }
    });
    o.alMontar && o.alMontar(api, hoja);
    // foco al primer campo (si no hay campos, a la propia ventana para que Escape y Tab funcionen)
    if (!hoja.contains(document.activeElement)) {
      const campo = Array.from(hoja.querySelectorAll('.cuerpo input:not([type=hidden]):not([type=date]):not([disabled]):not([readonly]):not([type=checkbox]):not([type=radio]), .cuerpo select:not([disabled]), .cuerpo textarea:not([disabled]), .cuerpo .selj-btn:not([disabled])')).find(visible);
      try { (campo || hoja).focus({ preventScroll: true }); } catch (x) { /* nada */ }
    }
    return api;
  };
  document.addEventListener('keydown', (ev) => {
    if (!pila.length || document.querySelector('.kd-fondo')) return;
    const top = pila[pila.length - 1];
    if (ev.key === 'Escape') { if (ev.defaultPrevented) return; ev.preventDefault(); top.cerrar(); return; }
    if (ev.key !== 'Tab') return;
    const l = Array.from(top.el.querySelectorAll(FOCO)).filter(visible);
    if (!l.length) { ev.preventDefault(); top.el.focus(); return; }
    const a = document.activeElement, i = l.indexOf(a);
    if (ev.shiftKey) { if (i <= 0) { ev.preventDefault(); l[l.length - 1].focus(); } }
    else if (i < 0 || i === l.length - 1) { ev.preventDefault(); l[0].focus(); }
  });
  K.cerrarModales = () => pila.slice().forEach((m) => m.cerrar());
  K.hayModal = () => pila.length > 0;
  K.cerrarUltimoModal = () => { const m = pila[pila.length - 1]; if (m) m.cerrar(); };

  K.confirmar = function (msg, okTxt, fn, peligro) {
    K.modal({
      titulo: 'Confirmar',
      cuerpo: `<p>${msg}</p>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: okTxt || 'Aceptar', cls: peligro === false ? '' : 'peligro', fn: () => { fn(); } }]
    });
  };

  /* ---------- Formularios ---------- */
  K.opts = (lista, sel) => lista.map(([v, t]) => `<option value="${e(v)}"${String(v) === String(sel) ? ' selected' : ''}>${e(t)}</option>`).join('');
  K.optsJugadores = (inf, sel, conVacio) =>
    (conVacio ? '<option value="">— elegir —</option>' : '') +
    K.jugadoresCat(inf).concat(sel && !K.jugadoresCat(inf).some((j) => j.id === sel) && K.jugador(inf, sel) ? [K.jugador(inf, sel)] : []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((j) => `<option value="${j.id}"${j.id === sel ? ' selected' : ''}>${e(j.nombre)}${j.categoria ? ' · ' + e(j.categoria) : ''}</option>`).join('') +
    '<option value="__nuevo">＋ Agregar jugador nuevo…</option>';

  /* Crea un jugador con solo el nombre completo (sin salir del formulario). Devuelve el jugador o null (y avisa por qué). */
  K.crearJugadorRapido = function (nombre) {
    nombre = String(nombre || '').trim().replace(/\s+/g, ' ');
    if (!nombre) { K.aviso('Escribe el nombre', true); return null; }
    const pn = K.partirNombre(nombre); if (!pn) { K.aviso('Escribe los nombres y los dos apellidos (ej. Juan Pérez Soto)', true); return null; }
    const dup = K.buscarDuplicado(nombre, ''); if (dup) { K.aviso(`Ya existe ${dup.j.nombre}${dup.archivado ? ' (está en el archivo)' : ''}: búscalo en la lista.`, true); return null; }
    const inf = K.inf();
    const nj = K.nuevoJugador(Object.assign({ nombre, categoria: K.categoriaNueva(inf), ingreso: Math.max(new Date().getFullYear(), K.anioTexto(inf)) + '-01-01' }, pn));
    inf.jugadores.push(nj); K.guardar();
    K.aviso('Jugador agregado: completa sus datos en la pestaña Jugadores');
    return nj;
  };
  /* Compatibilidad: un <select name="jugadorId"> con la opción “Agregar jugador nuevo” (ya no se usa en la app, la reemplaza K.selJugador). */
  document.addEventListener('change', (ev) => {
    const sel = ev.target;
    if (!sel || sel.tagName !== 'SELECT' || sel.name !== 'jugadorId' || sel.value !== '__nuevo') return;
    sel.value = '';
    const lab = sel.closest('label') || sel;
    if (lab.parentNode.querySelector('[data-nuevo-j]')) return;
    lab.insertAdjacentHTML('afterend', `<div class="fila gap" data-nuevo-j style="margin:-4px 0 12px"><input type="text" class="grow" placeholder="Nombres y 2 apellidos" data-nj-nombre><button type="button" class="btn chico" data-nj-ok>Agregar</button><button type="button" class="btn ghost chico" data-nj-x>×</button></div>`);
    const caja = lab.parentNode.querySelector('[data-nuevo-j]');
    const inp = caja.querySelector('input'); inp.focus();
    const cerrar = () => caja.remove();
    caja.querySelector('[data-nj-x]').onclick = cerrar;
    const crear = () => {
      const nj = K.crearJugadorRapido(inp.value); if (!nj) return;
      document.querySelectorAll('select[name=jugadorId]').forEach((s) => {
        const o = new Option(nj.nombre + (nj.categoria ? ' · ' + nj.categoria : ''), nj.id);
        s.insertBefore(o, s.querySelector('option[value=__nuevo]'));
      });
      sel.value = nj.id; sel.dispatchEvent(new Event('change', { bubbles: true })); cerrar();
    };
    caja.querySelector('[data-nj-ok]').onclick = crear;
    inp.addEventListener('keydown', (k) => { if (k.key === 'Enter') { k.preventDefault(); crear(); } });
  });
  K.datos = function (raiz) {
    const d = {};
    raiz.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') d[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else d[el.name] = el.value;
    });
    return d;
  };
  // Control segmentado: <div class="seg" data-name="x"> con botones data-v
  K.seg = (name, opciones, sel, extra) =>
    `<div class="seg ${extra || ''}" data-seg="${name}">${opciones.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(sel) ? 'act' : ''}">${e(t)}</button>`).join('')}</div>`;
  K.segValor = (raiz, name) => {
    const b = raiz.querySelector(`[data-seg="${name}"] .act`);
    return b ? b.dataset.v : '';
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg button');
    if (!b) return;
    const seg = b.closest('.seg');
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('act', x === b));
    seg.dispatchEvent(new CustomEvent('seg', { bubbles: true, detail: b.dataset.v }));
  });
  K.contador = (id, nombre, icono, n) =>
    `<div class="contador${n ? ' activo' : ''}" data-cont="${id}"><div class="fila gap"><span class="mini-ico">${K.ico(icono)}</span><b>${e(nombre)}</b></div>
     <div class="step"><button type="button" data-paso="-1" aria-label="Menos">${K.uiIco('menos', 18)}</button><input type="number" inputmode="numeric" min="0" value="${n || 0}" data-n><button type="button" data-paso="1" aria-label="Más">${K.uiIco('mas', 18)}</button></div></div>`;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.contador [data-paso]');
    if (!b) return;
    const c = b.closest('.contador'), inp = c.querySelector('[data-n]');
    inp.value = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.paso));
    c.classList.toggle('activo', Number(inp.value) > 0);
  });
  document.addEventListener('input', (ev) => {
    const i = ev.target.closest('.contador [data-n]');
    if (i) i.closest('.contador').classList.toggle('activo', Number(i.value) > 0);
  });

  // Reduce una foto a un tamaño razonable (JPEG) antes de guardarla en el dispositivo.
  K.fotoADataURL = function (file, max, png) {
    max = max || 420;
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onerror = () => mal(r.error);
      r.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error('imagen no válida'));
        img.onload = () => {
          const s = Math.min(1, max / Math.min(img.width, img.height));
          const w = Math.round(img.width * s), h = Math.round(img.height * s);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          ok(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  };

  /* ---------- Accesibilidad: filas y tarjetas clicables se comportan como botones (teclado: Enter y Espacio) ---------- */
  const CLIC = '[data-acc]:not(button):not(a):not(input):not(select):not(textarea):not(summary):not(.mini-ico):not([role]), [data-reg]:not([role]), [data-manual]:not([role])';
  K.accesibilizar = function (raiz) {
    if (!raiz || raiz.nodeType !== 1 || raiz.classList.contains('pagina') || raiz.classList.contains('vista-wrap') || raiz.classList.contains('vista-paginas') || (raiz.closest && raiz.closest('.vista-paginas'))) return;
    const ponle = (el) => { el.setAttribute('role', 'button'); if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); };
    if (raiz.matches(CLIC)) ponle(raiz);
    raiz.querySelectorAll(CLIC).forEach(ponle);
    // botones con solo un ícono: nombre accesible desde el título (si lo tienen)
    raiz.querySelectorAll('button:not([aria-label]), [role=button]:not([aria-label])').forEach((b) => { if (!b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title); });
  };
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = ev.target;
    if (!el || !el.getAttribute || el.getAttribute('role') !== 'button' || /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName)) return;
    if (!el.matches('[data-acc], [data-reg], [data-manual]')) return;
    ev.preventDefault(); el.click();
  });
  if (window.MutationObserver) {
    new MutationObserver((muts) => { muts.forEach((mu) => mu.addedNodes.forEach((n) => { if (n.nodeType === 1) K.accesibilizar(n); })); }).observe(document.body, { childList: true, subtree: true });
    K.accesibilizar(document.body);
  }

  K.parseFecha = function (s) {
    s = String(s || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${K.pad(m[2])}-${K.pad(m[3])}`;
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${K.pad(m[2])}-${K.pad(m[1])}`;
    }
    return '';
  };
})();
