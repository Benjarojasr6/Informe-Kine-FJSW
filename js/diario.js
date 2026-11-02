/* Uso diario (v1.6, fase 3A): pantalla Hoy, selector de jugador con buscador, registro de varios jugadores,
   intervenciones más usadas, plantillas, repetir la última atención y “Deshacer”.
   Todo se calcula desde los registros que ya existen; lo único nuevo que se guarda son las plantillas (inf.plantillas)
   y, solo en este dispositivo, la última categoría, los jugadores recientes y el último grupo. */
(function () {
  const K = window.K;
  const e = K.esc;
  const { dif, suma } = K.kineFechas;
  const fc = (iso) => K.fechaCorta(iso);
  const ini = (n) => (n || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  /* ---------- Memoria de este dispositivo (nunca se sube a la nube) ---------- */
  const ls = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (x) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) { /* sin almacenamiento: no pasa nada */ } }
  };
  const LS_CAT = 'kine_ult_cat', LS_REC = 'kine_recientes', LS_GRUPO = 'kine_ult_grupo';
  K.recordarCat = (c) => ls.set(LS_CAT, Number(c));
  K.ultimaCat = () => { const c = Number(ls.get(LS_CAT, 0)); return c && K.grupoDe(c) ? c : 0; };
  const soloId = (v) => String(v || '').split('|').pop();
  K.recientes = () => { const l = ls.get(LS_REC, []); return Array.isArray(l) ? l.filter((x) => typeof x === 'string') : []; };
  K.recienteJugador = (id) => { id = soloId(id); if (!id) return; ls.set(LS_REC, [id].concat(K.recientes().filter((x) => x !== id)).slice(0, 10)); };
  K.ultimoGrupo = (ids) => { if (Array.isArray(ids)) ls.set(LS_GRUPO, ids.slice(0, 200)); const l = ls.get(LS_GRUPO, []); return Array.isArray(l) ? l.filter((x) => typeof x === 'string') : []; };

  /* Al abrir la app se va directo a “Hoy” de la última categoría usada en este dispositivo (una sola vez por apertura). */
  let arrancado = false;
  const render0 = K.render;
  K.render = function () {
    if (!arrancado && K.state && K.state.informes && K.state.informes.length) {
      arrancado = true;
      try {
        if (K.puedeEditar() && !K.ui.cat) {
          const c = K.ultimaCat();
          if (c) { K.state.activo = K.informeGrupo(K.grupoDe(c)).id; K.ui.alcance = 'comb'; K.ui.cat = c; K.ui.pantalla = 'hoy'; K.ui.jugadorId = null; }
        }
      } catch (x) { /* si algo falla se queda en el inicio */ }
    }
    return render0.apply(this, arguments);
  };

  /* ======================= DESHACER ======================= */
  // Guarda el estado de los registros antes de una acción y, si se toca “Deshacer”, devuelve exactamente lo que se quitó
  // (mismo id, misma posición) y los campos que cambiaron. No toca nada más: lo que se haya registrado después se conserva.
  const CLAVES = ['casos', 'atenciones', 'eventos', 'asistencias', 'partidos', 'seguros', 'segEventos', 'plantillas', 'torneos'];
  function tomar() {
    const t = [];
    K.state.informes.forEach((inf) => CLAVES.forEach((k) => {
      const a = inf[k]; if (!Array.isArray(a)) return;
      t.push({ inf, k, ids: a.map((x) => x.id), js: new Map(a.map((x) => [x.id, JSON.stringify(x)])) });
    }));
    return t;
  }
  function comparar(t) {
    const quitados = [], cambiados = [], nuevos = [];
    t.forEach(({ inf, k, ids, js }) => {
      const ahora = Array.isArray(inf[k]) ? inf[k] : [], por = new Map(ahora.map((x) => [x.id, x]));
      ahora.forEach((x) => { if (!js.has(x.id)) nuevos.push({ inf, k, id: x.id }); });
      ids.forEach((id, i) => {
        const o = por.get(id);
        if (!o) quitados.push({ inf, k, id, i, ids, json: js.get(id) });
        else if (JSON.stringify(o) !== js.get(id)) cambiados.push({ o, json: js.get(id) });
      });
    });
    return { quitados, cambiados, nuevos };
  }
  function restaurar(d, conNuevos) {
    if (conNuevos) d.nuevos.forEach(({ inf, k, id }) => { if (Array.isArray(inf[k])) inf[k] = inf[k].filter((x) => x.id !== id); }); // registros que creó la acción (solo si se pide)
    d.cambiados.forEach(({ o, json }) => { const v = JSON.parse(json); Object.keys(o).forEach((k) => { delete o[k]; }); Object.assign(o, v); });
    d.quitados.slice().sort((a, b) => a.i - b.i).forEach((q) => {
      if (!Array.isArray(q.inf[q.k])) q.inf[q.k] = [];
      const arr = q.inf[q.k]; if (arr.some((x) => x.id === q.id)) return;
      let pos = 0;
      for (let p = q.i - 1; p >= 0; p--) { const at = arr.findIndex((x) => x.id === q.ids[p]); if (at >= 0) { pos = at + 1; break; } }
      arr.splice(pos, 0, JSON.parse(q.json));
    });
  }
  // fn() hace el cambio (quitar un registro, etc.). Después se guarda, se redibuja y aparece el aviso con “Deshacer” por 6 segundos.
  K.conDeshacer = function (msg, fn, opts) {
    opts = opts || {};
    const t = tomar();
    fn();
    const d = comparar(t);
    K.guardar(); K.render();
    const nn = opts.quitarNuevos ? d.nuevos.length : 0;
    if (!d.quitados.length && !d.cambiados.length && !nn) { K.aviso(msg); return d; }
    K.avisoAccion(msg, 'Deshacer', () => { restaurar(d, opts.quitarNuevos); K.guardar(); K.render(); K.aviso(opts.restaurado || 'Restaurado'); }, 6000);
    return d;
  };

  /* ======================= SELECTOR DE JUGADOR CON BUSCADOR ======================= */
  const lesSet = () => {
    const s = new Set();
    K.state.informes.forEach((inf) => (inf.casos || []).forEach((c) => { if (c.tipo === 'lesion' && !c.alta) s.add(c.jugadorId); }));
    return s;
  };
  // Convierte jugadores en filas del selector. arr = [jugador] o [{ j, value, sub }].
  K.itemsSelJ = (arr) => {
    const s = lesSet();
    return arr.map((x) => {
      const j = x.j || x, vig = K.inscrito(j) && j.activo !== false;
      return { value: x.value || j.id, jid: j.id, nombre: j.nombre, sub: x.sub != null ? x.sub : [j.categoria, j.posicion].filter(Boolean).join(' · '), les: vig && s.has(j.id) };
    });
  };
  const itemsDe = (inf, sel) => {
    const base = K.jugadoresCat(inf), extra = sel && !base.some((j) => j.id === sel) ? K.jugador(inf, sel) : null;
    return K.itemsSelJ(base.concat(extra ? [extra] : []));
  };
  const REG = new Map();
  let nReg = 0;
  const interior = (it, cfg) => (it
    ? `<span class="avatar">${e(ini(it.nombre))}</span><span class="selj-nom"><b>${e(it.nombre)}</b>${it.sub ? `<small>${e(it.sub)}</small>` : ''}</span>${it.les ? '<i class="chip g-grave etq" data-lesionado>Lesionado</i>' : ''}`
    : `<span class="selj-ph">${e(cfg.vacio || 'Elegir jugador…')}</span>`) + K.uiIco('abajo', 18);
  /* name: nombre del campo (queda en un <input type="hidden"> con ese name: los formularios lo leen igual que antes).
     o: { inf, sel, lista (filas ya armadas), nuevo (permite agregar un jugador), vacio (texto de “ninguno”/“todos”), disabled, attrs, titulo } */
  K.selJugador = function (name, o) {
    o = o || {};
    const inf = o.inf || K.inf(), lista = o.lista || itemsDe(inf, o.sel), id = 'sj' + (++nReg);
    const cfg = { lista, nuevo: !!o.nuevo, vacio: o.vacio || '', titulo: o.titulo || 'Elegir jugador', reciente: o.reciente !== false, principal: Array.isArray(o.principal) ? o.principal.slice() : null, principalTxt: o.principalTxt || 'principales' };
    REG.set(id, cfg); if (REG.size > 80) REG.delete(REG.keys().next().value);
    const it = lista.find((x) => x.value === (o.sel || ''));
    return `<div class="selj" data-selj="${id}"><input type="hidden" name="${e(name)}" value="${e(o.sel || '')}" ${o.attrs || ''}>
      <button type="button" class="selj-btn" data-selj-abrir aria-haspopup="dialog" aria-label="${e(o.etiqueta || 'Elegir jugador')}"${o.disabled ? ' disabled' : ''}>${interior(it, cfg)}</button></div>`;
  };
  // Cambia el valor desde el código (y avisa a quien escuche el cambio, como un <select>).
  K.selJugadorSet = function (cont, valor, aviso) {
    const cfg = REG.get(cont.dataset.selj); if (!cfg) return;
    const hid = cont.querySelector('input[type=hidden]'), it = cfg.lista.find((x) => x.value === valor);
    hid.value = valor || '';
    cont.querySelector('.selj-btn').innerHTML = interior(it, cfg);
    if (it && it.jid && cfg.reciente) K.recienteJugador(it.jid);
    if (aviso !== false) hid.dispatchEvent(new Event('change', { bubbles: true }));
  };
  K.selJugadorAbrir = function (cont) {
    const cfg = REG.get(cont.dataset.selj); if (!cfg) return null;
    const hid = cont.querySelector('input[type=hidden]');
    let q = '', soloLes = false, creando = false;
    const norm = (it) => it._n || (it._n = K.norm(it.nombre + ' ' + (it.sub || '')));
    const ord = cfg.lista.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    // Con una lista “principal” (por ejemplo los citados de un partido) se muestran primero esos y un toque abre toda la categoría.
    const pri = cfg.principal ? new Set(cfg.principal.concat(hid.value ? [soloId(hid.value)] : [])) : null;
    const hayPri = !!pri && ord.some((x) => pri.has(x.jid)) && ord.some((x) => !pri.has(x.jid));
    let verTodos = !hayPri;
    const base = () => (verTodos ? ord : ord.filter((x) => pri.has(x.jid)));
    const nLes = cfg.lista.filter((x) => x.les).length;
    const recs = K.recientes().map((jid) => cfg.lista.find((x) => x.jid === jid)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 5);
    const fila = (x) => `<button type="button" class="selj-fila${x.value === hid.value ? ' on' : ''}" data-v="${e(x.value)}"><span class="avatar">${e(ini(x.nombre))}</span><span class="txt"><b>${e(x.nombre)}</b>${x.sub ? `<small>${e(x.sub)}</small>` : ''}</span>${x.les ? '<i class="chip g-grave etq" data-lesionado>Lesionado</i>' : ''}</button>`;
    return K.modal({
      titulo: cfg.titulo,
      cuerpo: `<div class="selj-top">
          <input type="search" class="selj-q" data-sj-q placeholder="Buscar por nombre…" autocomplete="off" aria-label="Buscar jugador">
          ${hayPri ? `<div class="selj-chips"><button type="button" class="th-chip" data-sj-todos aria-pressed="false">Ver toda la categoría <small>${ord.length}</small></button><span class="suave" data-sj-pri>Mostrando solo ${e(cfg.principalTxt)}</span></div>` : ''}
          ${recs.length ? `<div class="selj-chips" data-sj-rec><span class="selj-et">Recientes</span>${recs.map((x) => `<button type="button" class="selj-chip" data-v="${e(x.value)}">${e(x.nombre)}</button>`).join('')}</div>` : ''}
          ${nLes ? `<div class="selj-chips"><button type="button" class="th-chip" data-sj-les aria-pressed="false">Lesionados <small>${nLes}</small></button></div>` : ''}
        </div>
        <div data-sj-lista class="selj-lista"></div>
        ${cfg.nuevo ? '<div class="selj-nuevo" data-sj-nuevo><button type="button" class="btn sec" data-sj-mas>＋ Agregar jugador nuevo…</button></div>' : ''}`,
      alMontar: (m, hoja) => {
        const inp = hoja.querySelector('[data-sj-q]'), cont2 = hoja.querySelector('[data-sj-lista]');
        const elegir = (v) => { m.cerrar(); K.selJugadorSet(cont, v); };
        const visibles = () => { const tk = K.norm(q).split(' ').filter(Boolean); return base().filter((x) => (!soloLes || x.les) && tk.every((t) => norm(x).includes(t))); };
        const pintar = () => {
          const v = visibles();
          cont2.innerHTML = (cfg.vacio && !q && !soloLes ? `<button type="button" class="selj-fila${hid.value === '' ? ' on' : ''}" data-v=""><span class="avatar">·</span><span class="txt"><b>${e(cfg.vacio)}</b></span></button>` : '')
            + (v.length ? v.map(fila).join('') : `<p class="vacio-msg">Nadie coincide con la búsqueda${verTodos ? '' : ' entre ' + e(cfg.principalTxt)}.${verTodos ? '' : ' <button type="button" class="btn sec chico" data-sj-todos-b>Buscar en toda la categoría</button>'}</p>`);
        };
        pintar();
        inp.addEventListener('input', () => { q = inp.value; pintar(); });
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const v = visibles(); if (v.length === 1) elegir(v[0].value); } });
        hoja.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-v]'); if (b) return elegir(b.dataset.v);
          const tg = ev.target.closest('[data-sj-todos], [data-sj-todos-b]');
          if (tg) {
            verTodos = !verTodos;
            const bt = hoja.querySelector('[data-sj-todos]'), tx = hoja.querySelector('[data-sj-pri]');
            if (bt) { bt.classList.toggle('on', verTodos); bt.setAttribute('aria-pressed', verTodos); bt.innerHTML = (verTodos ? 'Solo ' + e(cfg.principalTxt) : 'Ver toda la categoría <small>' + ord.length + '</small>'); }
            if (tx) tx.textContent = verTodos ? 'Mostrando toda la categoría' : 'Mostrando solo ' + cfg.principalTxt;
            pintar(); return;
          }
          const l = ev.target.closest('[data-sj-les]');
          if (l) { soloLes = !soloLes; l.classList.toggle('on', soloLes); l.setAttribute('aria-pressed', soloLes); pintar(); return; }
          if (ev.target.closest('[data-sj-mas]') && !creando) {
            creando = true;
            const caja = hoja.querySelector('[data-sj-nuevo]');
            caja.innerHTML = '<div class="fila gap"><input type="text" class="grow" placeholder="Nombres y 2 apellidos" data-sj-nombre autocomplete="off"><button type="button" class="btn" data-sj-ok>Agregar</button></div>';
            const n = caja.querySelector('input'); n.focus();
            const crear = () => {
              const nj = K.crearJugadorRapido(n.value); if (!nj) return;
              const it = K.itemsSelJ([nj])[0]; cfg.lista.push(it); elegir(it.value);
            };
            caja.querySelector('[data-sj-ok]').onclick = crear;
            n.addEventListener('keydown', (k) => { if (k.key === 'Enter') { k.preventDefault(); crear(); } });
          }
        });
        setTimeout(() => { try { inp.focus(); } catch (x) { /* nada */ } }, 90);
      }
    });
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-selj-abrir]'); if (!b || b.disabled) return;
    ev.preventDefault(); K.selJugadorAbrir(b.closest('[data-selj]'));
  });

  /* ======================= DATOS PARA LAS ATENCIONES ======================= */
  // Las intervenciones más frecuentes de este informe (por cantidad de atenciones que las incluyen).
  K.masUsadas = function (inf, n) {
    const cuenta = {};
    (inf.atenciones || []).forEach((a) => { Object.keys(a.trat || {}).forEach((k) => { if (Number(a.trat[k]) > 0) cuenta[k] = (cuenta[k] || 0) + 1; }); });
    return inf.tratamientos.map((t, i) => ({ id: t.id, n: cuenta[t.id] || 0, i })).filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i).slice(0, n || 5).map((x) => x.id);
  };
  // Última atención de un jugador (la de fecha más reciente; si hay empate, la registrada después).
  K.ultimaAtencion = function (jid) {
    let mejor = null;
    K.state.informes.forEach((inf) => (inf.atenciones || []).forEach((a) => { if (a.jugadorId === jid && (!mejor || (a.fecha || '') >= (mejor.fecha || ''))) mejor = a; }));
    return mejor;
  };
  // Lesión o molestia abierta del jugador (sin alta): primero la lesión, luego la molestia; la más reciente de cada tipo.
  K.casoActivo = function (jid) {
    let mejor = null;
    K.state.informes.forEach((inf) => (inf.casos || []).forEach((c) => {
      if (c.jugadorId !== jid || c.alta || c.convertidaA) return;
      const p = (c.tipo === 'lesion' ? 'b' : 'a') + (c.inicio || '');
      if (!mejor || p > mejor.p) mejor = { p, c };
    }));
    return mejor ? mejor.c : null;
  };

  /* ---------- Plantillas de intervenciones ---------- */
  K.plantillas = (inf) => (Array.isArray(inf.plantillas) ? inf.plantillas : (inf.plantillas = []));
  K.guardarPlantilla = function (inf, nombre, trat) {
    nombre = String(nombre || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const t = {}; Object.keys(trat || {}).forEach((k) => { const n = Math.floor(Number(trat[k])); if (n > 0) t[k] = n; });
    if (!nombre) return { error: 'Escribe un nombre para la plantilla' };
    if (!Object.keys(t).length) return { error: 'Primero marca las intervenciones de la plantilla' };
    const l = K.plantillas(inf), ya = l.find((p) => K.norm(p.nombre) === K.norm(nombre));
    if (ya) { ya.trat = t; ya.nombre = nombre; K.guardar(); return { plantilla: ya, actualizada: true }; }
    if (l.length >= 20) return { error: 'Ya tienes 20 plantillas: elimina alguna' };
    const p = { id: 'pl' + K.uid(), nombre, trat: t }; l.push(p); K.guardar();
    return { plantilla: p };
  };
  K.quitarPlantilla = function (inf, id) {
    K.conDeshacer('Plantilla eliminada', () => { inf.plantillas = K.plantillas(inf).filter((p) => p.id !== id); }, { restaurado: 'Plantilla restaurada' });
  };

  /* ======================= REGISTRO DE VARIOS JUGADORES ======================= */
  // Bloque para elegir varios jugadores: buscador, atajos, contador fijo y casillas grandes. Los marcados son los [data-vj]:checked.
  K.variosHTML = function (inf) {
    const js = K.itemsSelJ(K.jugadoresCat(inf)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), nL = js.filter((x) => x.les).length;
    return `<div class="oculto varios" data-lista-varios>
      <div class="vj-barra"><b class="vj-cont" data-vj-cont aria-live="polite">0 seleccionados</b>
        <input type="search" data-vj-q placeholder="Buscar jugador…" autocomplete="off" aria-label="Buscar entre los jugadores">
        <div class="vj-atajos"><button type="button" class="th-chip" data-vj-atajo="les">Lesionados <small>${nL}</small></button><button type="button" class="th-chip" data-vj-atajo="grupo">Último grupo</button><button type="button" class="th-chip" data-vj-atajo="todos">Todos</button><button type="button" class="th-chip" data-vj-atajo="ninguno">Ninguno</button></div></div>
      <div class="vj-lista">${js.map((x) => `<label class="vj-fila" data-n="${e(K.norm(x.nombre))}" data-les="${x.les ? 1 : 0}"><span class="vj-caja"><input type="checkbox" data-vj value="${e(x.jid)}"></span><span class="txt"><b>${e(x.nombre)}</b>${x.sub ? `<small>${e(x.sub)}</small>` : ''}</span>${x.les ? '<i class="chip g-grave etq" data-lesionado>Lesionado</i>' : ''}</label>`).join('')}</div></div>`;
  };
  K.variosMontar = function (hoja, alCambiar) {
    const caja = hoja.querySelector('[data-lista-varios]'); if (!caja) return null;
    const filas = () => Array.from(caja.querySelectorAll('.vj-fila')), vis = (f) => !f.classList.contains('oculto');
    const contar = () => {
      const n = caja.querySelectorAll('[data-vj]:checked').length;
      caja.querySelector('[data-vj-cont]').textContent = n === 1 ? '1 seleccionado' : n + ' seleccionados';
      if (alCambiar) alCambiar(n);
    };
    const poner = (f, on) => { f.querySelector('[data-vj]').checked = on; };
    caja.addEventListener('change', (ev) => { if (ev.target.matches('[data-vj]')) contar(); });
    caja.querySelector('[data-vj-q]').addEventListener('input', (ev) => {
      const tk = K.norm(ev.target.value).split(' ').filter(Boolean);
      filas().forEach((f) => f.classList.toggle('oculto', !tk.every((t) => f.dataset.n.includes(t))));
    });
    caja.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-vj-atajo]'); if (!b) return;
      const a = b.dataset.vjAtajo;
      if (a === 'ninguno') filas().forEach((f) => poner(f, false));
      else if (a === 'todos') filas().filter(vis).forEach((f) => poner(f, true));
      else if (a === 'les') filas().forEach((f) => poner(f, f.dataset.les === '1'));
      else if (a === 'grupo') { const g = new Set(K.ultimoGrupo()); const hay = filas().some((f) => g.has(f.querySelector('[data-vj]').value)); if (!hay) K.aviso('Todavía no hay un grupo anterior', true); else filas().forEach((f) => poner(f, g.has(f.querySelector('[data-vj]').value))); }
      contar();
    });
    contar();
    return { contar, limpiar() { filas().forEach((f) => poner(f, false)); contar(); }, marcados: () => Array.from(caja.querySelectorAll('[data-vj]:checked')).map((x) => x.value) };
  };

  /* ======================= PANTALLA HOY ======================= */
  const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaLarga = (iso) => { const d = new Date(iso + 'T12:00:00'), t = `${DIAS_L[d.getDay()]} ${d.getDate()} de ${MESES_L[d.getMonth()]}`; return t[0].toUpperCase() + t.slice(1); };
  const cuando = (f, hoy) => { const n = dif(hoy, f); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 0 ? `en ${n} días` : n === -1 ? 'ayer' : `hace ${-n} días`; };
  const CAMPOS_PROX = [['proxControl', 'control', () => 'Control médico'], ['proxExamen', 'examen', (c) => 'Examen' + (c.proxExamenTipo ? ' · ' + c.proxExamenTipo : '')], ['proxProc', 'proc', (c) => 'Procedimiento' + (c.proxProcTipo ? ' · ' + c.proxProcTipo : '')], ['proxHito', 'hito', (c) => c.proxHitoTxt || 'Hito']];

  /* Datos de la pantalla Hoy para la categoría elegida (también los usan las pruebas). */
  K.hoyDatos = function () {
    const hoy = K.hoy(), man = suma(hoy, 1), cat = K.ui.cat, inf = K.inf();
    const lesAll = K.kineLesionados().filter((it) => it.cat === cat), est = K.estadoJugadores();
    const evsJ = (it) => it.inf.eventos.filter((v) => v.jugadorId === it.j.id && v.fecha);
    const hechoEv = (it, tipo, desde) => evsJ(it).some((v) => v.tipo === tipo && v.fecha >= desde && v.fecha <= hoy);
    const atHoy = new Set(); let nHoy = 0;
    (inf.atenciones || []).forEach((a) => { if (a.fecha === hoy && K.enCat(inf, a.jugadorId)) { atHoy.add(a.jugadorId); nHoy++; } });
    const lesionados = lesAll.map((it) => {
      const c = it.c, fut = [];
      if (c.proxControl && c.proxControl >= hoy) fut.push(c.proxControl);
      evsJ(it).forEach((v) => { if (v.tipo === 'control' && v.fecha >= hoy) fut.push(v.fecha); });
      fut.sort();
      let prox = fut[0] ? { f: fut[0], vencido: false } : null;
      if (!prox && c.proxControl && c.proxControl < hoy && !hechoEv(it, 'control', c.proxControl)) prox = { f: c.proxControl, vencido: true };
      return { it, jid: it.j.id, nombre: it.j.nombre, casoId: c.id, conmocion: c.conmocion === true, titulo: c.titulo, zonas: (c.zonas || []).map(K.nombreZona), dia: c.inicio ? Math.max(1, dif(c.inicio, hoy)) : 0, esDiaLesion: c.inicio === hoy, prox, atendidoHoy: atHoy.has(it.j.id), asis: K.kineAsisDia(it.inf, it.j.id, hoy) };
    });
    // controles, exámenes, procedimientos y otros hitos de hoy y los que ya pasaron sin actualizarse
    const ctl = { hoy: [], vencidos: [] }, vistos = new Set();
    const poner = (f, tipo, txt, it) => {
      const k = [f, it.j.id, tipo].join('|'); if (vistos.has(k)) return; vistos.add(k);
      const x = { f, tipo, txt, jid: it.j.id, nombre: it.j.nombre, casoId: it.c ? it.c.id : '' };
      if (f === hoy) ctl.hoy.push(x); else ctl.vencidos.push(x);
    };
    lesAll.forEach((it) => CAMPOS_PROX.forEach(([campo, tipo, tx]) => {
      const f = it.c[campo]; if (!f || f > hoy) return;
      if (f < hoy && (tipo === 'control' || tipo === 'examen') && hechoEv(it, tipo, f)) return; // ya se hizo: solo falta que alguien actualice la fecha
      poner(f, tipo, tx(it.c), it);
    }));
    K.kineInfs().forEach((i) => i.eventos.forEach((v) => {
      if (v.fecha !== hoy || !['control', 'examen', 'cirugia'].includes(v.tipo)) return;
      const j = K.jugador(i, v.jugadorId); if (!j || j.activo === false || !K.inscrito(j) || K.kineCatDe(j, i) !== cat) return;
      poner(hoy, v.tipo === 'cirugia' ? 'cirugia' : v.tipo, (v.tipo === 'control' ? 'Control médico' : v.tipo === 'examen' ? 'Examen' : 'Cirugía') + (v.nombre ? ' · ' + v.nombre : ''), { j, c: null });
    }));
    ctl.vencidos.sort((a, b) => a.f.localeCompare(b.f)); ctl.hoy.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    // lesionados sin atención hace más de 5 días (una fila por jugador)
    const porJ = new Map(); lesAll.forEach((it) => { const r = porJ.get(it.j.id); if (!r) porJ.set(it.j.id, { it, ini: it.c.inicio || '' }); else if (it.c.inicio && (!r.ini || it.c.inicio < r.ini)) r.ini = it.c.inicio; });
    const sinAt = [];
    porJ.forEach((r, jid) => {
      const ult = est.ult.get(jid) || '', ref = ult && ult >= r.ini ? ult : r.ini; if (!ref) return;
      const dias = dif(ref, hoy);
      if (dias > 5) sinAt.push({ jid, nombre: r.it.j.nombre, casoId: r.it.c.id, dias, nunca: !(ult && ult >= r.ini) });
    });
    sinAt.sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre, 'es'));
    // partidos de hoy y mañana de esta categoría
    const vp = new Set(), partidos = [];
    (inf.partidos || []).forEach((p) => {
      if ((p.fecha !== hoy && p.fecha !== man) || (p.cat && Number(p.cat) !== cat)) return;
      const k = (p.jid || p.id); if (vp.has(k)) return; vp.add(k);
      partidos.push({ id: p.id, rival: p.rival, fecha: p.fecha, hoy: p.fecha === hoy, local: !!p.local, cat: p.cat ? Number(p.cat) : null });
    });
    partidos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    // conmociones con el SCAT5 pendiente (falta el camarín o más de 24 h sin seguimiento)
    const scat = K.scat5 ? lesAll.filter((it) => it.c.conmocion === true).map((it) => { const pd = K.scat5.pendiente(it.c); return pd ? { jid: it.j.id, nombre: it.j.nombre, casoId: it.c.id, tipo: pd.tipo, txt: pd.txt } : null; }).filter(Boolean) : [];
    return { hoy, man, cat, lesionados, controles: ctl, sinAtencion: sinAt, partidos, nAtencionesHoy: nHoy, scat };
  };

  const btnAsis = (l, v, ico, txt, on, extra) => `<button type="button" class="hoy-as ${v}${on ? ' on' : ''}" data-acc="hoyAsis" data-caso="${e(l.casoId)}" data-v="${v}" aria-pressed="${!!on}" aria-label="${e(txt)}: ${e(l.nombre)}">${K.uiIco(ico, 24)}<span>${txt}</span></button>`;
  function filaLesionado(l) {
    const a = l.asis, it = l.it, ed = K.puedeEditar();
    const prox = l.prox ? `Control ${fc(l.prox.f)}${l.prox.vencido ? ' · vencido' : ' (' + cuando(l.prox.f, K.hoy()) + ')'}` : '';
    return `<div class="hoy-les" data-jid="${e(l.jid)}" data-caso="${e(l.casoId)}">
      <div class="hoy-les-top" data-acc="hoyFicha" data-jid="${e(l.jid)}" role="button" tabindex="0"><span class="avatar">${e(ini(l.nombre))}</span>
        <div class="txt"><b>${e(l.nombre)}${l.conmocion ? ' <i class="chip g-grave etq" data-conmocion>Conmoción</i>' : ''}${l.atendidoHoy ? ' <i class="chip g-leve etq" data-atendido>Atendido hoy</i>' : ''}</b><span>${e(l.titulo)}${l.zonas.length ? ' · ' + e(l.zonas.join(', ')) : ''}</span><span class="hoy-dato">Día ${l.dia} de baja${prox ? ` · <i class="${l.prox.vencido ? 'venc' : ''}">${e(prox)}</i>` : ''}</span></div></div>
      ${ed ? `<div class="hoy-btns">${l.esDiaLesion ? '<span class="hoy-L" title="Día de la lesión">L<small>Día de la lesión</small></span>'
        : btnAsis(l, 'si', 'ok', 'Asistió', a && a.v === 'si') + btnAsis(l, 'no', 'cerrar', 'No asistió', a && a.v === 'no' && a.no !== 'pauta') + btnAsis(l, 'pauta', 'casa', 'En casa', a && a.v === 'no' && a.no === 'pauta')}
        <button type="button" class="hoy-at" data-acc="hoyAtender" data-jid="${e(l.jid)}" data-caso="${e(l.casoId)}" aria-label="Registrar atención a ${e(l.nombre)}">${K.uiIco('mas', 22)}<span>Atender</span></button></div>
      ${a && !l.esDiaLesion ? `<div class="kf-sel hoy-sel">${K.kineSelAsis(it, a, K.hoy())}</div>` : ''}` : ''}
    </div>`;
  }
  K.pHoy = function () {
    const d = K.hoyDatos(), cat = K.ui.cat, ed = K.puedeEditar();
    const chips = [15, 16, 18, 20].map((c) => `<button type="button" class="hoy-cat${c === cat ? ' on' : ''}" data-acc="hoyCat" data-c="${c}" aria-pressed="${c === cat}">Sub ${c}</button>`).join('');
    const nCtl = d.controles.hoy.length + d.controles.vencidos.length;
    const filaCtl = (x, venc) => `<div class="item hoy-ctl" data-acc="hoyFicha" data-jid="${e(x.jid)}"><span class="mini-ico">${K.ico(x.tipo === 'examen' ? 'svg:examen' : x.tipo === 'cirugia' ? 'svg:cirugia' : 'svg:control')}</span><div class="txt"><b>${e(x.nombre)}</b><span>${e(x.txt)} · ${fc(x.f)}</span></div><span class="chip ${venc ? 'g-grave' : 'g-leve'}">${venc ? 'Vencido hace ' + dif(x.f, d.hoy) + ' d' : 'Hoy'}</span></div>`;
    return `
      <div class="titulo-vista"><h1>Hoy</h1><span class="suave hoy-fecha">${e(fechaLarga(d.hoy))}</span></div>
      <div class="hoy-cats" role="group" aria-label="Cambiar de categoría">${chips}</div>
      ${K.avisoTemporada ? K.avisoTemporada() : ''}
      ${!K.vivos(K.inf()).length ? '<div class="aviso">Aún no hay jugadores en este informe. Agrégalos en la pestaña <b>Jugadores</b> y vuelve aquí.</div>' : ''}
      ${ed ? `<button type="button" class="hoy-grande" data-acc="nuevaAtencion"><span class="mini-ico">${K.ico('svg:atenciones')}</span><span>Registrar atención</span></button>
      <div class="hoy-rapidos"><button type="button" class="btn sec" data-acc="hoyRepetir">${K.uiIco('copiar', 18)} Repetir última</button><button type="button" class="btn sec" data-acc="hoyVarios">${K.uiIco('jugadores', 18)} Varios jugadores</button><button type="button" class="btn sec" data-acc="nuevoCaso">${K.uiIco('mas', 18)} Lesión</button></div>
      <p class="suave hoy-n" data-hoy-n>${d.nAtencionesHoy ? `Hoy llevas <b>${d.nAtencionesHoy}</b> ${d.nAtencionesHoy === 1 ? 'atención' : 'atenciones'} registrada${d.nAtencionesHoy === 1 ? '' : 's'}.` : 'Aún no registras atenciones hoy.'}</p>` : ''}
      ${d.scat.length ? `<div class="card cm-card" data-hoy-scat><h2>SCAT5 pendiente <span class="suave" style="font-weight:400">(${d.scat.length})</span></h2><div class="lista">${d.scat.map((x) => `<div class="item"><div class="txt" data-acc="hoyFicha" data-jid="${e(x.jid)}"><b>${e(x.nombre)}</b><span>${e(x.txt)}</span></div>${ed ? `<button type="button" class="btn chico" data-acc="hoyScat" data-caso="${e(x.casoId)}">Continuar</button>` : ''}</div>`).join('')}</div></div>` : ''}
      <div class="card" data-hoy-les><div class="fila sb"><h2 style="margin:0">Lesionados activos <span class="suave" style="font-weight:400">(${d.lesionados.length})</span></h2><a href="#" data-acc="hoyKine" class="suave">Ver en Kine</a></div>
        ${d.lesionados.length ? d.lesionados.map(filaLesionado).join('') : `<p class="vacio-msg">No hay lesionados activos en Sub ${cat}.</p>`}</div>
      ${nCtl ? `<div class="card" data-hoy-ctl><h2>Controles de hoy y vencidos <span class="suave" style="font-weight:400">(${nCtl})</span></h2><p class="sub">Los vencidos son fechas de control, examen o procedimiento que ya pasaron y siguen sin actualizarse en la ficha del lesionado.</p>
        <div class="lista">${d.controles.vencidos.map((x) => filaCtl(x, true)).join('')}${d.controles.hoy.map((x) => filaCtl(x, false)).join('')}</div></div>` : ''}
      ${d.sinAtencion.length ? `<div class="card" data-hoy-sin><h2>Sin atención hace más de 5 días <span class="suave" style="font-weight:400">(${d.sinAtencion.length})</span></h2>
        <div class="lista">${d.sinAtencion.map((x) => `<div class="item"><div class="txt" data-acc="hoyFicha" data-jid="${e(x.jid)}"><b>${e(x.nombre)}</b><span>${x.nunca ? 'Sin atenciones desde que se lesionó' : 'Última atención'} · hace ${x.dias} días</span></div>${ed ? `<button type="button" class="btn sec" data-acc="hoyAtender" data-jid="${e(x.jid)}" data-caso="${e(x.casoId)}">Atender</button>` : ''}</div>`).join('')}</div></div>` : ''}
      ${d.partidos.length ? `<div class="card" data-hoy-part><h2>Partidos de hoy y mañana</h2><div class="lista">${d.partidos.map((p) => `<div class="item" data-acc="hoyPartido" data-id="${e(p.id)}"><span class="mini-ico">${K.ico('svg:balon')}</span><div class="txt"><b>${p.hoy ? 'Hoy' : 'Mañana'} · vs ${e(p.rival || '—')}</b><span>${p.cat ? 'Sub ' + p.cat + ' · ' : ''}${p.local ? 'Local' : 'Visita'} · ${e(fc(p.fecha))}</span></div></div>`).join('')}</div></div>` : ''}`;
  };
  K.PANTALLAS.unshift(['hoy', 'Hoy', K.pHoy]);

  const abrirEn = (it, fn) => { if (it && it.inf !== K.inf()) K.enInforme(it.inf, it.j, fn); else fn(); };
  Object.assign(K.acciones, {
    hoyCat(el) { K.seleccionarCat(Number(el.dataset.c), true); },
    hoyAsis(el) { K.kineMarcarAsis(el.dataset.caso, el.dataset.v, K.hoy()); },
    hoyAtender(el) { const it = K.kineItem(el.dataset.caso); abrirEn(it, () => K.formAtencion({ jugadorId: el.dataset.jid, casoId: el.dataset.caso })); },
    hoyFicha(el, ev) { if (ev) ev.preventDefault(); K.ui.pantalla = 'jugadores'; K.ui.jugadorId = el.dataset.jid; K.render(); window.scrollTo(0, 0); },
    hoyScat(el) { const it = K.kineItem(el.dataset.caso); abrirEn(it, () => K.scat5.abrirCaso(el.dataset.caso)); },
    hoyKine(el, ev) { if (ev) ev.preventDefault(); K.ui.pantalla = 'kine'; K.render(); window.scrollTo(0, 0); },
    hoyPartido(el) { K.ui.pantalla = 'calendario'; K.ui.partidoId = el.dataset.id; K.ui.partVista = null; K.render(); window.scrollTo(0, 0); },
    hoyRepetir() { K.formAtencion({ repetir: true, abrirSel: true }); },
    hoyVarios() { K.formAtencion({ varios: true }); }
  });
})();
