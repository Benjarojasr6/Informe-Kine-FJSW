/* Historial del jugador (v1.6, fase 2B): línea de tiempo con filtros, resumen de la ficha, ficha en PDF y CSV,
   datos para la lista de jugadores (lesionado / última atención) y buscador global.
   Todo se calcula al vuelo desde los registros que ya existen: no agrega campos nuevos a los datos. */
(function () {
  const K = window.K;
  const e = K.esc;
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const D = (iso) => new Date(iso + 'T12:00:00');
  const dif = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const fc = (iso) => (FECHA.test(iso || '') ? K.fechaCorta(iso) : 'Sin fecha');
  const dsum = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const coma = (n) => String(n).replace('.', ',');
  const ndias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
  const recorta = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
  const PAG = 30;                                   // registros por “página” en la línea de tiempo
  const TODO = { desde: '0000-01-01', hasta: '9999-12-31' };
  const SEG_TIPO = { control: 'Control médico', examen: 'Examen', procedimiento: 'Procedimiento', kinesiologia: 'Kinesiología', cirugia: 'Cirugía', hosp: 'Hospitalización' };
  const MOM = { pre: 'Pre partido', t1: '1.er tiempo', et: 'Entretiempo', t2: '2.º tiempo', post: 'Post partido' };
  // Tipos de registro (chips). Clave · rótulo · clase de color.
  const TIPOS = [['caso', 'Lesiones y molestias', 'les'], ['scat', 'Evaluaciones SCAT5', 'les'], ['hito', 'Altas y retornos', 'hi'], ['atencion', 'Atenciones', 'at'], ['control', 'Controles', 'ev'], ['examen', 'Exámenes', 'ev'],
    ['medicamento', 'Medicamentos', 'ev'], ['cirugia', 'Cirugías', 'ev'], ['partido', 'Partidos', 'pa'], ['seguro', 'Seguro', 'se'], ['club', 'Club y categoría', 'cl']];
  K.HIST_TIPOS = TIPOS;

  /* ======================= DATOS ======================= */
  // Días de baja acumulados hasta el 1 de enero del año Z (telescópico: la suma de todos los años da exactamente el total de la carrera).
  const acum = (c, z) => (c.tipo !== 'lesion' || !c.inicio || c.inicio >= z + '-01-01' ? 0 : K.diasBajaCaso(c, { desde: TODO.desde, hasta: z + '-01-01' }));
  K.diasBajaAnio = (c, y) => acum(c, y + 1) - acum(c, y);
  K.diasBajaCarrera = (c) => (c.tipo === 'lesion' && c.inicio ? K.diasBajaCaso(c, TODO) : 0);

  // Estado de todos los jugadores en una pasada: lesiones abiertas y fecha de la última atención.
  K.estadoJugadores = () => {
    const les = new Map(), ult = new Map();
    K.state.informes.forEach((inf) => {
      (inf.casos || []).forEach((c) => { if (c.tipo === 'lesion' && !c.alta) { const l = les.get(c.jugadorId); if (l) l.push(c); else les.set(c.jugadorId, [c]); } });
      (inf.atenciones || []).forEach((a) => { if (a.fecha && a.fecha > (ult.get(a.jugadorId) || '')) ult.set(a.jugadorId, a.fecha); });
    });
    return { les, ult };
  };
  // Mismo criterio que la pestaña Kine: lesión sin alta de un jugador inscrito y activo.
  K.esLesionado = (est, j) => !!j && est.les.has(j.id) && K.inscrito(j) && j.activo !== false;
  K.lesionesActivas = (jid) => { const g = K.jugadorGlobal(jid); if (!g || !K.inscrito(g.j) || g.j.activo === false) return []; return (g.inf.casos || []).filter((c) => c.jugadorId === jid && c.tipo === 'lesion' && !c.alta); };
  const diaLes = (c) => (c.inicio && FECHA.test(c.inicio) ? Math.max(1, dif(c.inicio, K.hoy())) : 0);

  const zn = (ids) => (ids || []).map((z) => K.nombreZona(z));
  const infoCaso = (c) => ({ casoId: c.id, zonas: (c.zonas || []).slice(), grav: K.gravClave(c.gravedad), recid: c.recidiva === true });
  const textoZonas = (c) => zn(c.zonas).join(', ');

  function construir(jid) {
    const gl = K.jugadorGlobal(jid); if (!gl) return null;
    const { j, inf } = gl, priv = K.verPrivado(), items = [], hoy = K.hoy();
    const casos = (inf.casos || []).filter((c) => c.jugadorId === jid), porId = new Map(casos.map((c) => [c.id, c]));
    const nuevo = (x, caso) => Object.assign({ id: '', f: '', k: '', tag: '', cls: '', titulo: '', sub: '', det: [], notas: '', casoId: '', zonas: [], temp: '', grav: '', recid: false, edit: '', raw: null }, x, caso || {});
    // ---- lesiones, molestias y sus altas / retornos
    casos.forEach((c) => {
      const en = K.bit.entCaso(c), les = c.tipo === 'lesion';
      const sub = [textoZonas(c), c.contexto, K.duracionCaso(c) === 'en curso' ? 'en curso' : K.duracionCaso(c), K.tejidosTxt(c, true), K.limitaTxt(c) ? 'limita entrenamiento: ' + K.limitaTxt(c) : ''].filter(Boolean).join(' · ');
      items.push(nuevo({ id: 'c' + c.id, f: FECHA.test(c.inicio || '') ? c.inicio : '', k: 'caso', tag: en.tag, cls: en.cls, titulo: c.titulo, sub, det: en.det, notas: en.notas, raw: c, edit: 'caso' }, infoCaso(c)));
      // cada evaluación SCAT5 (cancha, camarín, seguimiento) de una conmoción es una entrada propia
      const xs = c.conmocion === true && K.scat5 ? K.scat5.deCaso(c) : null;
      if (xs) {
        const sc = K.conmocion.limpiar(xs.inc.scat5) || {};
        K.scat5.ordenadas(sc.evals || []).forEach((ev) => {
          const mo = K.scat5.MOMENTOS.find((m) => m.k === ev.momento).t, rs = K.scat5.resumenEvalTxt(ev);
          items.push(nuevo({ id: 'sc' + ev.id, f: FECHA.test(ev.fecha || '') ? ev.fecha : (FECHA.test(xs.p.fecha || '') ? xs.p.fecha : ''), k: 'scat', tag: 'SCAT5', cls: 'les', titulo: 'Evaluación ' + mo.toLowerCase() + (ev.hora ? ' · ' + ev.hora : ''),
            sub: (rs || 'sin datos') + (ev.estado === 'final' ? '' : ' (borrador)'), det: [['Lesión', c.titulo], ['Momento', mo], ['Fecha y hora', [K.fechaCorta(ev.fecha || ''), ev.hora].filter(Boolean).join(' ')], ['Resultado', rs || 'sin datos']], raw: null }, infoCaso(c)));
        });
      }
      [['reintegroDesde', 'Inicio del reintegro deportivo'], ['alta', les ? 'Alta kinésica' : 'Alta'], ['altaMedica', 'Alta médica'], ['retornoEntreno', 'Retorno a entrenar con el grupo'], ['retornoPartido', 'Retorno a partido']].forEach(([campo, tag]) => {
        const f = c[campo]; if (!FECHA.test(f || '')) return;
        const n = c.inicio && FECHA.test(c.inicio) ? dif(c.inicio, f) : null;
        items.push(nuevo({ id: 'h' + campo + c.id, f, k: 'hito', tag, cls: 'hi', titulo: c.titulo, sub: (n != null && n >= 0 ? `${ndias(n)} desde el inicio` : '') + (textoZonas(c) ? (n != null && n >= 0 ? ' · ' : '') + textoZonas(c) : ''), raw: c, edit: 'caso' }, infoCaso(c)));
      });
    });
    // ---- atenciones
    (inf.atenciones || []).forEach((a) => {
      if (a.jugadorId !== jid) return;
      const en = K.bit.entAtencion(inf, a), c = a.casoId ? porId.get(a.casoId) : null;
      const tr = en.det.find((d) => d[0] === 'Intervenciones'), clase = K.nombreClase(a.clase);
      items.push(nuevo({ id: 'a' + a.id, f: FECHA.test(a.fecha || '') ? a.fecha : '', k: 'atencion', tag: 'Atención', cls: 'at', titulo: 'Atención kinésica', sub: [clase, tr && !/^Sin intervenciones/.test(tr[1]) ? tr[1] : '', c ? 'Lesión: ' + c.titulo : '', a.origen === 'externo' ? 'fuera de SW' : a.origen === 'gira' ? 'en gira' : ''].filter(Boolean).join(' · '),
        det: en.det, notas: en.notas, temp: a.temporada || '', raw: a, edit: 'atencion' }, c ? { casoId: c.id, zonas: (c.zonas || []).slice() } : null));
    });
    // ---- controles, exámenes, medicamentos y cirugías
    (inf.eventos || []).forEach((x) => {
      if (x.jugadorId !== jid || !K.evRealizado(x)) return;
      const en = K.bit.entEvento(inf, x), c = x.casoId ? porId.get(x.casoId) : null;
      const sub = [x.tipo === 'examen' && x.resultado ? 'resultado: ' + x.resultado : '', x.tipo === 'medicamento' ? `${Number(x.cantidad) || 1} ${(Number(x.cantidad) || 1) === 1 ? 'unidad' : 'unidades'}` : (Number(x.cantidad) > 1 ? '×' + x.cantidad : ''), c ? 'Lesión: ' + c.titulo : ''].filter(Boolean).join(' · ');
      items.push(nuevo({ id: 'e' + x.id, f: FECHA.test(x.fecha || '') ? x.fecha : '', k: x.tipo, tag: en.tag, cls: 'ev', titulo: en.titulo, sub, det: en.det, notas: en.notas, raw: x, edit: 'evento' }, c ? { casoId: c.id, zonas: (c.zonas || []).slice() } : null));
    });
    // ---- seguro (solo si puede ver datos privados)
    if (priv) {
      (inf.seguros || []).forEach((s) => {
        if (s.jugadorId !== jid) return;
        items.push(nuevo({ id: 's' + s.id, f: FECHA.test(s.activacion || '') ? s.activacion : '', k: 'seguro', tag: 'Seguro · activación', cls: 'se', titulo: s.diagnostico || 'Activación del seguro', sub: [s.clinica, s.nClinica ? 'N.º ' + s.nClinica : ''].filter(Boolean).join(' · '), det: [['Clínica', s.clinica || '—'], ['N.º de asistencia', s.nClinica || '—']] }));
      });
      (inf.segEventos || []).forEach((x) => {
        if (x.jugadorId !== jid) return;
        const t = SEG_TIPO[x.tipo] || x.tipo || 'Evento';
        items.push(nuevo({ id: 'v' + x.id, f: FECHA.test(x.fecha || '') ? x.fecha : '', k: 'seguro', tag: 'Seguro · ' + t, cls: 'se', titulo: x.detalle || t, sub: [x.tipo === 'examen' && x.resultado ? 'Resultado: ' + x.resultado : '', x.nAsist ? 'N.º ' + x.nAsist : ''].filter(Boolean).join(' · '), det: [['Tipo', t], ['Detalle', x.detalle || '—']].concat(x.resultado ? [['Resultado', x.resultado]] : []) }));
      });
    }
    // ---- partidos (de cualquier informe: un jugador puede jugar en otra categoría)
    K.state.informes.forEach((i) => (i.partidos || []).forEach((p) => {
      const min = Number((p.minutos || {})[jid]) || 0, incs = (p.incidencias || []).filter((x) => x.jugadorId === jid);
      if (!(min > 0) && !incs.length) return;
      const lineas = incs.map((x) => [MOM[x.momento] || 'Incidencia', [x.minuto !== '' && x.minuto != null ? `min ${x.minuto}'` : '', K.nombreClase(x.clase), x.zona ? K.nombreZona(x.zona) : '', x.enCancha ? 'atendido en cancha' : '', x.retiro ? 'se retiró' : ''].filter(Boolean).join(' · ')]);
      const conm = K.conmocion ? incs.filter((x) => x.scat5) : []; // sospechas de conmoción cerebral (SCAT5) de este partido
      conm.forEach((x) => lineas.push(['Conmoción cerebral (SCAT5)', K.conmocion.resumenTxt(x.scat5)]));
      const sub = [min > 0 ? `${min}'` : '', p.cat ? 'Sub ' + p.cat : '', p.torneo || '', p.local ? 'Local' : 'Visita', p.res || '', incs.length ? `${incs.length} incidencia${incs.length === 1 ? '' : 's'}` : '', conm.length ? 'sospecha de conmoción cerebral' : ''].filter(Boolean).join(' · ');
      items.push(nuevo({ id: 'p' + p.id, f: FECHA.test(p.fecha || '') ? p.fecha : '', k: 'partido', tag: 'Partido', cls: 'pa', titulo: 'vs ' + (p.rival || '—'), sub, zonas: incs.filter((x) => x.zona).map((x) => x.zona),
        det: [['Condición', p.local ? 'Local' : 'Visita']].concat(p.torneo ? [['Torneo', p.torneo]] : [], p.cat ? [['Categoría', 'Sub ' + p.cat]] : [], p.res ? [['Resultado', p.res]] : [], min > 0 ? [['Minutos jugados', min + ' min']] : [], lineas), notas: '', pmin: min, pjug: p.jugado !== false }));
    }));
    // ---- club y categoría
    const ch = (Array.isArray(j.catHist) ? j.catHist : []).filter((x) => x && Number.isFinite(Number(x.cat)) && (x.desde === '' || x.desde == null || FECHA.test(x.desde))).map((x) => ({ cat: Number(x.cat), desde: x.desde || '' })).sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
    ch.forEach((x, i) => { if (!x.desde) return; items.push(nuevo({ id: 'k' + i + j.id, f: x.desde, k: 'club', tag: 'Categoría', cls: 'cl', titulo: i ? `Pasó a Sub ${x.cat}` : `Categoría Sub ${x.cat}`, sub: i ? `Antes: Sub ${ch[i - 1].cat}` : '' })); });
    if (FECHA.test(j.ingreso || '')) items.push(nuevo({ id: 'ing' + j.id, f: j.ingreso, k: 'club', tag: 'Club', cls: 'cl', titulo: 'Ingreso al club' }));
    (Array.isArray(j.huecos) ? j.huecos : []).forEach((h, i) => {
      if (!h || !FECHA.test(h.desde || '') || !FECHA.test(h.hasta || '')) return;
      items.push(nuevo({ id: 'hb' + i + j.id, f: dsum(h.desde, -1), k: 'club', tag: 'Club', cls: 'cl', titulo: 'Baja temporal' }), nuevo({ id: 'hv' + i + j.id, f: dsum(h.hasta, 1), k: 'club', tag: 'Club', cls: 'cl', titulo: 'Volvió a inscribirse' }));
    });
    if (!K.inscrito(j)) items.push(nuevo({ id: 'sal' + j.id, f: K.salidaDe(j), k: 'club', tag: 'Club', cls: 'cl', titulo: 'Baja: ' + K.nombreEstado(j.estado), sub: j.motivoSalida || '' }));
    // ---- texto de búsqueda, orden y listas de los selectores
    items.forEach((it) => {
      it.zn = zn(it.zonas);
      it.q = K.norm([it.tag, it.titulo, it.sub, it.notas, it.zn.join(' '), K.nombreTemporada(it.temp)].concat(it.det.map((d) => d[0] + ' ' + d[1])).join(' '));
    });
    const ORD = { club: 0, caso: 1, scat: 1.5, hito: 2, atencion: 3, control: 4, examen: 5, medicamento: 6, cirugia: 7, partido: 8, seguro: 9 };
    items.sort((a, b) => b.f.localeCompare(a.f) || (ORD[b.k] || 0) - (ORD[a.k] || 0));
    const zonas = Array.from(new Set([].concat(...items.map((it) => it.zn)))).sort((a, b) => a.localeCompare(b, 'es'));
    const cuenta = {}; items.forEach((it) => { cuenta[it.k] = (cuenta[it.k] || 0) + 1; });
    const anios = Array.from(new Set(items.filter((it) => it.f).map((it) => it.f.slice(0, 4)))).sort().reverse();
    const periodos = K.TEMPORADAS.filter(([k]) => items.some((it) => it.temp === k));
    return { jid, j, inf, items, casos: casos.slice().sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '')), zonas, cuenta, anios, periodos, hoy };
  }
  K.histItems = (jid) => construir(jid);

  /* ---------- Filtros ---------- */
  const vacio = (jid) => ({ jid, tipos: [], caso: '', zona: '', anio: '', per: '', q: '', n: PAG });
  const estado = (jid) => { if (!K.ui.hist || K.ui.hist.jid !== jid) K.ui.hist = vacio(jid); return K.ui.hist; };
  K.histEstado = estado;
  const hayFiltro = (s) => !!(s.tipos.length || s.caso || s.zona || s.anio || s.per || (s.q || '').trim());
  K.histFiltrar = (data, s) => {
    const tk = K.norm(s.q || '').split(' ').filter(Boolean), ts = s.tipos.length ? new Set(s.tipos) : null;
    return data.items.filter((it) => (!ts || ts.has(it.k)) && (!s.caso || it.casoId === s.caso) && (!s.zona || it.zn.includes(s.zona)) && (!s.anio || it.f.slice(0, 4) === s.anio) && (!s.per || it.temp === s.per) && tk.every((t) => it.q.includes(t)));
  };
  const descFiltro = (data, s) => {
    const p = [];
    if (s.tipos.length) p.push(s.tipos.map((k) => (TIPOS.find((t) => t[0] === k) || [0, k])[1]).join(', '));
    if (s.caso) { const c = data.casos.find((x) => x.id === s.caso); if (c) p.push('Lesión: ' + c.titulo); }
    if (s.zona) p.push('Zona: ' + s.zona);
    if (s.anio) p.push('Año ' + s.anio);
    if (s.per) p.push(K.nombreTemporada(s.per));
    if ((s.q || '').trim()) p.push(`Texto «${s.q.trim()}»`);
    return p.join(' · ');
  };

  /* ======================= LÍNEA DE TIEMPO (pantalla) ======================= */
  const chipsCaso = (it) => `<i class="chip g-${it.grav}" data-grav>${e(K.GRAVEDADES[it.grav])}</i>${it.recid ? '<i class="chip rec" data-recid>Recidiva</i>' : ''}`;
  function itemHTML(it, i, edit) {
    const lesion = it.k === 'caso' || it.k === 'hito';
    const det = it.det.length || it.notas ? `<details class="th-det"><summary>Ver detalle</summary><dl>${it.det.map(([l, v]) => `<div><dt>${e(l)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>${it.notas ? `<p class="bit-n"><b>Notas:</b> ${e(it.notas).replace(/\n/g, '<br>')}</p>` : ''}</details>` : '';
    return `<div class="th-it" data-k="${it.k}"><div class="th-f"><b>${FECHA.test(it.f || '') ? K.fechaCorta(it.f) : '—'}</b></div>
      <div class="th-c"><div class="th-h"><span class="bit-tag t-${it.cls}">${e(it.tag)}</span><b>${e(it.titulo)}</b></div>
        ${lesion ? `<div class="th-ch">${chipsCaso(it)}</div>` : ''}${it.sub ? `<p class="th-s">${e(it.sub)}</p>` : ''}${det}${it.k === 'caso' && it.raw && it.raw.conmocion === true && K.scat5 && K.scat5.deCaso(it.raw) ? `<button type="button" class="btn sec chico sc-pdf-btn" data-scat-pdf-tl="${e(it.raw.id)}">${K.uiIco('pdf', 16)} Ficha SCAT5 (PDF)</button>` : ''}</div>
      ${edit && it.edit ? `<button type="button" class="btn ghost chico th-ed" data-acc="histAbrir" data-i="${i}" aria-label="Abrir para editar" title="Abrir para editar">${K.uiIco('editar', 18)}</button>` : ''}</div>`;
  }
  function listaHTML(lista, s) {
    const edit = K.puedeEditar(), vis = lista.slice(0, s.n);
    let mes = '', h = '';
    vis.forEach((it, i) => {
      const m = it.f ? K.nombreMesLargo(it.f) : 'Sin fecha';
      if (m !== mes) { mes = m; h += `<h3 class="bit-mes">${e(m)}</h3>`; }
      h += itemHTML(it, i, edit);
    });
    if (lista.length > s.n) h += `<div class="th-mas"><button type="button" class="btn sec" data-acc="histMas">Ver más <small>(${lista.length - s.n} restantes)</small></button></div>`;
    return h || '<p class="vacio-msg">No hay registros con estos filtros.</p>';
  }
  const cabCuenta = (lista, data, s) => `${lista.length === data.items.length ? data.items.length : lista.length + ' de ' + data.items.length} registro${lista.length === 1 ? '' : 's'}${s.n < lista.length ? ` · se ven ${s.n}` : ''}`;
  K.histCard = function (inf, j) {
    const data = construir(j.id); if (!data) return '';
    K._hc = data;
    const s = estado(j.id), lista = K.histFiltrar(data, s); K._histVista = lista;
    const chips = [`<button type="button" class="th-chip${s.tipos.length ? '' : ' on'}" data-acc="histChip" data-v="" aria-pressed="${!s.tipos.length}">Todo <small>${data.items.length}</small></button>`]
      .concat(TIPOS.filter(([k]) => data.cuenta[k]).map(([k, t]) => `<button type="button" class="th-chip${s.tipos.includes(k) ? ' on' : ''}" data-acc="histChip" data-v="${k}" aria-pressed="${s.tipos.includes(k)}">${e(t)} <small>${data.cuenta[k]}</small></button>`)).join('');
    const sel = (k, rotulo, ops, val) => `<label class="campo"><span>${rotulo}</span><select data-acc-change="histSel" data-k="${k}">${ops}</select></label>`;
    const opCaso = '<option value="">Todas</option>' + data.casos.map((c) => `<option value="${e(c.id)}"${s.caso === c.id ? ' selected' : ''}>${e(c.titulo)} · ${e(c.tipo === 'lesion' ? 'lesión' : 'molestia')} · ${e(fc(c.inicio))}</option>`).join('');
    const opZona = '<option value="">Todas</option>' + data.zonas.map((z) => `<option${s.zona === z ? ' selected' : ''}>${e(z)}</option>`).join('');
    const opAnio = '<option value="">Todas</option>' + data.anios.map((a) => `<option${s.anio === a ? ' selected' : ''}>${e(a)}</option>`).join('');
    const opPer = '<option value="">Todos</option>' + data.periodos.map(([k, t]) => `<option value="${k}"${s.per === k ? ' selected' : ''}>${e(t)}</option>`).join('');
    return `<div class="card" data-hist>
      <div class="fila sb wrap gap"><h2 style="margin:0">Historial completo</h2><span class="suave" data-hist-n>${cabCuenta(lista, data, s)}</span></div>
      <p class="sub" style="margin:2px 0 8px">Todo lo del jugador en orden cronológico inverso: lesiones, altas y retornos, atenciones, controles, exámenes, medicamentos, cirugías, partidos${K.verPrivado() ? ', seguro' : ''} y cambios de categoría. Puedes activar varios tipos a la vez.</p>
      <div class="th-chips" role="group" aria-label="Tipos de registro">${chips}</div>
      <div class="th-filtros">${sel('caso', 'Lesión o caso', opCaso)}${sel('zona', 'Zona del cuerpo', opZona)}${sel('anio', 'Temporada (año)', opAnio)}${data.periodos.length ? sel('per', 'Período de la temporada', opPer) : ''}</div>
      <input type="search" class="th-q" value="${e(s.q || '')}" placeholder="Buscar en el historial (ej. rodilla, RNM, ibuprofeno…)" data-acc-input="histQ" aria-label="Buscar en el historial" autocomplete="off">
      <p class="suave th-quitar" style="margin:6px 2px"${hayFiltro(s) ? '' : ' hidden'}><a href="#" data-acc="histLimpiar">Quitar filtros</a></p>
      <div id="hist-lista">${listaHTML(lista, s)}</div></div>`;
  };
  // Vuelve a dibujar solo la lista (y los chips/contadores), sin perder el foco del buscador.
  function refrescarLista() {
    const card = document.querySelector('[data-hist]'), data = K._hc; if (!card || !data) return;
    const s = estado(data.jid), lista = K.histFiltrar(data, s); K._histVista = lista;
    card.querySelector('#hist-lista').innerHTML = listaHTML(lista, s);
    const n = card.querySelector('[data-hist-n]'); if (n) n.textContent = cabCuenta(lista, data, s);
    card.querySelectorAll('[data-acc=histChip]').forEach((b) => { const on = b.dataset.v ? s.tipos.includes(b.dataset.v) : !s.tipos.length; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const q = card.querySelector('.th-quitar'); if (q) q.hidden = !hayFiltro(s);
  }
  Object.assign(K.acciones, {
    histChip(el) {
      const s = estado(K._hc.jid), v = el.dataset.v;
      if (!v) s.tipos = []; else s.tipos = s.tipos.includes(v) ? s.tipos.filter((x) => x !== v) : s.tipos.concat([v]);
      s.n = PAG; refrescarLista();
    },
    histSel(el) { const s = estado(K._hc.jid); s[el.dataset.k] = el.value; s.n = PAG; refrescarLista(); },
    histQ(el) { const s = estado(K._hc.jid); s.q = el.value; s.n = PAG; clearTimeout(K._histT); K._histT = setTimeout(refrescarLista, 120); },
    histMas() { const s = estado(K._hc.jid); s.n += PAG; refrescarLista(); },
    histLimpiar(el, ev) {
      if (ev) ev.preventDefault();
      const jid = K._hc.jid; K.ui.hist = vacio(jid);
      const card = document.querySelector('[data-hist]');
      if (card) { card.querySelectorAll('select[data-acc-change=histSel]').forEach((x) => { x.value = ''; }); const q = card.querySelector('.th-q'); if (q) q.value = ''; }
      refrescarLista();
    },
    histAbrir(el) {
      const it = (K._histVista || [])[Number(el.dataset.i)]; if (!it || !it.raw || !K.puedeEditar()) return;
      if (it.edit === 'caso') K.formCaso({ rec: it.raw }); else if (it.edit === 'atencion') K.formAtencion({ rec: it.raw }); else if (it.edit === 'evento') K.formEvento(it.raw.tipo, { rec: it.raw });
    },
    fichaPdf() { K.formFichaPdf(K.ui.jugadorId); },
    fichaCsv() { K.fichaCsv(K.ui.jugadorId); }
  });

  /* ======================= RESUMEN DE LA FICHA ======================= */
  // { activas, diasTemporada, diasCarrera, anio, nLes, nMol, zonas:[{nombre,n}], reinc:[{nombre,n}], porAnio:[{anio,les,dias,at,pj,min}], sinFecha }
  K.resumenJugador = function (jid, anioTemp) {
    const gl = K.jugadorGlobal(jid); if (!gl) return null;
    const { j, inf } = gl, anio = Number(anioTemp) || new Date().getFullYear();
    const casos = (inf.casos || []).filter((c) => c.jugadorId === jid), les = casos.filter((c) => c.tipo === 'lesion');
    const ats = (inf.atenciones || []).filter((a) => a.jugadorId === jid);
    const part = [];
    K.state.informes.forEach((i) => (i.partidos || []).forEach((p) => { const m = Number((p.minutos || {})[jid]) || 0; if (m > 0 && p.jugado !== false) part.push({ f: p.fecha || '', m }); }));
    const anios = new Set([new Date().getFullYear(), anio]);
    les.forEach((c) => { if (c.inicio) anios.add(Number(c.inicio.slice(0, 4))); });
    ats.forEach((a) => { if (a.fecha) anios.add(Number(a.fecha.slice(0, 4))); });
    part.forEach((p) => { if (p.f) anios.add(Number(p.f.slice(0, 4))); });
    const ys = Array.from(anios).filter((y) => y > 1980 && y < 2200).sort((a, b) => b - a);
    const porAnio = ys.map((y) => {
      const pa = part.filter((p) => p.f.slice(0, 4) === String(y));
      return { anio: y, les: les.filter((c) => (c.inicio || '').slice(0, 4) === String(y)).length, dias: les.reduce((t, c) => t + K.diasBajaAnio(c, y), 0), at: ats.filter((a) => (a.fecha || '').slice(0, 4) === String(y)).length, pj: pa.length, min: pa.reduce((t, p) => t + p.m, 0) };
    });
    const z = new Map(); les.forEach((c) => new Set(zn(c.zonas)).forEach((n) => z.set(n, (z.get(n) || 0) + 1)));
    const zonas = Array.from(z, ([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
    return {
      j, inf, anio, activas: K.lesionesActivas(jid).map((c) => ({ c, dia: diaLes(c), zona: textoZonas(c) })),
      diasTemporada: les.reduce((t, c) => t + K.diasBajaAnio(c, anio), 0), diasCarrera: les.reduce((t, c) => t + K.diasBajaCarrera(c), 0),
      nLes: les.length, nMol: casos.length - les.length, zonas, reinc: zonas.filter((x) => x.n >= 2), porAnio, sinFecha: part.filter((p) => !p.f).length
    };
  };
  const tablaAnios = (r) => `<table class="fr-t"><thead><tr><th>Año</th><th>Lesiones</th><th>Días perdidos</th><th>Atenciones</th><th>Partidos (min)</th></tr></thead><tbody>${r.porAnio.map((x) => `<tr data-anio="${x.anio}"><td><b>${x.anio}</b></td><td>${x.les}</td><td>${x.dias}</td><td>${x.at}</td><td>${x.pj}${x.pj ? ` <span class="suave">(${x.min})</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
  K.fichaResumen = function (inf, j) {
    const r = K.resumenJugador(j.id, K.anioVista()); if (!r) return '';
    const act = r.activas.map((a) => `<span class="fr-les" data-lesionado><b>Lesionado · día ${a.dia || '—'}</b>${a.c.conmocion ? '<i class="chip g-grave" data-conmocion>Conmoción</i>' : ''}${a.zona ? `<small>${e(a.zona)}</small>` : `<small>${e(a.c.titulo)}</small>`}</span>`).join('');
    const kpi = (n, t, id) => `<div class="fr-k"${id ? ` data-k="${id}"` : ''}><b>${n}</b><span>${t}</span></div>`;
    const reinc = r.reinc.map((x) => `<p class="fr-reinc" data-reinc><b>${x.n} lesiones en ${e(x.nombre.charAt(0).toLowerCase() + x.nombre.slice(1))}</b> · reincidencia: conviene revisar la prevención de esa zona.</p>`).join('');
    return `<div class="card fr" data-resumen>
      ${act ? `<div class="fr-act">${act}</div>` : ''}
      <div class="fr-kpis">${kpi(r.diasTemporada, 'días perdidos ' + r.anio, 'dias-temp')}${kpi(r.diasCarrera, 'días perdidos en su carrera', 'dias-carrera')}${kpi(r.nLes, 'lesiones en su carrera', 'les')}${kpi(r.nMol, 'molestias en su carrera', 'mol')}</div>
      ${reinc}
      ${r.zonas.length ? `<div class="fr-zonas"><span class="suave">Lesiones por zona:</span>${r.zonas.map((x) => `<i class="chip${x.n >= 2 ? ' g-moderada' : ''}" data-zona="${e(x.nombre)}">${e(x.nombre)} ×${x.n}</i>`).join('')}</div>` : ''}
      <details class="fr-det" open><summary>Por temporada</summary>${tablaAnios(r)}${r.sinFecha ? `<p class="suave" style="margin:4px 0 0;font-size:13px">${r.sinFecha} partido${r.sinFecha === 1 ? '' : 's'} sin fecha no se cuenta${r.sinFecha === 1 ? '' : 'n'} en esta tabla.</p>` : ''}</details>
      <div class="fila gap wrap" style="margin-top:10px"><button type="button" class="btn chico" data-acc="fichaPdf">${K.uiIco('pdf', 16)} Descargar ficha (PDF)</button><button type="button" class="btn sec chico" data-acc="fichaCsv">${K.uiIco('descargar', 16)} Descargar historial (CSV)</button></div>
    </div>`;
  };

  /* ======================= CSV ======================= */
  // Nombre corto para los archivos: primer nombre + primer apellido.
  K.nombreCorto = (j) => {
    if (j.nombres && j.apellido1) return (j.nombres.trim().split(/\s+/)[0] + ' ' + j.apellido1.trim()).trim();
    const w = String(j.nombre || 'Jugador').trim().split(/\s+/);
    return w.length >= 3 ? w[0] + ' ' + w[w.length - 2] : w.join(' ');
  };
  const sinTildes = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  K.fichaCsvFilas = function (jid, usarFiltros) {
    const data = construir(jid); if (!data) return null;
    const s = estado(jid), lista = (usarFiltros === false ? data.items : K.histFiltrar(data, s)).slice().sort((a, b) => a.f.localeCompare(b.f));
    const filas = [['Fecha', 'Tipo', 'Título', 'Detalle', 'Gravedad', 'Recidiva', 'Zona', 'Lesión asociada', 'Período de la temporada', 'Notas']].concat(lista.map((it) => {
      const c = it.casoId ? data.casos.find((x) => x.id === it.casoId) : null, lesion = it.k === 'caso' || it.k === 'hito';
      return [it.f ? K.fechaCorta(it.f) : '', it.tag, it.titulo, it.det.map(([l, v]) => `${l}: ${v}`).join(' | ') || it.sub, lesion ? K.GRAVEDADES[it.grav] : '', lesion ? (it.recid ? 'Sí' : 'No') : '', it.zn.join(', '), c && it.k !== 'caso' ? c.titulo : '', K.nombreTemporada(it.temp), it.notas];
    }));
    return { filas, n: lista.length, total: data.items.length, j: data.j };
  };
  K.fichaCsv = function (jid) {
    const r = K.fichaCsvFilas(jid); if (!r) return;
    K.descargarCSV(r.filas, `Historial - ${sinTildes(K.nombreCorto(r.j))} - ${K.hoy()}.csv`);
    K.aviso(r.n === r.total ? 'Historial descargado (ábrelo con Excel)' : `Historial descargado: ${r.n} de ${r.total} registros (los que se ven con los filtros)`);
  };

  /* ======================= FICHA EN PDF ======================= */
  const ESC = '<img class="sw-vs" src="img/escudo-sw-vs.png" alt="" width="35" height="56">';
  const campo = (l, v, c) => (v === '' || v == null ? '' : `<div${c ? ` class="${c}"` : ''}><dt>${e(l)}</dt><dd>${v}</dd></div>`);
  const edadTxt = (j) => { const n = K.edadAnios(j.nacimiento); return n != null ? `${n} años (nació en ${e(String(j.nacimiento).slice(0, 4))}${j.excepcion ? ' · ' + e(j.excepcionNota ? 'excepción: ' + j.excepcionNota : 'excepción') : ''})` : ''; };
  function bloqueDatos(data, fechaTxt) {
    const j = data.j, inf = data.inf, ini = (j.nombre || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    const ch = (Array.isArray(j.catHist) ? j.catHist : []).filter((x) => x && Number.isFinite(Number(x.cat))).slice().sort((a, b) => String(a.desde || '').localeCompare(String(b.desde || '')));
    const hist = ch.length ? ch.map((x, i) => `Sub ${Number(x.cat)}${x.desde ? ' desde ' + e(K.fechaCorta(x.desde)) : i ? '' : ' (inicial)'}`).join(' → ') : '';
    const estadoTxt = K.inscrito(j) ? `Inscrito${FECHA.test(j.ingreso || '') ? ' desde ' + e(K.fechaCorta(j.ingreso)) : ''}` : `${e(K.nombreEstado(j.estado))} el ${e(K.fechaCorta(K.salidaDe(j)))}${j.motivoSalida ? ' · ' + e(j.motivoSalida) : ''}`;
    const foto = j.foto ? `<img src="${e(j.foto)}" alt="">` : `<span>${e(ini)}</span>`;
    return `<div class="fj-cab">${ESC}<div class="fj-cab-t"><h1>${e(j.nombre)}</h1><p>Ficha clínica del jugador · Santiago Wanderers · Kinesiología Fútbol Joven</p><p>${e(fechaTxt)}</p></div><div class="fj-foto">${foto}</div></div>
      <div class="fj-card"><h3>Datos del jugador</h3><dl class="fj-dl">${campo('Pertenece a', e(j.categoria || '—'))}${campo('Edad', edadTxt(j))}${campo('Posición', e(j.posicion || ''))}${campo('Pierna dominante', e(j.pierna || ''))}
        ${campo('Estado en el club', estadoTxt)}${campo('Jugador de plantel', j.contrato ? 'Sí' : '')}${campo('También juega en', e((j.tambien || []).filter((x) => x !== j.categoria).join(', ')))}${campo('Historial de categorías', hist, 'x')}</dl></div>`;
  }
  const imc = (talla, peso) => (talla > 0 && peso > 0 ? Math.round((peso / Math.pow(talla / 100, 2)) * 10) / 10 : null);
  function bloqueAntecedentes(data) {
    const a = K.antecedentesDe(data.inf, data.jid); if (!a) return '';
    const an = (a.antropometria || []).slice().sort((x, y) => (x.fecha || '').localeCompare(y.fecha || '')), u = an[an.length - 1], m = u ? imc(u.talla, u.peso) : null;
    const t = (x) => (String(x || '').trim() ? e(x).replace(/\n/g, '<br>') : '');
    const filas = campo('Grupo sanguíneo', e(a.grupoSanguineo || '')) + campo('Alergias', t(a.alergias)) + campo('Enfermedades', t(a.enfermedades)) + campo('Medicación habitual', t(a.medicacionHabitual)) + campo('Lesiones previas (otros clubes)', t(a.lesionesPrevias)) + campo('Cirugías previas', t(a.cirugiasPrevias))
      + campo('Última medición', u ? `${u.talla !== '' && u.talla != null ? 'Talla ' + coma(u.talla) + ' cm' : ''}${u.peso !== '' && u.peso != null ? ' · Peso ' + coma(u.peso) + ' kg' : ''}${m ? ' · IMC ' + coma(m) : ''}${u.fecha ? ' (' + e(K.fechaCorta(u.fecha)) + ')' : ''}` : '')
      + campo('Apoderado', e([a.apoderado, a.telefonoApoderado].filter(Boolean).join(' · '))) + campo('Contacto de emergencia', e([a.contactoEmergencia, a.telefonoEmergencia].filter(Boolean).join(' · ')));
    return filas ? `<div class="fj-card"><h3>Antecedentes y datos de contacto <small class="fj-conf">confidencial</small></h3><dl class="fj-dl">${filas}</dl></div>` : '';
  }
  function bloquesResumen(r) {
    const kpi = (n, t) => `<div class="fj-k"><b>${n}</b><span>${t}</span></div>`;
    const act = r.activas.length ? `<p class="fj-alerta">${r.activas.map((a) => `<b>Lesionado · día ${a.dia || '—'}</b>${a.c.conmocion ? ' · <b>Conmoción cerebral</b>' : ''}${a.zona ? ' (' + e(a.zona) + ')' : ''}`).join(' · ')}</p>` : '';
    const reinc = r.reinc.map((x) => `<p class="fj-aviso"><b>${x.n} lesiones en ${e(x.nombre.charAt(0).toLowerCase() + x.nombre.slice(1))}</b> · reincidencia en la misma zona.</p>`).join('');
    const zonas = r.zonas.length ? `<p class="fj-zonas"><b>Lesiones por zona:</b> ${r.zonas.map((x) => `${e(x.nombre)} ×${x.n}`).join(' · ')}</p>` : '';
    return [`<div class="fj-card"><h3>Resumen</h3>${act}<div class="fj-kpis">${kpi(r.diasTemporada, 'días perdidos ' + r.anio)}${kpi(r.diasCarrera, 'días perdidos en su carrera')}${kpi(r.nLes, 'lesiones')}${kpi(r.nMol, 'molestias')}</div>${reinc}${zonas}</div>`,
      `<div class="fj-card"><h3>Por temporada</h3><table class="kn-t"><thead><tr><th>Año</th><th class="n">Lesiones</th><th class="n">Días perdidos</th><th class="n">Atenciones</th><th class="n">Partidos (min)</th></tr></thead><tbody>${r.porAnio.map((x) => `<tr><td><b>${x.anio}</b></td><td class="n">${x.les}</td><td class="n">${x.dias}</td><td class="n">${x.at}</td><td class="n">${x.pj}${x.pj ? ` (${x.min})` : ''}</td></tr>`).join('')}</tbody></table>${r.sinFecha ? `<p class="fj-nota">${r.sinFecha} partido${r.sinFecha === 1 ? '' : 's'} sin fecha no se cuenta${r.sinFecha === 1 ? '' : 'n'} en esta tabla.</p>` : ''}</div>`];
  }
  function bloquesCaso(c, data) {
    const les = c.tipo === 'lesion', g = K.gravClave(c.gravedad), out = [];
    const dret = (campoF) => { const n = K.diasHasta(c, campoF); return `${e(K.fechaCorta(c[campoF]))}${n != null ? ` <span class="suave">(${ndias(n)} desde el inicio)</span>` : ''}`; };
    const dur = K.duracionCaso(c);
    const filas = campo('Inicio', c.inicio ? e(K.fechaCorta(c.inicio)) : '—') + campo(les ? 'Alta kinésica' : 'Alta', c.alta ? e(K.fechaCorta(c.alta)) : les ? 'En curso' : '—') + campo('Inicio del reintegro deportivo', c.reintegroDesde ? e(K.fechaCorta(c.reintegroDesde)) : '') + campo('Alta médica', c.altaMedica ? e(K.fechaCorta(c.altaMedica)) : '')
      + campo('Retorno a entrenar con el grupo', c.retornoEntreno ? dret('retornoEntreno') : '') + campo('Retorno a partido', c.retornoPartido ? dret('retornoPartido') : '')
      + campo('Días de baja', les && c.inicio ? String(K.diasBajaCarrera(c)) : '') + campo('Duración', dur && dur !== 'en curso' ? e(dur) : '') + campo('Zona', e(textoZonas(c)))
      + campo(K.tejidosDe(c).length > 1 ? 'Tejidos' : 'Tejido', e(K.tejidosTxt(c))) + campo('Contacto', c.contacto ? e((K.CONTACTOS.find((t) => t[0] === c.contacto) || [0, c.contacto])[1]) : '')
      + campo('Dolor al inicio (EVA)', c.eva != null && c.eva !== '' ? e(c.eva) + ' / 10' : '') + campo('Ocurrió en', e(K.ocurrioTxt(c))) + campo('Contexto', e(c.contexto || '')) + campo('Terreno', e(c.terreno || ''))
      + campo('Limita entrenamiento', e(K.limitaTxt(c))) + campo(K.origenRotulo(c), e(K.origenCasoTxt(c)));
    const notas = c.notas ? `<p class="fj-crit"><b>Notas:</b> ${e(recorta(c.notas, 900)).replace(/\n/g, '<br>')}</p>` : '';
    const cm = c.conmocion === true && K.conmocion ? `<p class="fj-crit fj-cm"><b>Conmoción cerebral (registro SCAT5 del partido):</b> ${K.conmocion.detalleCaso(c).slice(1).map(([l, v]) => `<br><b>${e(l.replace(/^Conmoción · /, ''))}:</b> ${e(recorta(v, 300))}`).join('') || 'sin más datos'}</p>` : '';
    out.push(`<div class="fj-caso"><div class="fj-caso-h"><b>${e(c.titulo)}</b><span class="fj-ch"><i class="chip">${les ? 'Lesión' : 'Molestia'}</i><i class="chip g-${g}">${e(K.GRAVEDADES[g])}</i>${c.recidiva === true ? '<i class="chip rec">Recidiva</i>' : ''}</span></div><dl class="fj-dl fj-dl3">${filas}</dl>${cm}${notas}</div>`);
    return out;
  }
  function bloquesCirugias(data) {
    const ev = data.items.filter((it) => it.k === 'cirugia').sort((a, b) => a.f.localeCompare(b.f));
    if (!ev.length) return [];
    const filas = ev.map((it) => { const c = it.casoId ? data.casos.find((x) => x.id === it.casoId) : null; return `<tr><td>${it.f ? e(K.fechaCorta(it.f)) : '—'}</td><td><b>${e(it.titulo)}</b>${it.notas ? `<small>${e(recorta(it.notas, 240))}</small>` : ''}</td><td>${e(c ? c.titulo : '—')}</td></tr>`; });
    const out = [];
    for (let i = 0; i < filas.length; i += 8) out.push(`<div class="fj-card"><h3>Cirugías${i ? ' <small>(cont.)</small>' : ''}</h3><table class="kn-t"><thead><tr><th>Fecha</th><th>Cirugía</th><th>Lesión asociada</th></tr></thead><tbody>${filas.slice(i, i + 8).join('')}</tbody></table></div>`);
    return out;
  }
  function bloquesSeguro(data) {
    const inf = data.inf, segs = (inf.seguros || []).filter((s) => s.jugadorId === data.jid).sort((a, b) => (b.activacion || '').localeCompare(a.activacion || ''));
    const evs = (inf.segEventos || []).filter((x) => x.jugadorId === data.jid);
    if (!segs.length && !evs.length) return [];
    const out = [];
    segs.forEach((s) => {
      const mios = evs.filter((x) => (x.seguroId ? x.seguroId === s.id : segs[segs.length - 1] === s)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const cab = `<b>${e(s.diagnostico || 'Sin diagnóstico')}</b><small>${s.activacion ? 'Activado el ' + e(K.fechaCorta(s.activacion)) : 'Sin fecha de activación'}${s.clinica ? ' · ' + e(s.clinica) : ''}${s.nClinica ? ' · N.º ' + e(s.nClinica) : ''}</small>`;
      const fila = (x) => `<tr><td>${x.fecha ? e(K.fechaCorta(x.fecha)) : '—'}</td><td>${e(SEG_TIPO[x.tipo] || x.tipo || '')}</td><td>${e(x.detalle || '')}${x.tipo === 'examen' && x.resultado ? `<small>Resultado: ${e(x.resultado)}</small>` : ''}</td></tr>`;
      if (!mios.length) out.push(`<div class="fj-card"><h3>Seguro</h3><p class="fj-seg">${cab}</p><p class="fj-nota">Sin eventos.</p></div>`);
      for (let i = 0; i < Math.max(1, mios.length); i += 8) {
        if (!mios.length) break;
        out.push(`<div class="fj-card"><h3>Seguro${i ? ' <small>(cont.)</small>' : ''}</h3><p class="fj-seg">${cab}</p><table class="kn-t"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>${mios.slice(i, i + 8).map(fila).join('')}</tbody></table></div>`);
      }
    });
    return out;
  }
  // Fila compacta de la línea de tiempo en el PDF
  function filaPdf(it) {
    const lesion = it.k === 'caso' || it.k === 'hito';
    const inc = it.k === 'partido' ? it.det.filter((d) => !['Condición', 'Torneo', 'Categoría', 'Resultado', 'Minutos jugados'].includes(d[0])).map(([l, v]) => `<div class="fj-n"><b>${e(l)}:</b> ${e(v)}</div>`).join('') : '';
    const notas = it.notas ? `<div class="fj-n"><b>Notas:</b> ${e(recorta(it.notas, 260))}</div>` : '';
    return `<div class="fj-it"><span class="fj-f">${it.f ? e(K.fechaCorta(it.f)) : 'Sin fecha'}</span><span class="bit-tag fj-tg t-${it.cls}">${e(it.tag)}</span><div class="fj-c"><b>${e(it.titulo)}</b>${lesion ? ` <span class="fj-ch">${chipsCaso(it)}</span>` : ''}${it.sub ? `<div class="fj-s">${e(recorta(it.sub, 220))}</div>` : ''}${inc}${notas}</div></div>`;
  }

  /* ---- Paginación por altura medida ---- */
  // bloques: [html]. Devuelve una lista de páginas (cada una, lista de html). La página 1 empieza con su propia cabecera (parte del primer bloque);
  // las siguientes llevan la cabecera corta. Los bloques nunca se parten.
  // Envoltorio de cada bloque: las filas de la línea de tiempo van más juntas.
  const envolver = (b) => `<div class="${/^<(h4 class="fj-mes"|div class="fj-it")/.test(b) ? 'fj-blq fj-blq-s' : 'fj-blq'}">${b}</div>`;
  function repartir(bloques, cabCorta) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:816px;visibility:hidden;pointer-events:none';
    host.innerHTML = K.rep.pagina('p-resumen p-equipo fj', '<h2>Ficha</h2><div class="fj-cuerpo"></div>');
    document.body.appendChild(host);
    try {
      const sec = host.firstElementChild, panel = sec.querySelector('.panel'), cuerpo = sec.querySelector('.fj-cuerpo');
      const cs = getComputedStyle(panel), padB = parseFloat(cs.paddingBottom) || 63;
      const top = cuerpo.getBoundingClientRect().top - sec.getBoundingClientRect().top;
      const cap = Math.floor(sec.getBoundingClientRect().height - padB - top) - 10; // margen de seguridad
      cuerpo.innerHTML = [cabCorta].concat(bloques).map(envolver).join('');
      const hs = Array.from(cuerpo.children).map((n) => Math.ceil(n.getBoundingClientRect().height + (parseFloat(getComputedStyle(n).marginBottom) || 0)));
      const hCab = hs[0], hb = hs.slice(1);
      const paginas = []; let cur = [], h = 0, primera = true;
      bloques.forEach((b, i) => {
        let bh = hb[i], html = b;
        const lim = primera ? cap : cap - hCab;
        if (bh > lim) { html = `<div style="max-height:${lim - 10}px;overflow:hidden">${b}</div>`; bh = lim; } // un bloque más alto que una página: se recorta (no debería pasar)
        if (cur.length && h + bh > lim) { paginas.push(cur); cur = []; h = 0; primera = false; }
        cur.push(html); h += bh;
      });
      if (cur.length || !paginas.length) paginas.push(cur);
      return { paginas, cap, hCab };
    } finally { host.remove(); }
  }
  // Páginas de la ficha del jugador: lista de textos HTML (<section class="pagina">). o = { filtrar, antecedentes, seguro }
  K.fichaJugadorPaginas = function (jid, o) {
    o = Object.assign({ filtrar: false, antecedentes: false, seguro: false }, o || {});
    const data = construir(jid); if (!data) return [];
    const priv = K.verPrivado(), conAnt = !!o.antecedentes && priv, conSeg = !!o.seguro && priv;
    const hoy = K.hoy(), anio = K.anioVista(), r = K.resumenJugador(jid, anio), s = estado(jid);
    let lista = o.filtrar ? K.histFiltrar(data, s) : data.items;
    if (!conSeg) lista = lista.filter((it) => it.k !== 'seguro');
    const bloques = [bloqueDatos(data, 'Emitida el ' + K.fechaCorta(hoy))];
    if (conAnt) { const b = bloqueAntecedentes(data); if (b) bloques.push(b); }
    bloques.push(...bloquesResumen(r));
    if (data.casos.length) {
      bloques.push(`<h3 class="fj-sec">Lesiones y molestias <small>${data.casos.length}</small></h3>`);
      data.casos.forEach((c) => bloques.push(...bloquesCaso(c, data)));
    }
    bloques.push(...bloquesCirugias(data));
    if (conSeg) bloques.push(...bloquesSeguro(data));
    // línea de tiempo (por mes)
    const filtro = o.filtrar && hayFiltro(s) ? descFiltro(data, s) : '';
    bloques.push(`<h3 class="fj-sec">Línea de tiempo <small>${lista.length} registro${lista.length === 1 ? '' : 's'}</small></h3><p class="fj-nota" style="margin:0">${filtro ? 'Filtrada: ' + e(filtro) : 'Todo el historial'}${conSeg ? '' : ' · sin datos del seguro'}.</p>`);
    let mes = '', pend = '';
    lista.forEach((it) => {
      const m = it.f ? K.nombreMesLargo(it.f) : 'Sin fecha';
      if (m !== mes) { mes = m; pend = `<h4 class="fj-mes">${e(m)}</h4>`; }
      bloques.push(pend + filaPdf(it)); pend = '';
    });
    if (!lista.length) bloques.push('<p class="fj-nota">No hay registros con estos filtros.</p>');
    const cabCorta = `<div class="fj-cab fj-cab-c">${ESC}<div class="fj-cab-t"><h1>${e(data.j.nombre)}</h1><p>Ficha clínica · ${e(K.fechaCorta(hoy))}</p></div></div>`;
    // los bloques sueltos de título de sección se pegan al bloque siguiente (nunca quedan solos al final de una página)
    const unidos = [];
    for (let i = 0; i < bloques.length; i++) { if (/^<h3 class="fj-sec">/.test(bloques[i]) && i + 1 < bloques.length) { unidos.push(bloques[i] + bloques[i + 1]); i++; } else unidos.push(bloques[i]); }
    const rp = repartir(unidos, cabCorta);
    const total = rp.paginas.length;
    return rp.paginas.map((blqs, i) => K.rep.pagina('p-resumen p-equipo fj', `<h2>${i ? `${e(K.nombreCorto(data.j))} <small>(continuación)</small>` : 'Ficha clínica del jugador'}</h2><div class="fj-cuerpo">${i ? envolver(cabCorta) : ''}${blqs.map(envolver).join('')}</div>`)
      .replace('<!--PIE-->', K.rep.PIE(`${data.j.nombre} · ${i + 1} / ${total}`)));
  };

  // Ventana de opciones y descarga
  K.formFichaPdf = function (jid) {
    const data = construir(jid); if (!data) return;
    const s = estado(jid), filtrada = hayFiltro(s), nFil = K.histFiltrar(data, s).length, priv = K.verPrivado();
    K.modal({
      titulo: 'Descargar ficha (PDF)',
      cuerpo: `<p class="suave" style="margin:0 0 10px">${e(data.j.nombre)}. Incluye datos del jugador, resumen por temporada, lesiones con sus datos clínicos, cirugías y la línea de tiempo.</p>
        ${filtrada ? `<label class="check"><input type="checkbox" name="filtrar" checked><span>Línea de tiempo solo con lo que se ve en pantalla (${nFil} de ${data.items.length} registros: ${e(descFiltro(data, s))})</span></label>` : `<p class="suave" style="margin:0 0 6px">La línea de tiempo incluye todo el historial (${data.items.length} registros). Si quieres menos, filtra primero en “Historial completo”.</p>`}
        ${priv ? `<label class="check"><input type="checkbox" name="antecedentes"><span>Incluir antecedentes y datos de contacto</span></label>
        <label class="check"><input type="checkbox" name="seguro"><span>Incluir seguro</span></label>
        <p class="suave" style="margin:6px 0 0;font-size:13px">Son datos sensibles: déjalos sin marcar si el PDF se va a compartir fuera del área kinésica.</p>` : ''}`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Descargar PDF', fn: (m, hoja) => { const d = K.datos(hoja); setTimeout(() => K.fichaPdf(jid, { filtrar: !!d.filtrar, antecedentes: !!d.antecedentes, seguro: !!d.seguro }), 60); } }]
    });
  };
  K.fichaPdf = async function (jid, o) {
    const g = K.jugadorGlobal(jid); if (!g) return;
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
    const pags = K.fichaJugadorPaginas(jid, o);
    return K.pdf.paginas(pags, `Ficha - ${sinTildes(K.nombreCorto(g.j))} - ${K.hoy()}`);
  };

  /* ======================= BUSCADOR GLOBAL ======================= */
  K.botonBuscar = () => (K.puedeEditar() && K.state && K.state.informes && K.state.informes.length ? `<button type="button" class="btn-top buscar" data-buscar aria-label="Buscar jugador" title="Buscar jugador">${K.uiIco('lupa', 20)}</button>` : '');
  // Índice de todos los jugadores (inscritos y archivados de ambos informes).
  K.indiceBusqueda = () => {
    const est = K.estadoJugadores(), out = [];
    K.state.informes.forEach((inf) => (inf.jugadores || []).forEach((j) => {
      out.push({ j, inf, n: K.norm([j.nombre, j.nombres, j.apellido1, j.apellido2].filter(Boolean).join(' ')), les: K.esLesionado(est, j), arch: !K.inscrito(j) });
    }));
    out.sort((a, b) => a.arch - b.arch || a.j.nombre.localeCompare(b.j.nombre, 'es'));
    return out;
  };
  K.buscarJugadores = (q, soloLes, idx) => {
    idx = idx || K.indiceBusqueda();
    const tk = K.norm(q).split(' ').filter(Boolean);
    return idx.filter((x) => (!soloLes || x.les) && tk.every((t) => x.n.includes(t)));
  };
  const catTxt = (x) => { const j = x.j; if (x.arch) { const n = K.catEn(j, K.salidaDe(j)); return n ? 'Sub ' + n : j.categoria || ''; } return j.categoria || ''; };
  function filaBusq(x) {
    const j = x.j, ini = (j.nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    return `<button type="button" class="bq-fila" data-bq="${e(j.id)}"><span class="avatar">${j.foto ? `<img src="${e(j.foto)}" alt="">` : e(ini)}</span>
      <span class="txt"><b>${e(j.nombre)}</b><span>${e([catTxt(x), j.posicion, K.nacTxt(j)].filter(Boolean).join(' · ') || 'Sin datos')}</span></span>
      <span class="bq-ch">${x.les ? '<i class="chip g-grave">Lesionado</i>' : ''}${x.arch ? `<i class="chip est-${e(j.estado)}">${e(K.nombreEstado(j.estado))}</i>` : ''}</span></button>`;
  }
  K.abrirFichaBuscada = (jid) => {
    const gl = K.jugadorGlobal(jid); if (!gl) return false;
    const g = K.grupoDeInforme(gl.inf), n = K.inscrito(gl.j) ? K.catNum(gl.j) : K.catEn(gl.j, K.salidaDe(gl.j));
    if (g && n && g.cats.includes(n)) K.ui.cat = n; // la categoría del jugador (el informe lo pone abrirFicha)
    K.ui.soloLes = false; K.ui.filtroJ = '';
    return K.abrirFicha(jid);
  };
  const MAXB = 60;
  K.buscadorGlobal = function () {
    if (!K.state || !K.puedeEditar()) return;
    const idx = K.indiceBusqueda();
    K.modal({
      titulo: 'Buscar jugador',
      cuerpo: `<input type="search" class="bq-q" placeholder="Nombre o apellido (sin tildes está bien)" aria-label="Buscar jugador" autocomplete="off" data-bq-q>
        <label class="check bq-solo"><input type="checkbox" data-bq-solo><span>Solo lesionados</span></label>
        <p class="suave bq-n" data-bq-n style="margin:4px 2px 6px"></p><div class="bq-lista" data-bq-lista></div>`,
      alMontar: (m, hoja) => {
        const q = hoja.querySelector('[data-bq-q]'), solo = hoja.querySelector('[data-bq-solo]'), lista = hoja.querySelector('[data-bq-lista]'), cnt = hoja.querySelector('[data-bq-n]');
        const pintar = () => {
          const r = K.buscarJugadores(q.value, solo.checked, idx);
          lista.innerHTML = r.slice(0, MAXB).map(filaBusq).join('') || '<p class="vacio-msg">Nadie coincide con la búsqueda.</p>';
          cnt.textContent = r.length > MAXB ? `Mostrando ${MAXB} de ${r.length}: escribe más para acotar.` : `${r.length} jugador${r.length === 1 ? '' : 'es'}`;
        };
        q.addEventListener('input', pintar); solo.addEventListener('change', pintar);
        q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const f = lista.querySelector('[data-bq]'); if (f) { ev.preventDefault(); f.click(); } } });
        hoja.addEventListener('click', (ev) => { const b = ev.target.closest('[data-bq]'); if (!b) return; m.cerrar(); K.abrirFichaBuscada(b.dataset.bq); });
        pintar();
        setTimeout(() => { try { q.focus(); } catch (x) { /* nada */ } }, 80);
      }
    });
  };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('[data-buscar]')) K.buscadorGlobal(); });
})();
