/* Registro clínico completo: todo lo anotado en la app (lesiones, atenciones, controles, notas, comentarios…), con filtros,
   PDF y Excel (CSV). No depende del informe en PDF: aquí aparece TODO, incluidas las notas. */
(function () {
  const K = window.K;
  const e = K.esc;
  const TIPOS = [['todo', 'Todo'], ['casos', 'Lesiones y molestias'], ['atenciones', 'Atenciones'], ['eventos', 'Controles, exámenes, medicamentos y cirugías'], ['partidos', 'Partidos y minutos'], ['manuales', 'Ajustes manuales'], ['comentarios', 'Comentarios y fichas']];
  const st = () => (K.ui.bit = K.ui.bit || { alc: '', jugador: '', tipos: 'todo', texto: '', agrupar: 'fecha', periodo: 'todo' });
  const fc = (iso) => (iso ? K.fechaCorta(iso) : 'Sin fecha');
  const nom = (inf, id) => (K.jugador(inf, id) || { nombre: '—' }).nombre;

  /* Alcance: una categoría, una pareja o todas. Se arma un informe "virtual" con los datos que corresponden. */
  const ALCANCES = () => [['c15', 'Solo Sub 15'], ['c16', 'Solo Sub 16'], ['c18', 'Solo Sub 18'], ['c20', 'Solo Sub 20'], ['g15-16', 'Toda la pareja Sub 15-16'], ['g18-20', 'Toda la pareja Sub 18-20'], ['todas', 'Todas las categorías']];
  function alcance(f) {
    let a = f.alc;
    if (a === 'cat') a = '';
    if (a === 'pareja') a = K.ui.cat ? 'g' + K.grupoDe(K.ui.cat).id : 'todas';
    if (!a) a = K.ui.cat ? 'c' + K.ui.cat : 'todas';
    return a;
  }
  const unicos = (arr) => { const v = new Set(); return arr.filter((x) => !v.has(x.id) && v.add(x.id)); };
  function vinf(f) {
    const a = alcance(f), base = K.inf();
    const vacio = (nombre) => Object.assign({}, base, { nombre, jugadores: [], casos: [], atenciones: [], eventos: [], manuales: [], partidos: [] });
    if (a[0] === 'c') {
      const c = Number(a.slice(1)), inf = K.buscarInformeGrupo(K.grupoDe(c));
      if (!inf) return vacio('Sub ' + c);
      const js = inf.jugadores.filter((j) => K.catNum(j) === c), ids = new Set(js.map((j) => j.id)), de = (arr) => arr.filter((x) => ids.has(x.jugadorId));
      return Object.assign({}, inf, { nombre: 'Sub ' + c, jugadores: js, casos: de(inf.casos), atenciones: de(inf.atenciones), eventos: de(inf.eventos), manuales: [], _soloCat: true });
    }
    if (a[0] === 'g') {
      const g = K.GRUPOS.find((x) => 'g' + x.id === a), inf = g && K.buscarInformeGrupo(g);
      return inf ? Object.assign({}, inf, { nombre: g.nombre }) : vacio(g ? g.nombre : '');
    }
    const infs = K.GRUPOS.map((g) => K.buscarInformeGrupo(g)).filter(Boolean);
    if (!infs.length) return vacio('Todas las categorías');
    const cat = (k) => unicos([].concat(...infs.map((i) => i[k] || [])));
    return Object.assign({}, infs[0], { nombre: 'Todas las categorías', jugadores: cat('jugadores'), casos: cat('casos'), atenciones: cat('atenciones'), eventos: cat('eventos'), manuales: cat('manuales'), partidos: [].concat(...infs.map((i) => i.partidos || [])), tratamientos: cat('tratamientos'), indicadores: cat('indicadores'), camposExtra: cat('camposExtra') });
  }
  function jugadoresBase(inf) {
    return inf.jugadores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /* Entradas: { f: fecha, j: jugadorId|'', k: clave de tipo, tag, titulo, det: [[etiqueta, valor]], notas } */
  function entradas(inf, per, f) {
    const js = jugadoresBase(inf), ids = new Set(f.jugador ? [f.jugador] : js.map((j) => j.id));
    const ok = (fecha) => f.periodo !== 'periodo' || K.enPeriodo(fecha, per);
    const out = [];
    inf.casos.filter((c) => ids.has(c.jugadorId) && ok(c.inicio)).forEach((c) => {
      const les = c.tipo === 'lesion', det = [];
      det.push(['Gravedad', K.gravRotulo(c.gravedad, true)]);
      if ((c.zonas || []).length) det.push(['Zona', c.zonas.map(K.nombreZona).join(', ')]);
      if (c.mecanismo) det.push(['Ocurrió en', K.ocurrioTxt(c)]);
      if (c.contexto) det.push(['Contexto', c.contexto]);
      if (c.terreno) det.push(['Terreno', c.terreno]);
      if (K.origenCasoTxt(c)) det.push([c.convertidaA ? 'Evolución' : 'Origen', K.origenCasoTxt(c)]);
      det.push(['Inicio', fc(c.inicio)]);
      det.push(['Alta', c.alta ? fc(c.alta) : les ? 'En curso' : '—']);
      const dur = K.duracionCaso(c); if (dur && dur !== 'en curso') det.push(['Duración', dur]);
      if (les && c.inicio) det.push(['Días de baja', K.diasBajaCaso(c, { desde: c.inicio, hasta: '2100-01-01' }) + '']);
      if (K.limitaTxt(c)) det.push(['Limita entrenamiento', K.limitaTxt(c)]);
      out.push({ f: c.inicio || '', j: c.jugadorId, k: 'casos', tag: les ? 'Lesión' : 'Molestia', cls: les ? 'les' : 'mol', titulo: c.titulo, det, notas: c.notas || '', raw: c });
    });
    inf.atenciones.filter((a) => ids.has(a.jugadorId) && ok(a.fecha)).forEach((a) => {
      const tr = Object.keys(a.trat || {}).filter((id) => a.trat[id] > 0).map((id) => `${(K.trat(inf, id) || { nombre: id }).nombre} ×${a.trat[id]}`);
      const det = [['Tipo de atención', K.nombreClase(a.clase) || '—'], ['Origen', K.nombreOrigen(a.origen) || '—'], ['Período de la temporada', K.nombreTemporada(a.temporada) || '—'], ['Intervenciones', tr.length ? tr.join(', ') : 'Sin intervenciones anotadas']];
      const caso = a.casoId && inf.casos.find((c) => c.id === a.casoId); if (caso) det.push(['Asociada a', caso.titulo]);
      out.push({ f: a.fecha || '', j: a.jugadorId, k: 'atenciones', tag: 'Atención', cls: 'at', titulo: 'Atención kinésica', det, notas: a.notas || '', raw: a });
    });
    inf.eventos.filter((x) => ids.has(x.jugadorId) && ok(x.fecha) && K.evRealizado(x)).forEach((x) => {
      const def = K.EV[x.tipo] || { t: x.tipo }, det = [];
      if (x.tipo !== 'cirugia') det.push([x.tipo === 'medicamento' ? 'Unidades' : 'Cantidad', String(x.cantidad || 1)]);
      const caso = x.casoId && inf.casos.find((c) => c.id === x.casoId); if (caso) det.push(['Asociado a', caso.titulo]);
      out.push({ f: x.fecha || '', j: x.jugadorId, k: 'eventos', tag: def.t, cls: 'ev', titulo: x.nombre || def.t, det, notas: x.notas || '', raw: x });
    });
    inf.partidos.filter((p) => ok(p.fecha)).forEach((p) => {
      const jug = Object.keys(p.minutos || {}).filter((id) => ids.has(id) && Number(p.minutos[id]) > 0);
      if (inf._soloCat && !jug.length) return;
      const base = [['Condición', p.local ? 'Local' : 'Visita']];
      if (p.res) base.push(['Resultado', p.res]);
      base.push(['Jugado', p.jugado === false ? 'No' : 'Sí'], ['Duración', (p.duracion || 90) + ' min']);
      if (f.agrupar === 'jugador') {
        jug.forEach((id) => out.push({ f: p.fecha || '', j: id, k: 'partidos', tag: 'Partido', cls: 'pa', titulo: 'vs ' + p.rival, det: base.concat([['Minutos jugados', p.minutos[id] + ' min']]), notas: p.notas || '' }));
      } else {
        const det = base.slice();
        if (jug.length) det.push(['Minutos', jug.map((id) => `${nom(inf, id)} ${p.minutos[id]}'`).join(' · ')]);
        out.push({ f: p.fecha || '', j: '', k: 'partidos', tag: 'Partido', cls: 'pa', titulo: 'vs ' + p.rival, det, notas: p.notas || '' });
      }
    });
    if (!f.jugador) inf.manuales.filter((m) => ok(m.fecha)).forEach((m) => {
      const ind = inf.indicadores.find((i) => i.id === m.indId);
      out.push({ f: m.fecha || '', j: '', k: 'manuales', tag: 'Ajuste manual', cls: 'ma', titulo: ind ? ind.nombre : 'Ajuste manual', det: [['Cantidad', (m.cantidad > 0 ? '+' : '') + m.cantidad]], notas: m.nota || '' });
    });
    return { out, js, ids };
  }

  function filtrar(lista, inf, f) {
    let r = lista;
    if (f.tipos !== 'todo' && f.tipos !== 'comentarios') r = r.filter((x) => x.k === f.tipos);
    if (f.tipos === 'comentarios') r = [];
    const q = (f.texto || '').trim().toLowerCase();
    if (q) r = r.filter((x) => [x.tag, x.titulo, nom(inf, x.j), x.notas].concat(x.det.map((d) => d[0] + ' ' + d[1])).join(' ').toLowerCase().includes(q));
    return r;
  }

  const entradaHTML = (x, inf, conJugador) => `<div class="bit-it"><div class="bit-f">${x.f ? e(fc(x.f)) : '—'}</div>
    <div class="bit-c"><div class="bit-h"><span class="bit-tag t-${x.cls}">${e(x.tag)}</span><b>${e(x.titulo)}</b>${conJugador && x.j ? `<span class="bit-j">${e(nom(inf, x.j))}</span>` : ''}</div>
    <dl>${x.det.map(([l, v]) => `<div><dt>${e(l)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>
    ${x.notas ? `<p class="bit-n"><b>Notas:</b> ${e(x.notas).replace(/\n/g, '<br>')}</p>` : ''}</div></div>`;

  function fichaJugador(inf, j) {
    const ex = (inf.camposExtra || []).map((c) => [c.titulo, (j.extras || {})[c.id]]).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([t, v]) => `${t}: ${v === true ? 'Sí' : v === false ? 'No' : v}`);
    const datos = [j.categoria, j.nacimiento ? 'Nacimiento ' + j.nacimiento : '', j.posicion, j.pierna ? 'Pierna dominante ' + j.pierna.toLowerCase() : ''].filter(Boolean).join(' · ');
    return `<div class="bit-ficha">${datos ? `<p>${e(datos)}</p>` : ''}${ex.length ? `<p>${ex.map(e).join(' · ')}</p>` : ''}
      <p class="bit-n"><b>Comentarios área kinésica:</b> ${j.comentarios ? e(j.comentarios).replace(/\n/g, '<br>') : '<i>Sin comentarios.</i>'}</p></div>`;
  }

  /* Cuerpo de la bitácora (lista). */
  K.bitacoraLista = function (inf, per, f) {
    const { out, js } = entradas(inf, per, f);
    const lista = filtrar(out, inf, f);
    const orden = (a, b) => (b.f || '').localeCompare(a.f || '');
    let html = '';
    const mostrarFichas = f.tipos === 'todo' || f.tipos === 'comentarios';
    if (f.agrupar === 'jugador') {
      const grupos = js.filter((j) => !f.jugador || j.id === f.jugador);
      grupos.forEach((j) => {
        const its = lista.filter((x) => x.j === j.id).sort((a, b) => (a.f || '9999').localeCompare(b.f || '9999'));
        if (!its.length && !(mostrarFichas && (j.comentarios || ''))) return;
        html += `<section class="bit-grupo"><h3>${e(j.nombre)}</h3>${mostrarFichas ? fichaJugador(inf, j) : ''}${its.map((x) => entradaHTML(x, inf, false)).join('')}</section>`;
      });
      const gen = lista.filter((x) => !x.j).sort(orden);
      if (gen.length) html += `<section class="bit-grupo"><h3>Generales</h3>${gen.map((x) => entradaHTML(x, inf, false)).join('')}</section>`;
    } else {
      let mes = '';
      lista.slice().sort(orden).forEach((x) => {
        const m = x.f ? K.nombreMesLargo(x.f) : 'Sin fecha';
        if (m !== mes) { mes = m; html += `<h3 class="bit-mes">${e(m)}</h3>`; }
        html += entradaHTML(x, inf, true);
      });
      if (mostrarFichas) {
        const cj = js.filter((j) => (!f.jugador || j.id === f.jugador) && (j.comentarios || '').trim());
        if (cj.length) html += `<h3 class="bit-mes">Comentarios del área kinésica por jugador</h3>${cj.map((j) => `<div class="bit-it"><div class="bit-f">—</div><div class="bit-c"><div class="bit-h"><b>${e(j.nombre)}</b></div><p class="bit-n">${e(j.comentarios).replace(/\n/g, '<br>')}</p></div></div>`).join('')}`;
      }
    }
    return { html: html || '<p class="vacio-msg">No hay registros con estos filtros.</p>', n: lista.length };
  };
  K.nombreMesLargo = (iso) => { const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(iso.slice(5, 7)) - 1]; const t = (m || '') + ' ' + iso.slice(0, 4); return t.charAt(0).toUpperCase() + t.slice(1); };


  /* ---------- Resumen visual (gráficos) ---------- */
  const COL = { les: '#e8353d', mol: '#f5b400', at: '#2f7a4a', ev: '#3b5bb5' };
  const GCOL = K.COLORES_GRAV;
  const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hbar = (filas, color) => {
    const max = Math.max(1, ...filas.map((r) => r[1]));
    return filas.length ? `<div class="bd-h">${filas.map(([l, v, c]) => `<div class="bd-r"><span class="bd-l" title="${e(l)}">${e(l)}</span><span class="bd-t"><i style="width:${Math.max(v ? 3 : 0, (v / max) * 100)}%;background:${c || color || '#2f7a4a'}"></i></span><b>${v}</b></div>`).join('')}</div>` : '<p class="bd-vacio">Sin datos.</p>';
  };
  const top = (obj, n) => Object.keys(obj).map((k) => [k, obj[k]]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, n);
  const sumar = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
  const panel = (t, c, ancho) => `<section class="bd-p${ancho ? ' bd-ancho' : ''}"><h4>${e(t)}</h4>${c}</section>`;

  function donut(partes) {
    const tot = partes.reduce((a, p) => a + p[1], 0);
    if (!tot) return '<p class="bd-vacio">Sin datos.</p>';
    const R = 38, C = 2 * Math.PI * R; let off = 0;
    const arcs = partes.filter((p) => p[1] > 0).map(([, v, c]) => { const len = (v / tot) * C; const a = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${c}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 50 50)"/>`; off += len; return a; }).join('');
    return `<div class="bd-donut"><svg viewBox="0 0 100 100" role="img" aria-label="Distribución de registros">${arcs}<text x="50" y="55" text-anchor="middle" font-size="18" font-weight="700" fill="#154c2b">${tot}</text></svg>
      <ul>${partes.map(([l, v, c]) => `<li><i style="background:${c}"></i>${e(l)} <b>${v}</b></li>`).join('')}</ul></div>`;
  }

  function mensual(items) {
    const m = {};
    items.forEach((x) => { if (!x.f) return; const k = x.f.slice(0, 7); (m[k] = m[k] || { les: 0, mol: 0, at: 0, ev: 0 }); if (m[k][x.cls] !== undefined) m[k][x.cls]++; });
    const ks = Object.keys(m).sort(); if (!ks.length) return '<p class="bd-vacio">Sin registros con fecha.</p>';
    let [y, mo] = ks[0].split('-').map(Number); const fin = ks[ks.length - 1], cols = [];
    for (let g = 0; g < 36; g++) { const k = `${y}-${String(mo).padStart(2, '0')}`; cols.push([k, m[k] || { les: 0, mol: 0, at: 0, ev: 0 }]); if (k >= fin) break; mo++; if (mo > 12) { mo = 1; y++; } }
    const max = Math.max(1, ...cols.map(([, v]) => v.les + v.mol + v.at + v.ev));
    return `<div class="bd-mes">${cols.map(([k, v]) => { const t = v.les + v.mol + v.at + v.ev; return `<div class="bd-c"><em>${t || ''}</em><div class="bd-pila" style="height:${(t / max) * 100}%">${['les', 'mol', 'at', 'ev'].filter((q) => v[q]).map((q) => `<i style="flex:${v[q]};background:${COL[q]}"></i>`).join('')}</div><span>${MES3[Number(k.slice(5)) - 1]}${cols.length > 12 || cols[0][0].slice(0, 4) !== cols[cols.length - 1][0].slice(0, 4) ? ' ' + k.slice(2, 4) : ''}</span></div>`; }).join('')}</div>
      <div class="bd-leyenda"><span><i style="background:${COL.les}"></i>Lesiones</span><span><i style="background:${COL.mol}"></i>Molestias</span><span><i style="background:${COL.at}"></i>Atenciones</span><span><i style="background:${COL.ev}"></i>Controles y otros</span></div>`;
  }

  function gantt(inf, casos) {
    const hoy = K.hoy(), its = casos.filter((c) => c.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-12);
    if (!its.length) return '<p class="bd-vacio">Sin lesiones ni molestias con fecha.</p>';
    const t = (iso) => new Date(iso + 'T00:00:00').getTime();
    const ini = Math.min(...its.map((c) => t(c.inicio))), fin = Math.max(...its.map((c) => t(c.alta || hoy)), ini + 864e5 * 7), span = fin - ini;
    const marcas = []; const d0 = new Date(ini); let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
    while (d.getTime() < fin) { marcas.push([((d.getTime() - ini) / span) * 100, MES3[d.getMonth()]]); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    const paso = Math.ceil(marcas.length / 10);
    return `<div class="bd-gantt">${its.map((c) => {
      const a = t(c.inicio), b = t(c.alta || hoy), l = ((a - ini) / span) * 100, w = Math.max(1.2, ((b - a) / span) * 100);
      return `<div class="bd-gr"><span class="bd-gl" title="${e(c.titulo)}"><b>${e(nom(inf, c.jugadorId))}</b> · ${e(c.titulo)}</span><span class="bd-gt">${marcas.map(([x]) => `<u style="left:${x}%"></u>`).join('')}<i class="${c.alta ? '' : 'curso'}" style="left:${l}%;width:${Math.min(w, 100 - l)}%;background:${GCOL[K.gravClave(c.gravedad)]}" title="${e(fc(c.inicio))} → ${c.alta ? e(fc(c.alta)) : 'en curso'}"></i></span></div>`;
    }).join('')}<div class="bd-gr bd-eje"><span class="bd-gl"></span><span class="bd-gt">${marcas.filter((_, i) => i % paso === 0).map(([x, n]) => `<small style="left:${x}%">${n}</small>`).join('')}</span></div></div>
    <div class="bd-leyenda">${K.GRAV_ORDEN.map((g) => `<span><i style="background:${GCOL[g]}"></i>${K.gravRotulo(g, g !== 'pordefinir')}</span>`).join('')}<span><i class="curso" style="background:#999"></i>En curso (sin alta)</span></div>`;
  }

  K.bd = { hbar, donut, panel, top, sumar, mensual, COL, GCOL, MES3 };
  K.bitGraficos = function (inf, per, f) {
    const ids = new Set(f.jugador ? [f.jugador] : inf.jugadores.map((j) => j.id));
    const { out } = entradas(inf, per, Object.assign({}, f, { agrupar: 'fecha' }));
    const reg = out.filter((x) => x.k !== 'partidos' && x.k !== 'manuales');
    if (!reg.length) return '<p class="bd-vacio" style="padding:8px 2px">No hay registros en este alcance y período para graficar.</p>';
    const casos = reg.filter((x) => x.k === 'casos').map((x) => x.raw);
    const les = casos.filter((c) => c.tipo === 'lesion'), mol = casos.filter((c) => c.tipo !== 'lesion');
    const ats = reg.filter((x) => x.k === 'atenciones').map((x) => x.raw), evs = reg.filter((x) => x.k === 'eventos').map((x) => x.raw);
    const dias = les.reduce((a, c) => a + (K.diasBajaCaso(c, { desde: c.inicio || '1900-01-01', hasta: '2100-01-01' }) || 0), 0);
    const lim = mol.filter((c) => c.limita === 'si' && !K.esMecPartido(c.mecanismo));
    const limD = lim.reduce((a, c) => a + (Number(c.limitaDias) || 0), 0);
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    // conteos
    const grav = { minima: 0, leve: 0, moderada: 0, grave: 0, pordefinir: 0 }; casos.forEach((c) => sumar(grav, K.gravClave(c.gravedad)));
    const mec = {}; casos.forEach((c) => sumar(mec, c.mecanismo || '_'));
    const zonas = {}; casos.forEach((c) => (c.zonas || []).forEach((z) => sumar(zonas, K.nombreZona(z))));
    const trat = {}; ats.forEach((a) => Object.keys(a.trat || {}).forEach((id) => { if (a.trat[id] > 0) sumar(trat, (K.trat(inf, id) || { nombre: id }).nombre, Number(a.trat[id])); }));
    const meds = {}; evs.filter((x) => x.tipo === 'medicamento').forEach((x) => sumar(meds, x.nombre || 'Sin nombre', Number(x.cantidad) || 1));
    const porJ = {}; reg.forEach((x) => { if (x.j) sumar(porJ, nom(inf, x.j)); });
    const diasJ = {}; les.forEach((c) => sumar(diasJ, nom(inf, c.jugadorId), K.diasBajaCaso(c, { desde: c.inicio || '1900-01-01', hasta: '2100-01-01' }) || 0));
    const limJ = {}; lim.forEach((c) => sumar(limJ, nom(inf, c.jugadorId), Number(c.limitaDias) || 0));
    const mecF = K.MECANISMOS.map(([k, n]) => [n, mec[k] || 0]).concat([['Sin dato', mec._ || 0, '#8a9a90']]);
    const tipos = [['Lesiones', les.length, COL.les], ['Molestias', mol.length, COL.mol], ['Atenciones', ats.length, COL.at], ['Controles, exámenes, medicamentos y cirugías', evs.length, COL.ev]];
    return `<div class="bd-kpis">${kpi(reg.length, 'registros')}${kpi(les.length, 'lesiones')}${kpi(mol.length, 'molestias')}${kpi(ats.length, 'atenciones')}${kpi(evs.length, 'controles y otros')}${kpi(dias, 'días de baja')}${kpi(lim.length, 'molestias que limitaron entreno')}${kpi(limD, 'días de entreno limitado')}</div>
      <div class="bd-g">
        ${panel('Registros por mes', mensual(reg), true)}
        ${panel('Qué se ha registrado', donut(tipos))}
        ${panel('Por gravedad', hbar(K.GRAV_ORDEN.filter((g) => g !== 'pordefinir' || grav.pordefinir).map((g) => [K.GRAVEDADES[g], grav[g], GCOL[g]])))}
        ${panel('Línea de tiempo de lesiones y molestias', gantt(inf, casos), true)}
        ${panel('Dónde ocurrió', hbar(mecF, '#2f7a4a'))}
        ${panel('Zonas más frecuentes', hbar(top(zonas, 6), '#e9a93b'))}
        ${panel('Tratamientos más usados', hbar(top(trat, 6), '#2f7a4a'))}
        ${panel('Medicamentos entregados', hbar(top(meds, 6), '#3b5bb5'))}
        ${f.jugador ? '' : panel('Jugadores con más registros', hbar(top(porJ, 8), '#2f7a4a'))}
        ${f.jugador ? '' : panel('Días de baja por jugador', hbar(top(diasJ, 6), '#e8353d'))}
        ${f.jugador ? '' : panel('Días de entrenamiento limitado por jugador', hbar(top(limJ, 6), '#f5b400'))}
      </div>
      <p class="bd-nota">Los gráficos usan el alcance, el período y el jugador elegidos arriba.</p>`;
  };
  K.pBitacora = function () {
    const f = st(), inf = vinf(f), per = K.resolverPeriodo(K.state.periodo);
    const js = jugadoresBase(inf);
    if (f.jugador && !js.some((j) => j.id === f.jugador)) f.jugador = '';
    const { html, n } = K.bitacoraLista(inf, per, f);
    const dash = K.bitGraficos(inf, per, f);
    return `<div class="titulo-vista"><div class="fila gap"><button class="btn sec chico" data-acc="volverInforme">${K.uiIco('atras', 16)} Informe</button></div></div>
      <h1 style="font-family:Caladea,serif;color:var(--verde-2);margin:4px 2px 2px">Registro clínico completo</h1>
      <p class="suave" style="margin:0 2px 10px">Todo lo que se ha anotado en la app, con notas, fechas y días. No sale en el PDF del informe.</p>
      <div class="card">
        <div class="grid2">
          <label class="campo"><span>Jugador</span><select data-acc-change="bitFiltro" data-k="jugador"><option value="">Todos</option>${js.map((j) => `<option value="${j.id}"${f.jugador === j.id ? ' selected' : ''}>${e(j.nombre)}</option>`).join('')}</select></label>
          <label class="campo"><span>Mostrar</span><select data-acc-change="bitFiltro" data-k="tipos">${K.opts(TIPOS, f.tipos)}</select></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Ordenar por</span><select data-acc-change="bitFiltro" data-k="agrupar">${K.opts([['fecha', 'Fecha (lo más reciente primero)'], ['jugador', 'Jugador (cronológico)']], f.agrupar)}</select></label>
          <label class="campo"><span>Período</span><select data-acc-change="bitFiltro" data-k="periodo">${K.opts([['todo', 'Todo el historial'], ['periodo', 'Solo ' + per.completo.toLowerCase()]], f.periodo)}</select></label>
        </div>
        <label class="campo"><span>Categorías</span><select data-acc-change="bitFiltro" data-k="alc">${K.opts(ALCANCES(), alcance(f))}</select></label>
        <label class="campo"><span>Buscar en todo el texto</span><input type="search" value="${e(f.texto)}" placeholder="Ej. rodilla, ibuprofeno, post partido…" data-acc-input="bitTexto"></label>
        <div class="fila wrap gap"><button class="btn chico" data-acc="bitPdf">${K.uiIco('pdf', 16)} Descargar PDF</button><button class="btn sec chico" data-acc="bitCsv">${K.uiIco('descargar', 16)} Descargar Excel (CSV)</button></div>
      </div>
      <h2 class="bit-h2">Resumen visual · ${e(inf.nombre)}</h2>
      <div class="bit-dash" id="bit-dash">${dash}</div>
      <h2 class="bit-h2">Registro detallado</h2>
      <p class="suave" style="margin:2px 2px 8px" data-bit-n>${n} registro${n === 1 ? '' : 's'}</p>
      <div class="bit" id="bit-lista">${html}</div>`;
  };

  const csv = (v) => { let t = String(v == null ? '' : v); if (/^[=+@\t\r]/.test(t) || /^-(?!\d)/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }; // un texto que empiece con = + - @ no se ejecuta como fórmula en Excel
  Object.assign(K.acciones, {
    abrirBitacora() { K.ui.pantalla = 'bitacora'; K.render(); window.scrollTo(0, 0); },
    volverInforme() { K.ui.pantalla = 'informe'; K.render(); window.scrollTo(0, 0); },
    bitFiltro(el) { st()[el.dataset.k] = el.value; K.render(); },
    bitTexto(el) {
      st().texto = el.value;
      clearTimeout(K._bitT);
      K._bitT = setTimeout(() => {
        const r = K.bitacoraLista(vinf(st()), K.resolverPeriodo(K.state.periodo), st());
        const l = document.getElementById('bit-lista'), c = document.querySelector('[data-bit-n]');
        if (l) l.innerHTML = r.html; if (c) c.textContent = `${r.n} registro${r.n === 1 ? '' : 's'}`;
      }, 200);
    },
    bitCsv() {
      const f = st(), inf = vinf(f), per = K.resolverPeriodo(K.state.periodo);
      const lista = filtrar(entradas(inf, per, f).out, inf, f).sort((a, b) => (a.f || '').localeCompare(b.f || ''));
      const filas = [['Fecha', 'Jugador', 'Categoría', 'Tipo', 'Título', 'Detalle', 'Notas']].concat(lista.map((x) => {
        const j = K.jugador(inf, x.j);
        return [x.f ? K.fechaCorta(x.f) : '', j ? j.nombre : '', j ? j.categoria || '' : '', x.tag, x.titulo, x.det.map(([l, v]) => `${l}: ${v}`).join(' | '), x.notas];
      }));
      const blob = new Blob(['﻿' + filas.map((r) => r.map(csv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `registro-clinico-${inf.nombre.replace(/[^\w-]+/g, '-')}-${K.hoy()}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      K.aviso('Archivo descargado (ábrelo con Excel)');
    },
    bitPdf() {
      const f = st(), inf = vinf(f), per = K.resolverPeriodo(K.state.periodo);
      const r = K.bitacoraLista(inf, per, f);
      K.pdf.documento(`<div class="bit-print"><header><img src="img/insignia-512.png" alt=""><div><h1>Registro clínico del área kinésica</h1><p>Santiago Wanderers · ${e(inf.nombre)} · ${f.periodo === 'periodo' ? e(per.completo) : 'Todo el historial'} · ${n2(r.n)} · ${e(K.fechaCorta(K.hoy()))}</p></div></header><div class="bit-dash">${K.bitGraficos(inf, per, f)}</div><h2 class="bit-h2">Registro detallado</h2><div class="bit">${r.html}</div></div>`, `Registro clínico ${inf.nombre} ${K.hoy()}`);
    }
  });
  const n2 = (n) => `${n} registro${n === 1 ? '' : 's'}`;
})();
