/* Torneos como ficha propia (v1.6, fase 5A): Copa Libertadores, torneos amistosos, giras…
   Cada informe (grupo Sub 15-16 o Sub 18-20) tiene su arreglo `torneos`:
   { id, nombre, tipo, pais, sede, desde, hasta, cats, fases:[{id,nombre}], viaje, logistica:{altitud,huso,clima,vuelos,hotel,notas}, inscritos:[{id,num?}], notas }
   Los partidos apuntan al torneo con `torneoId` y `fase` (id de la fase); `p.torneo` (texto) siempre es el nombre del torneo, así
   los informes de siempre (que agrupan por ese texto) no cambian. Esta fase hace la entidad y su gestión; carga/descanso, chequeos de
   salud, antidopaje, informe PDF y comparación vienen en la 5B. */
(function () {
  const K = window.K;
  const e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const lista = (inf) => (Array.isArray(inf.torneos) ? inf.torneos : (inf.torneos = []));
  const buscar = (inf, id) => (id ? lista(inf).find((t) => t.id === id) || null : null);
  const catsGrupo = (inf) => { const g = K.grupoDeInforme(inf); return g ? g.cats.slice() : [15, 16, 18, 20]; };
  const catsDe = (t, inf) => (t.cats && t.cats.length ? t.cats : catsGrupo(inf));
  const fasesBase = () => K.FASES_BASE.map(([id, nombre]) => ({ id, nombre }));
  const hash36 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const logisticaVacia = () => ({ altitud: '', huso: '', clima: '', vuelos: '', hotel: '', notas: '' });
  const puedeEd = () => !K.puedeEditar || K.puedeEditar();
  let pendiente = false; // hubo una migración que aún no se guardó

  /* ---------- Estado calculado por fechas ---------- */
  function estado(t, hoy) {
    hoy = hoy || K.hoy();
    const d = ISO.test(t.desde || '') ? t.desde : '', h = ISO.test(t.hasta || '') ? t.hasta : '';
    if (h && hoy > h) return 'Terminado';
    if (d && hoy >= d) return 'En curso';
    return 'Planificado';
  }
  const ESTADO_CLS = { 'En curso': 'g-leve', Planificado: 'g-moderada', Terminado: 'g-pordefinir' };
  const estadoChip = (t) => `<i class="chip ${ESTADO_CLS[estado(t)]}">${e(estado(t))}</i>`;
  const fechasTxt = (t) => (t.desde && t.hasta ? (t.desde === t.hasta ? fc(t.desde) : fc(t.desde) + ' al ' + fc(t.hasta)) : t.desde ? 'Desde el ' + fc(t.desde) : t.hasta ? 'Hasta el ' + fc(t.hasta) : 'Sin fechas');
  const dondeTxt = (t) => [t.sede, t.pais].filter(Boolean).join(', ');
  const catsTxt = (t, inf) => catsDe(t, inf).slice().sort((a, b) => b - a).map((c) => 'Sub ' + c).join(' y ');

  /* ---------- Normalización y migración (idempotentes) ---------- */
  const tipoDe = (k) => (/amistos|gira/.test(k) ? 'Amistoso' : /libertadores|sudamericana/.test(k) ? 'Internacional' : 'Nacional');
  function idDet(inf, key) { // id estable según el nombre: dos dispositivos que migran lo mismo crean el mismo torneo (no se duplica en la nube)
    let id = 'tm' + hash36(key), n = 0;
    while (lista(inf).some((t) => t.id === id && K.norm(t.nombre) !== key)) id = 'tm' + hash36(key) + (++n);
    return id;
  }
  // Cada texto `torneo` distinto (sin tildes ni mayúsculas) de un informe pasa a ser un torneo y sus partidos se enlazan. No toca p.torneo.
  function migrar(inf) {
    const ps = (inf.partidos || []).filter((p) => !p.torneoId && typeof p.torneo === 'string' && p.torneo.trim());
    if (!ps.length) return false;
    const g = K.grupoDeInforme(inf), gc = g ? g.cats : null, grupos = new Map();
    ps.forEach((p) => { const k = K.norm(p.torneo); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
    grupos.forEach((arr, k) => {
      let t = lista(inf).find((x) => K.norm(x.nombre) === k);
      if (!t) {
        const cuenta = {}; arr.forEach((p) => { const v = p.torneo.replace(/\s+/g, ' ').trim(); cuenta[v] = (cuenta[v] || 0) + 1; });
        const nombre = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
        const fechas = arr.map((p) => p.fecha).filter((f) => ISO.test(f || '')).sort();
        const cats = Array.from(new Set(arr.map((p) => Number(p.cat)).filter((c) => c && (!gc || gc.includes(c))))).sort((a, b) => a - b);
        t = { id: idDet(inf, k), nombre, tipo: tipoDe(k), pais: '', sede: '', desde: fechas[0] || '', hasta: fechas[fechas.length - 1] || '', cats, fases: fasesBase(), viaje: false, logistica: logisticaVacia(), inscritos: [], notas: '' };
        lista(inf).push(t);
      }
      arr.forEach((p) => { p.torneoId = t.id; });
    });
    pendiente = true;
    return true;
  }
  function normalizar(inf) {
    lista(inf).forEach((t) => {
      ['nombre', 'pais', 'sede', 'desde', 'hasta', 'notas'].forEach((c) => { if (typeof t[c] !== 'string') t[c] = ''; });
      if (!K.TORNEO_TIPOS.includes(t.tipo)) t.tipo = 'Nacional';
      ['cats', 'fases', 'inscritos'].forEach((c) => { if (!Array.isArray(t[c])) t[c] = []; });
      t.viaje = t.viaje === true;
      if (!t.logistica || typeof t.logistica !== 'object' || Array.isArray(t.logistica)) t.logistica = logisticaVacia();
      if (t.chequeos !== undefined) { // chequeos de salud (5B): { inicio: {jugadorId: {estado, nota}}, fin: {…} }
        const c = t.chequeos && typeof t.chequeos === 'object' && !Array.isArray(t.chequeos) ? t.chequeos : {};
        ['inicio', 'fin'].forEach((k) => { if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {}; });
        t.chequeos = { inicio: c.inicio, fin: c.fin };
      }
    });
    if (puedeEd()) migrar(inf);
    return inf;
  }
  // Si una migración dejó cambios sin guardar (carga de la app, respaldo viejo), se guardan al dibujar la primera pantalla.
  const render0 = K.render;
  K.render = function () { if (pendiente && K.state && puedeEd()) { pendiente = false; K.guardar(); } return render0.apply(this, arguments); };

  /* ---------- Partidos, atenciones y lesiones del torneo ---------- */
  const partidosDe = (inf, t) => (inf.partidos || []).filter((p) => p.torneoId === t.id);
  const jornadasDe = (inf, t) => K.jornadas(inf).filter((j) => j.ps.some((p) => p.torneoId === t.id));
  const faseNombre = (t, id) => { const f = id && t && (t.fases || []).find((x) => x.id === id); return f ? f.nombre : ''; };
  // Cambia el torneo y la fase de un partido y deja coherentes sus atenciones y molestias automáticas: en un torneo de viaje nacen “En gira”.
  function resync(p, t) {
    K.state.informes.forEach((i) => {
      (i.atenciones || []).forEach((a) => {
        if (a.partidoId !== p.id) return;
        if (t) a.torneoId = t.id; else delete a.torneoId;
        if (t && t.viaje) a.origen = 'gira'; else if (a.origen === 'gira') a.origen = 'ssw';
      });
      (i.casos || []).forEach((c) => { if (c.auto && c.partidoId === p.id) { if (t) c.torneoId = t.id; else delete c.torneoId; } });
    });
  }
  function aplicarAPartido(inf, p, torneoId, faseId) {
    const t = buscar(inf, torneoId);
    if (t) { p.torneoId = t.id; p.torneo = t.nombre; if (faseId && t.fases.some((f) => f.id === faseId)) p.fase = faseId; else delete p.fase; }
    else { delete p.torneoId; delete p.fase; p.torneo = ''; }
    resync(p, t);
  }
  // Datos del torneo recién editados (nombre, viaje, fases): se propagan a sus partidos y atenciones.
  function propagar(inf, t) {
    partidosDe(inf, t).forEach((p) => { p.torneo = t.nombre; if (p.fase && !t.fases.some((f) => f.id === p.fase)) delete p.fase; resync(p, t); });
  }
  function eliminar(inf, t) {
    partidosDe(inf, t).forEach((p) => aplicarAPartido(inf, p, '', ''));
    K.state.informes.forEach((i) => ['atenciones', 'casos'].forEach((k) => (i[k] || []).forEach((r) => { if (r.torneoId === t.id) delete r.torneoId; })));
    inf.torneos = lista(inf).filter((x) => x.id !== t.id);
  }
  const enRango = (t, f) => !!f && !!(t.desde || t.hasta) && (!t.desde || f >= t.desde) && (!t.hasta || f <= t.hasta);
  // Lo ocurrido “durante el torneo”: lo marcado con el torneo, lo de sus partidos y lo de sus inscritos dentro de las fechas.
  function registros(inf, t) {
    const pids = new Set(partidosDe(inf, t).map((p) => p.id)), ins = new Set((t.inscritos || []).map((x) => x.id)), at = [], ca = [];
    K.state.informes.forEach((i) => {
      (i.atenciones || []).forEach((a) => { if (a.torneoId === t.id || pids.has(a.partidoId) || (ins.has(a.jugadorId) && enRango(t, a.fecha))) at.push(a); });
      (i.casos || []).forEach((c) => { if (c.torneoId === t.id || pids.has(c.partidoId) || (ins.has(c.jugadorId) && enRango(t, c.inicio))) ca.push(c); });
    });
    return { atenciones: at, casos: ca };
  }
  const parseRes = (r) => { const m = /^\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\s*$/.exec(r || ''); return m ? [Number(m[1]), Number(m[2])] : null; };
  // KPIs simples del torneo. El marcador se lee “Wanderers – rival”.
  function kpis(inf, t) {
    const ps = partidosDe(inf, t), jug = ps.filter((p) => p.jugado), r = registros(inf, t);
    let g = 0, em = 0, pe = 0, conRes = 0;
    jug.forEach((p) => { const x = parseRes(p.res); if (!x) return; conRes++; if (x[0] > x[1]) g++; else if (x[0] === x[1]) em++; else pe++; });
    return { partidos: ps.length, jugados: jug.length, pendientes: ps.length - jug.length, g, e: em, p: pe, conRes, atenciones: r.atenciones.length, lesiones: r.casos.filter((c) => c.tipo === 'lesion').length, molestias: r.casos.filter((c) => c.tipo !== 'lesion').length, inscritos: (t.inscritos || []).length };
  }
  K.torneos = { lista, buscar, estado, normalizar, migrar, aplicarAPartido, propagar, eliminar, registros, kpis, partidosDe, jornadasDe, faseNombre, catsDe, parseRes, fasesBase, enRango, puedeEd, fechasTxt, dondeTxt, catsTxt, estadoChip };
  // Torneos ya usados (para sugerirlos); sigue existiendo por compatibilidad.
  K.torneosGuardados = () => { const s = new Set(); K.state.informes.forEach((i) => { (i.partidos || []).forEach((p) => { if (p.torneo) s.add(p.torneo); }); lista(i).forEach((t) => s.add(t.nombre)); }); return [...s].sort((a, b) => a.localeCompare(b, 'es')); };
  // Texto corto “Torneo · Fase” de un partido (para listas y encabezados)
  K.torneoDePartido = (inf, p) => { const t = p && buscar(inf, p.torneoId); return t ? { t, fase: faseNombre(t, p.fase), txt: t.nombre + (p.fase && faseNombre(t, p.fase) ? ' · ' + faseNombre(t, p.fase) : '') } : null; };

  /* ---------- Lista de torneos (pestaña “Torneos” de Partidos) ---------- */
  const ordenTorneos = (inf) => { const ord = { 'En curso': 0, Planificado: 1, Terminado: 2 }; return lista(inf).slice().sort((a, b) => ord[estado(a)] - ord[estado(b)] || (b.desde || '').localeCompare(a.desde || '') || a.nombre.localeCompare(b.nombre, 'es')); };
  K.partidosTabsHTML = (inf) => `<div style="margin:0 0 12px">${K.seg('partTab', [['partidos', 'Partidos'], ['torneos', 'Torneos' + (lista(inf).length ? ' (' + lista(inf).length + ')' : '')]], K.ui.partTab === 'torneos' ? 'torneos' : 'partidos')}</div>`;
  K.torneosListaHTML = function (inf) {
    const ts = ordenTorneos(inf);
    return `<div class="card" data-torneos-lista><div class="fila sb wrap gap"><h2 style="margin:0">Torneos (${ts.length})</h2><button class="btn" data-acc="torneoNuevo">${K.uiIco('mas', 16)} Nuevo torneo</button></div>
      <p class="sub">Copa Libertadores, torneos amistosos, giras… Cada torneo tiene su propia ficha con sus fases, partidos, jugadores inscritos y datos del viaje. Un partido se asocia a un torneo al crearlo o editarlo.</p>
      ${ts.length ? `<div class="lista">${ts.map((t) => { const n = partidosDe(inf, t).length, ni = (t.inscritos || []).length; return `<div class="item tn-it" data-acc="torneoAbrir" data-id="${e(t.id)}"><span class="mini-ico tn-ico">${K.uiIco('trofeo', 26)}</span>
        <div class="txt"><b>${e(t.nombre)}</b><span>${e(t.tipo)}${dondeTxt(t) ? ' · ' + e(dondeTxt(t)) : ''} · ${e(fechasTxt(t))}</span><span>${e(catsTxt(t, inf))} · ${n} partido${n === 1 ? '' : 's'} · ${ni} inscrito${ni === 1 ? '' : 's'}${t.viaje ? ' · viaje' : ''}</span></div>${estadoChip(t)}</div>`; }).join('')}</div>`
        : '<p class="vacio-msg">Aún no hay torneos. Toca <b>Nuevo torneo</b> para crear el primero (por ejemplo Copa Libertadores Sub 20).</p>'}</div>${K.torneos.comparacionHTML ? K.torneos.comparacionHTML(inf) : ''}`;
  };

  /* ---------- Ficha del torneo ---------- */
  const tabTorneo = () => (['resumen', 'partidos', 'jugadores', 'salud', 'viaje'].includes(K.ui.torneoTab) ? K.ui.torneoTab : 'resumen');
  const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
  const dia = (iso) => ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(iso + 'T12:00:00').getDay()];

  function itemJornada(inf, jn) {
    const P = K.part, r = K.resumenPartidos(inf, jn.ps);
    return `<div class="item pl-it" data-acc="partInforme" data-id="${e(jn.p0.id)}"><span class="mini-ico">${P.logo(jn)}</span><div class="txt"><b>${e(jn.rival)}</b><span>${jn.fecha ? e(dia(jn.fecha)) + ' ' + e(fc(jn.fecha)) : 'Sin fecha'} · ${jn.local ? 'Local' : 'Visita'}${jn.jugado ? '' : ' · por jugar'}</span>${P.resChips(jn)}</div>${r.n ? `<span class="chip">${r.n} atenc.</span>` : ''}</div>`;
  }
  function tabResumen(inf, t) {
    const k = kpis(inf, t), prox = jornadasDe(inf, t).filter((j) => !j.jugado && j.fecha && j.fecha >= K.hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    return `<div class="bd-kpis">${kpi(k.partidos, 'partidos')}${kpi(k.jugados, 'jugados')}${kpi(k.pendientes, 'por jugar')}${kpi(k.conRes ? `${k.g}-${k.e}-${k.p}` : '—', 'ganados-empates-perdidos')}${kpi(k.atenciones, 'atenciones')}${kpi(k.lesiones, 'lesiones')}${kpi(k.molestias, 'molestias')}${kpi(k.inscritos, 'jugadores inscritos')}</div>
      <p class="suave" style="margin:-2px 2px 10px;font-size:12.5px">Atenciones y lesiones: las marcadas con este torneo, las de sus partidos y las de sus inscritos dentro de las fechas del torneo. El marcador se lee Wanderers – rival.</p>
      <div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Datos del torneo</h2><button class="btn sec chico" data-acc="torneoEditar" data-id="${e(t.id)}">${K.uiIco('editar', 16)} Editar</button></div>
        <dl class="seg-datos tn-datos"><div><dt>Tipo</dt><dd>${e(t.tipo)}</dd></div><div><dt>Estado</dt><dd>${estadoChip(t)}</dd></div><div><dt>Fechas</dt><dd>${e(fechasTxt(t))}</dd></div><div><dt>Sede y país</dt><dd>${e(dondeTxt(t) || '—')}</dd></div>
          <div><dt>Categorías</dt><dd>${e(catsTxt(t, inf))}</dd></div><div><dt>Se juega fuera de la ciudad base</dt><dd>${t.viaje ? 'Sí (viaje)' : 'No'}</dd></div></dl>
        <h3 class="kc-sub" style="margin-top:10px">Fases</h3>
        <p style="margin:4px 0 0">${(t.fases || []).length ? t.fases.map((f) => `<i class="chip">${e(f.nombre)}</i>`).join(' ') : '<span class="suave">Sin fases definidas.</span>'}</p>
        ${t.notas ? `<h3 class="kc-sub" style="margin-top:10px">Notas</h3><p style="margin:4px 0 0;white-space:pre-line">${e(t.notas)}</p>` : ''}</div>
      ${prox ? `<div class="card"><h2>Próximo partido</h2><div class="lista">${itemJornada(inf, prox)}</div></div>` : ''}
      <p style="margin:6px 2px"><a href="#" data-acc="torneoEliminar" data-id="${e(t.id)}" class="tn-elim">Eliminar este torneo</a> <span class="suave">(los partidos no se borran: quedan sin torneo)</span></p>`;
  }
  function tabPartidos(inf, t) {
    const js = jornadasDe(inf, t), ed = puedeEd();
    const porFase = (fid) => js.filter((j) => (j.p0.fase || '') === fid).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
    const conocidas = new Set((t.fases || []).map((f) => f.id)), sinFase = js.filter((j) => !j.p0.fase || !conocidas.has(j.p0.fase));
    const bloque = (id, nombre, arr) => `<div class="card tn-fase" data-fase-bloque="${e(id)}"><div class="fila sb wrap gap"><h3 style="margin:0">${e(nombre)} <span class="suave" style="font-weight:400">(${arr.length})</span></h3>${ed ? `<button class="btn ghost chico" data-acc="torneoAddPartido" data-id="${e(t.id)}" data-fase="${e(id)}">${K.uiIco('mas', 16)} Agregar</button>` : ''}</div>
      ${arr.length ? `<div class="lista">${arr.map((j) => itemJornada(inf, j)).join('')}</div>` : '<p class="suave" style="margin:6px 0 0">Sin partidos en esta fase.</p>'}</div>`;
    return `<div class="fila sb wrap gap" style="margin-bottom:10px"><p class="sub" style="margin:0;flex:1 1 220px">Los partidos del torneo ordenados por fase. Puedes dejar planificados los partidos pendientes con su fecha.</p>${ed ? `<button class="btn" data-acc="torneoAddPartido" data-id="${e(t.id)}">${K.uiIco('mas', 16)} Agregar partido al torneo</button>` : ''}</div>
      ${(t.fases || []).map((f) => bloque(f.id, f.nombre, porFase(f.id))).join('')}
      ${sinFase.length ? bloque('', 'Sin fase', sinFase.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))) : ''}`;
  }
  const inscritosOrdenados = (t) => (t.inscritos || []).map((x) => ({ x, g: K.jugadorGlobal(x.id) })).filter((r) => r.g).sort((a, b) => ((a.x.num || 999) - (b.x.num || 999)) || a.g.j.nombre.localeCompare(b.g.j.nombre, 'es'));
  K.torneos.inscritosOrdenados = inscritosOrdenados;
  function tabJugadores(inf, t) {
    const ed = puedeEd(), ins = inscritosOrdenados(t), les = K.itemsSelJ(ins.map((r) => r.g.j));
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Jugadores inscritos <span class="suave" style="font-weight:400">(${ins.length})</span></h2>${ed ? `<button class="btn" data-acc="torneoJugadores" data-id="${e(t.id)}">${K.uiIco('mas', 16)} Agregar citados de la categoría</button>` : ''}</div>
      <p class="sub">Los jugadores que van al torneo, con el número de camiseta (opcional). Se eligen de ${e(catsTxt(t, inf))}.</p>
      ${ins.length ? `<div class="lista">${ins.map((r, i) => `<div class="item tn-ins" data-j="${e(r.g.j.id)}"><label class="tn-num"><span class="oculto">N.º de camiseta de ${e(r.g.j.nombre)}</span><input type="number" inputmode="numeric" min="1" max="99" placeholder="N.º" value="${r.x.num || ''}" ${ed ? '' : 'disabled'} data-acc-change="torneoNum" data-id="${e(t.id)}" data-j="${e(r.g.j.id)}" aria-label="N.º de camiseta de ${e(r.g.j.nombre)}"></label>
        <div class="txt"><b>${e(r.g.j.nombre)}</b><span>${e([r.g.j.categoria, r.g.j.posicion].filter(Boolean).join(' · '))}</span></div>${les[i] && les[i].les ? '<i class="chip g-grave etq">Lesionado</i>' : ''}${ed ? `<button class="btn ghost chico" data-acc="torneoQuitarJ" data-id="${e(t.id)}" data-j="${e(r.g.j.id)}" aria-label="Quitar a ${e(r.g.j.nombre)} del torneo">${K.uiIco('cerrar', 18)}</button>` : ''}</div>`).join('')}</div>`
        : '<p class="vacio-msg">Aún no hay jugadores inscritos. Toca <b>Agregar citados de la categoría</b>.</p>'}</div>${T5.cargaHTML ? T5.cargaHTML(inf, t) : ''}`;
  }
  function segurosDe(inf, t) {
    const ins = new Set((t.inscritos || []).map((x) => x.id)), out = [];
    K.state.informes.forEach((i) => (i.seguros || []).forEach((s) => {
      if (!ins.has(s.jugadorId)) return;
      const porFecha = enRango(t, s.activacion), porPais = !!(s.pais && t.pais && K.norm(s.pais) === K.norm(t.pais));
      if (porFecha || porPais) out.push(s);
    }));
    return out.sort((a, b) => (a.activacion || '').localeCompare(b.activacion || ''));
  }
  K.torneos.segurosDe = segurosDe;
  function tabViaje(inf, t) {
    const L = t.logistica || {}, ed = puedeEd(), segs = segurosDe(inf, t), huso = L.huso === '' || L.huso == null ? '' : Number(L.huso);
    const fila = (tit, v) => `<div><dt>${tit}</dt><dd>${v ? e(v) : '—'}</dd></div>`;
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Viaje y logística</h2>${ed ? `<button class="btn sec chico" data-acc="torneoLogistica" data-id="${e(t.id)}">${K.uiIco('editar', 16)} Editar</button>` : ''}</div>
        <p class="sub">${t.viaje ? 'Este torneo se juega <b>fuera de la ciudad base</b>: las atenciones de sus partidos quedan con el origen “En gira”.' : 'Este torneo se juega en la ciudad base. Si es un viaje, márcalo en <b>Editar</b> (datos del torneo).'}</p>
        <dl class="seg-datos tn-datos">${fila('Altitud', L.altitud !== '' && L.altitud != null ? L.altitud + ' msnm' : '')}${fila('Diferencia horaria', huso === '' ? '' : (huso > 0 ? '+' : '') + huso + ' h respecto a la ciudad base')}${fila('Clima', L.clima)}${fila('Hotel', L.hotel)}
          <div style="grid-column:1/-1"><dt>Vuelos</dt><dd style="white-space:pre-line">${L.vuelos ? e(L.vuelos) : '—'}</dd></div><div style="grid-column:1/-1"><dt>Notas del viaje</dt><dd style="white-space:pre-line">${L.notas ? e(L.notas) : '—'}</dd></div></dl></div>
      <div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Seguro en el exterior <span class="suave" style="font-weight:400">(${segs.length})</span></h2>${ed ? `<button class="btn chico" data-acc="torneoSeguro" data-id="${e(t.id)}">${K.uiIco('mas', 16)} Registrar activación</button>` : ''}</div>
        <p class="sub">Activaciones del seguro de los inscritos durante el torneo (por fecha) o en el país del torneo. En cada activación puedes anotar el país, si cubre el club o un seguro de viaje, y la póliza. Son datos privados.</p>
        ${segs.length ? `<div class="lista">${segs.map((s) => { const g = K.jugadorGlobal(s.jugadorId); return `<div class="item"><div class="txt"><b>${e(g ? g.j.nombre : '—')}</b><span>${e(s.diagnostico || 'sin diagnóstico')} · ${s.activacion ? e(fc(s.activacion)) : 'sin fecha'}</span><span>${[s.pais ? 'País: ' + s.pais : '', s.cobertura ? 'Cobertura: ' + s.cobertura : '', s.poliza ? 'Póliza: ' + s.poliza : ''].filter(Boolean).map(e).join(' · ') || 'Sin datos de viaje'}</span></div></div>`; }).join('')}</div>` : '<p class="vacio-msg">Sin activaciones del seguro en este torneo.</p>'}</div>`;
  }
  const T5 = K.torneos; // la carga, la salud y el informe del torneo (fase 5B) se agregan a este objeto desde torneo-carga.js y torneo-informe.js
  K.pTorneoFicha = function () {
    const inf = K.inf(), t = buscar(inf, K.ui.torneoId);
    if (!t) return null;
    const tab = tabTorneo();
    return `<div class="titulo-vista"><div class="fila gap"><button class="btn sec chico" data-acc="torneoVolver">${K.uiIco('atras', 16)} Torneos</button></div>
        <div class="fila gap wrap">${puedeEd() ? `<button class="btn sec chico" data-acc="torneoEditar" data-id="${e(t.id)}">${K.uiIco('editar', 16)} Editar torneo</button><button class="btn chico" data-acc="torneoAddPartido" data-id="${e(t.id)}">${K.uiIco('mas', 16)} Agregar partido al torneo</button>` : ''}<button class="btn sec chico" data-acc="torneoInforme" data-id="${e(t.id)}" data-torneo-pdf>${K.uiIco('pdf', 16)} Informe del torneo</button></div></div>
      <div class="fila gap" style="margin-bottom:10px"><span class="mini-ico tn-ico tn-ico-g">${K.uiIco('trofeo', 34)}</span><div><h1 style="font-family:Caladea,serif;font-size:23px;color:var(--verde-2)" data-torneo-nombre>${e(t.nombre)}</h1>
        <div class="suave">${e(t.tipo)}${dondeTxt(t) ? ' · ' + e(dondeTxt(t)) : ''} · ${e(fechasTxt(t))} · ${e(catsTxt(t, inf))} ${estadoChip(t)}</div></div></div>
      <div style="margin:0 0 12px">${K.seg('torneoTab', [['resumen', 'Resumen'], ['partidos', 'Partidos por fase'], ['jugadores', 'Jugadores'], ['salud', 'Salud'], ['viaje', 'Viaje']], tab)}</div>
      <div data-torneo-tab="${tab}">${tab === 'resumen' ? tabResumen(inf, t) : tab === 'partidos' ? tabPartidos(inf, t) : tab === 'jugadores' ? tabJugadores(inf, t) : tab === 'salud' ? (T5.saludHTML ? T5.saludHTML(inf, t) : '') : tabViaje(inf, t)}</div>`;
  };

  /* ---------- Formulario del torneo (2 pasos) ---------- */
  const fechaOk = (v) => v === '' || (ISO.test(v) && Number(v.slice(0, 4)) >= 1990);
  const logCampos = (L) => `<div class="grid2"><label class="campo"><span>Altitud de la sede (msnm)</span><input type="number" inputmode="numeric" name="altitud" min="0" max="9000" value="${e(L.altitud === '' || L.altitud == null ? '' : L.altitud)}" placeholder="Ej. 2850"></label>
      <label class="campo"><span>Diferencia horaria (horas)</span><input type="number" inputmode="decimal" name="huso" min="-14" max="14" step="0.5" value="${e(L.huso === '' || L.huso == null ? '' : L.huso)}" placeholder="Ej. 1 o -3"></label></div>
    <label class="campo"><span>Clima</span><input type="text" name="clima" maxlength="200" value="${e(L.clima || '')}" placeholder="Ej. frío y seco, 8 a 18 °C" autocomplete="off"></label>
    <label class="campo"><span>Vuelos</span><textarea name="vuelos" rows="2" maxlength="600" placeholder="Fechas, aerolínea, escalas…">${e(L.vuelos || '')}</textarea></label>
    <label class="campo"><span>Hotel</span><input type="text" name="hotel" maxlength="300" value="${e(L.hotel || '')}" autocomplete="off"></label>
    <label class="campo"><span>Notas del viaje</span><textarea name="lnotas" rows="2" maxlength="2000">${e(L.notas || '')}</textarea></label>`;
  const leerLog = (d) => {
    const n = (v, a, b) => { if (v === '' || v == null || !Number.isFinite(Number(v))) return ''; const x = Number(v); return x < a || x > b ? '' : x; };
    return { altitud: n(d.altitud, 0, 9000) === '' ? '' : Math.round(Number(d.altitud)), huso: n(d.huso, -14, 14), clima: (d.clima || '').trim().slice(0, 200), vuelos: (d.vuelos || '').trim().slice(0, 600), hotel: (d.hotel || '').trim().slice(0, 300), notas: (d.lnotas || '').trim().slice(0, 2000) };
  };
  const faseFila = (f) => `<div class="fila gap tn-fase-fila" data-fase="${e(f.id)}"><input type="text" class="grow" maxlength="60" value="${e(f.nombre)}" aria-label="Nombre de la fase" autocomplete="off"><button type="button" class="btn ghost chico" data-fase-x aria-label="Quitar la fase ${e(f.nombre)}">${K.uiIco('cerrar', 18)}</button></div>`;

  function formTorneo(rec, opt) {
    opt = opt || {};
    if (!puedeEd()) return;
    const inf = K.inf(), cats = catsGrupo(inf).sort((a, b) => b - a), sel = rec ? new Set(catsDe(rec, inf)) : new Set(cats);
    const fases = rec ? rec.fases.map((f) => Object.assign({}, f)) : fasesBase();
    K.modal({
      titulo: rec ? 'Editar torneo' : 'Nuevo torneo',
      cuerpo: `<p class="suave" data-paso-txt style="margin:0 0 10px;font-weight:600">Paso 1 de 2 · Datos básicos</p>
        <div data-paso="1">
          <label class="campo"><span>Nombre del torneo</span><input type="text" name="nombre" maxlength="120" value="${e(rec ? rec.nombre : '')}" placeholder="Ej. Copa Libertadores Sub 20" autocomplete="off"></label>
          <div class="grid2"><label class="campo"><span>Tipo</span><select name="tipo">${K.opts(K.TORNEO_TIPOS.map((x) => [x, x]), rec ? rec.tipo : 'Internacional')}</select></label>
            <label class="campo"><span>País</span><input type="text" name="pais" maxlength="80" value="${e(rec ? rec.pais : '')}" placeholder="Ej. Paraguay" autocomplete="off"></label></div>
          <label class="campo"><span>Sede (ciudad o estadio)</span><input type="text" name="sede" maxlength="120" value="${e(rec ? rec.sede : '')}" placeholder="Ej. Asunción" autocomplete="off"></label>
          <div class="grid2"><label class="campo"><span>Desde</span><input type="date" name="desde" value="${e(rec ? rec.desde : '')}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${e(rec ? rec.hasta : '')}"></label></div>
          <div class="campo"><span class="lbl">Categorías que participan</span>${cats.map((c) => `<label class="check"><input type="checkbox" name="c${c}"${sel.has(c) ? ' checked' : ''}><span>Sub ${c}</span></label>`).join('')}</div>
          <label class="check"><input type="checkbox" name="viaje"${rec && rec.viaje ? ' checked' : ''}><span>Se juega fuera de la ciudad base (viaje): las atenciones de sus partidos quedan como “En gira”</span></label>
        </div>
        <div data-paso="2" class="oculto">
          <details class="mas-clin" open><summary>Fases del torneo <small class="suave" data-fases-n></small></summary><div class="mas-cuerpo">
            <p class="suave" style="margin:0 0 8px">Puedes cambiar los nombres, quitar o agregar fases.</p>
            <div data-fases>${fases.map(faseFila).join('')}</div>
            <div class="fila gap wrap"><button type="button" class="btn sec chico" data-fase-mas>${K.uiIco('mas', 14)} Agregar fase</button><button type="button" class="btn ghost chico" data-fase-base>Restaurar las fases habituales</button></div></div></details>
          <details class="mas-clin"><summary>Jugadores inscritos</summary><div class="mas-cuerpo">
            ${rec ? `<p class="suave" style="margin:0">Hay ${(rec.inscritos || []).length} jugador(es) inscrito(s). Se editan en la pestaña <b>Jugadores</b> de la ficha del torneo.</p>`
              : '<label class="check"><input type="checkbox" name="todos"><span>Inscribir ahora a todos los jugadores de las categorías elegidas</span></label><p class="suave" style="margin:0">Después puedes agregar o quitar jugadores y poner su número de camiseta en la ficha del torneo.</p>'}</div></details>
          <details class="mas-clin"><summary>Viaje y logística <small class="suave">(opcional)</small></summary><div class="mas-cuerpo">${logCampos(rec ? rec.logistica || {} : {})}</div></details>
          <label class="campo"><span>Notas del torneo (opcional)</span><textarea name="notas" rows="3" maxlength="4000">${e(rec ? rec.notas || '' : '')}</textarea></label>
        </div>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { pedirEliminar(inf, rec); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        { txt: 'Atrás', cls: 'sec oculto', cerrar: false, fn: () => false },
        { txt: 'Siguiente', cls: 'sec', cerrar: false, fn: () => false },
        { txt: 'Guardar', cls: rec ? '' : 'oculto', fn: () => false }
      ],
      alMontar: (m, hoja) => {
        const pasos = [hoja.querySelector('[data-paso="1"]'), hoja.querySelector('[data-paso="2"]')], txt = hoja.querySelector('[data-paso-txt]');
        const [bPrim, bAtras, bSig, bGuardar] = Array.from(hoja.querySelectorAll('footer [data-b]'));
        let paso = 1;
        const ir = (n) => {
          paso = n;
          pasos[0].classList.toggle('oculto', n !== 1); pasos[1].classList.toggle('oculto', n !== 2);
          txt.textContent = n === 1 ? 'Paso 1 de 2 · Datos básicos' : 'Paso 2 de 2 · Fases, jugadores y viaje';
          bAtras.classList.toggle('oculto', n === 1); bSig.classList.toggle('oculto', n === 2); bGuardar.classList.toggle('oculto', !rec && n === 1);
          hoja.querySelector('.cuerpo').scrollTop = 0;
        };
        const leerFases = () => Array.from(hoja.querySelectorAll('[data-fase]')).map((el) => ({ id: el.dataset.fase, nombre: el.querySelector('input').value.replace(/\s+/g, ' ').trim() })).filter((f) => f.nombre);
        const validar1 = () => {
          const d = K.datos(hoja), nombre = (d.nombre || '').replace(/\s+/g, ' ').trim();
          if (!nombre) { K.aviso('Escribe el nombre del torneo', true); return null; }
          if (lista(inf).some((t) => t !== rec && K.norm(t.nombre) === K.norm(nombre))) { K.aviso('Ya existe un torneo con ese nombre', true); return null; }
          if (!fechaOk(d.desde) || !fechaOk(d.hasta)) { K.aviso('Revisa el año de las fechas', true); return null; }
          if (d.desde && d.hasta && d.desde > d.hasta) { K.aviso('La fecha “Hasta” es anterior a “Desde”', true); return null; }
          const cs = cats.filter((c) => d['c' + c]);
          if (!cs.length) { K.aviso('Marca al menos una categoría', true); return null; }
          return { d, nombre, cs };
        };
        bSig.addEventListener('click', () => { if (validar1()) ir(2); });
        bAtras.addEventListener('click', () => ir(1));
        bGuardar.addEventListener('click', () => {
          const v = validar1(); if (!v) { ir(1); return; }
          const { d, nombre, cs } = v, fs = leerFases(), hijo = Object.assign({}, rec || {});
          const datos = { nombre, tipo: d.tipo, pais: (d.pais || '').trim(), sede: (d.sede || '').trim(), desde: d.desde || '', hasta: d.hasta || '', cats: cs.slice().sort((a, b) => a - b), fases: fs, viaje: !!d.viaje, logistica: leerLog(d), notas: (d.notas || '').trim() };
          let t = rec;
          if (rec) {
            const quitadas = rec.fases.filter((f) => !fs.some((x) => x.id === f.id)).map((f) => f.id), enUso = partidosDe(inf, rec).filter((p) => p.fase && quitadas.includes(p.fase)).length;
            Object.assign(rec, datos); propagar(inf, rec);
            K.guardar(); K.aviso(enUso ? `Torneo guardado · ${enUso} partido(s) quedaron sin fase` : 'Torneo guardado'); K.render();
          } else {
            t = Object.assign({ id: K.uid(), inscritos: [] }, datos);
            if (d.todos) t.inscritos = candidatos(inf, t).map((c) => ({ id: c.j.id }));
            lista(inf).push(t);
            K.guardar(); K.aviso('Torneo creado');
            if (opt.alGuardar) opt.alGuardar(t); else { K.ui.torneoId = t.id; K.ui.torneoTab = 'resumen'; K.ui.pantalla = 'calendario'; K.ui.partidoId = null; K.render(); window.scrollTo(0, 0); }
          }
          void hijo; m.cerrar();
        });
        // fases
        const cont = hoja.querySelector('[data-fases]'), contar = () => { hoja.querySelector('[data-fases-n]').textContent = '(' + cont.children.length + ')'; };
        hoja.addEventListener('click', (ev) => {
          const x = ev.target.closest('[data-fase-x]'); if (x) { x.closest('[data-fase]').remove(); contar(); return; }
          if (ev.target.closest('[data-fase-mas]')) { cont.insertAdjacentHTML('beforeend', faseFila({ id: 'f' + K.uid(), nombre: '' })); cont.lastElementChild.querySelector('input').focus(); contar(); return; }
          if (ev.target.closest('[data-fase-base]')) { cont.innerHTML = fasesBase().map(faseFila).join(''); contar(); }
        });
        contar();
        void bPrim;
      }
    });
  }
  function pedirEliminar(inf, t) {
    const n = partidosDe(inf, t).length;
    K.confirmar(`¿Eliminar el torneo <b>${e(t.nombre)}</b>? ${n ? `Sus ${n} partido${n === 1 ? '' : 's'} no se borran: quedan sin torneo.` : ''} Podrás deshacerlo por unos segundos.`, 'Eliminar torneo', () => {
      K.conDeshacer('Torneo eliminado', () => { eliminar(inf, t); K.ui.torneoId = null; K.ui.partTab = 'torneos'; });
    });
  }

  /* ---------- Jugadores inscritos ---------- */
  function candidatos(inf, t) {
    const vistos = new Set(), out = [];
    catsDe(t, inf).forEach((c) => K.jugadoresDePartido(inf, { cat: c, fecha: ISO.test(t.desde || '') ? t.desde : '' }).forEach((x) => { if (!vistos.has(x.j.id)) { vistos.add(x.j.id); out.push(x); } }));
    return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es'));
  }
  function formJugadores(t) {
    const inf = K.inf(), ya = new Set((t.inscritos || []).map((x) => x.id)), cand = candidatos(inf, t);
    cand.forEach((c) => { c.sub = [c.j.categoria, c.j.posicion].filter(Boolean).join(' · '); });
    (t.inscritos || []).forEach((x) => { if (!cand.some((c) => c.j.id === x.id)) { const g = K.jugadorGlobal(x.id); if (g) cand.push({ j: g.j, inf: g.inf, sub: [g.j.categoria, g.j.posicion].filter(Boolean).join(' · ') + ' (fuera de las categorías)' }); } });
    const items = K.itemsSelJ(cand.map((c) => ({ j: c.j, sub: c.sub })));
    K.modal({
      titulo: 'Jugadores del torneo',
      cuerpo: `<p class="suave" style="margin:0 0 8px">Marca a los citados de ${e(catsTxt(t, inf))} que van al torneo. Los desmarcados salen de la lista.</p>
        <div class="selj-top"><input type="search" class="selj-q" data-tj-q placeholder="Buscar jugador…" autocomplete="off" aria-label="Buscar jugador"></div>
        <div class="fila gap wrap" style="margin:6px 0"><button type="button" class="btn sec chico" data-tj-todos>Marcar todos</button><button type="button" class="btn ghost chico" data-tj-nadie>Quitar todos</button><span class="suave" data-tj-n></span></div>
        <div class="selj-lista tn-lista" data-tj-lista>${items.length ? items.map((it) => `<label class="check tn-chk" data-tj-fila data-n="${e(K.norm(it.nombre + ' ' + (it.sub || '')))}"><input type="checkbox" data-tj="${e(it.jid)}"${ya.has(it.jid) ? ' checked' : ''}><span><b>${e(it.nombre)}</b>${it.sub ? ` <small class="suave">${e(it.sub)}</small>` : ''}${it.les ? ' <i class="chip g-grave etq">Lesionado</i>' : ''}</span></label>`).join('') : '<p class="vacio-msg">No hay jugadores en esas categorías.</p>'}</div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Guardar', fn: (m, hoja) => {
        const marcados = new Set(Array.from(hoja.querySelectorAll('[data-tj]:checked')).map((i) => i.dataset.tj)), previos = new Map((t.inscritos || []).map((x) => [x.id, x]));
        t.inscritos = items.filter((it) => marcados.has(it.jid)).map((it) => (previos.has(it.jid) ? previos.get(it.jid) : { id: it.jid }));
        K.guardar(); K.aviso(`${t.inscritos.length} jugador(es) inscrito(s)`); K.render();
      } }],
      alMontar: (m, hoja) => {
        const filas = Array.from(hoja.querySelectorAll('[data-tj-fila]')), cn = hoja.querySelector('[data-tj-n]');
        const visibles = () => filas.filter((f) => !f.classList.contains('oculto'));
        const contar = () => { const n = hoja.querySelectorAll('[data-tj]:checked').length; cn.textContent = n + ' marcado' + (n === 1 ? '' : 's'); };
        hoja.querySelector('[data-tj-q]').addEventListener('input', (ev) => { const tk = K.norm(ev.target.value).split(' ').filter(Boolean); filas.forEach((f) => f.classList.toggle('oculto', !tk.every((x) => f.dataset.n.includes(x)))); });
        hoja.querySelector('[data-tj-todos]').addEventListener('click', () => { visibles().forEach((f) => { f.querySelector('input').checked = true; }); contar(); });
        hoja.querySelector('[data-tj-nadie]').addEventListener('click', () => { visibles().forEach((f) => { f.querySelector('input').checked = false; }); contar(); });
        hoja.addEventListener('change', (ev) => { if (ev.target.matches('[data-tj]')) contar(); });
        contar();
      }
    });
  }
  function formLogistica(t) {
    K.modal({
      titulo: 'Viaje y logística · ' + t.nombre,
      cuerpo: `<label class="check"><input type="checkbox" name="viaje"${t.viaje ? ' checked' : ''}><span>Se juega fuera de la ciudad base (viaje)</span></label>${logCampos(t.logistica || {})}`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Guardar', fn: (m, hoja) => {
        const d = K.datos(hoja), inf = K.inf();
        t.logistica = leerLog(d); const cambio = t.viaje !== !!d.viaje; t.viaje = !!d.viaje;
        if (cambio) propagar(inf, t);
        K.guardar(); K.aviso('Guardado'); K.render();
      } }]
    });
  }

  /* ---------- Acciones ---------- */
  const tId = (el) => buscar(K.inf(), el.dataset.id);
  Object.assign(K.acciones, {
    torneoNuevo() { if (puedeEd()) formTorneo(null); },
    torneoAbrir(el, ev) { if (ev && ev.preventDefault) ev.preventDefault(); const t = tId(el); if (!t) return; K.ui.torneoId = t.id; K.ui.torneoTab = 'resumen'; K.ui.partidoId = null; K.render(); window.scrollTo(0, 0); },
    torneoVolver() { K.ui.torneoId = null; K.ui.partTab = 'torneos'; K.render(); window.scrollTo(0, 0); },
    torneoEditar(el) { const t = tId(el); if (t) formTorneo(t); },
    torneoEliminar(el, ev) { if (ev) ev.preventDefault(); const t = tId(el); if (t && puedeEd()) pedirEliminar(K.inf(), t); },
    torneoAddPartido(el) { const t = tId(el); if (t && puedeEd()) K.formPartido(null, { torneoId: t.id, fase: el.dataset.fase || '' }); },
    torneoJugadores(el) { const t = tId(el); if (t && puedeEd()) formJugadores(t); },
    torneoQuitarJ(el) { const t = tId(el); if (!t || !puedeEd()) return; t.inscritos = (t.inscritos || []).filter((x) => x.id !== el.dataset.j); K.guardar(); K.aviso('Quitado del torneo'); K.render(); },
    torneoNum(el) {
      const t = tId(el); if (!t || !puedeEd()) return;
      const x = (t.inscritos || []).find((q) => q.id === el.dataset.j); if (!x) return;
      const n = Math.round(Number(el.value));
      if (el.value !== '' && !(n >= 1 && n <= 99)) { K.aviso('El número va entre 1 y 99', true); el.value = x.num || ''; return; }
      if (el.value === '') delete x.num; else x.num = n;
      K.guardar(); K.aviso('Guardado');
    },
    torneoLogistica(el) { const t = tId(el); if (t && puedeEd()) formLogistica(t); },
    torneoSeguro(el) { const t = tId(el); if (t && puedeEd() && K.seguroNuevo) K.seguroNuevo({ pais: t.pais, cobertura: t.viaje ? 'Viaje' : 'Club', activacion: K.hoy() }); }
  });
  K.formTorneo = formTorneo;
  document.addEventListener('seg', (ev) => {
    const d = ev.target && ev.target.dataset && ev.target.dataset.seg;
    if (!ev.target.closest || !ev.target.closest('#view')) return;
    if (d === 'torneoTab') { K.ui.torneoTab = ev.detail; K.render(); }
    if (d === 'partTab') { K.ui.partTab = ev.detail; K.render(); }
  });
})();
