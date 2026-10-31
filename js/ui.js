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

  /* ---------- Ventanas (hoja inferior en móvil / centrada en escritorio) ---------- */
  const pila = [];
  K.modal = function (o) {
    const root = document.getElementById('modal-root');
    const alCerrarExtra = K._modalAlCerrar; K._modalAlCerrar = null; // lo deja K.enInforme (pestaña Kine) para restaurar el informe activo
    const vel = document.createElement('div'); vel.className = 'vel';
    const hoja = document.createElement('div'); hoja.className = 'hoja'; hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true');
    const botones = (o.botones || []);
    hoja.innerHTML = `<header><h2>${e(o.titulo || '')}</h2><button type="button" data-cerrar aria-label="Cerrar">${K.uiIco('cerrar', 20)}</button></header>
      <div class="cuerpo">${o.cuerpo || ''}</div>
      ${botones.length ? `<footer>${botones.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-b="${i}">${b.txt}</button>`).join('')}</footer>` : ''}`;
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
    return api;
  };
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
    K.jugadoresCat(inf).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((j) => `<option value="${j.id}"${j.id === sel ? ' selected' : ''}>${e(j.nombre)}${j.categoria ? ' · ' + e(j.categoria) : ''}</option>`).join('') +
    '<option value="__nuevo">＋ Agregar jugador nuevo…</option>';

  /* Desde cualquier lista de jugadores se puede agregar uno nuevo sin salir del formulario. */
  document.addEventListener('change', (ev) => {
    const sel = ev.target;
    if (!sel || sel.tagName !== 'SELECT' || sel.name !== 'jugadorId' || sel.value !== '__nuevo') return;
    sel.value = '';
    const lab = sel.closest('label') || sel;
    if (lab.parentNode.querySelector('[data-nuevo-j]')) return;
    lab.insertAdjacentHTML('afterend', `<div class="fila gap" data-nuevo-j style="margin:-4px 0 12px"><input type="text" class="grow" placeholder="Nombre del jugador nuevo" data-nj-nombre><button type="button" class="btn chico" data-nj-ok>Agregar</button><button type="button" class="btn ghost chico" data-nj-x>×</button></div>`);
    const caja = lab.parentNode.querySelector('[data-nuevo-j]');
    const inp = caja.querySelector('input'); inp.focus();
    const cerrar = () => caja.remove();
    caja.querySelector('[data-nj-x]').onclick = cerrar;
    const crear = () => {
      const nombre = inp.value.trim(); if (!nombre) { K.aviso('Escribe el nombre', true); return; }
      const inf = K.inf();
      const nj = { id: K.uid(), nombre, categoria: K.categoriaNueva(inf), nacimiento: '', posicion: '', comentarios: '', extras: {}, activo: true };
      inf.jugadores.push(nj); K.guardar();
      document.querySelectorAll('select[name=jugadorId]').forEach((s) => {
        const o = new Option(nj.nombre + (nj.categoria ? ' · ' + nj.categoria : ''), nj.id);
        s.insertBefore(o, s.querySelector('option[value=__nuevo]'));
      });
      sel.value = nj.id; sel.dispatchEvent(new Event('change', { bubbles: true })); cerrar();
      K.aviso('Jugador agregado: completa sus datos en la pestaña Jugadores');
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
